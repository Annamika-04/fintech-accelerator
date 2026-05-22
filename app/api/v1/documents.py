import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import (
    DocumentConfirmRequest,
    DirectUploadResponse,
    DocumentOut,
    DocumentVerificationOut,
    PresignedURLRequest,
    PresignedURLResponse,
    ALLOWED_DOCUMENT_TYPES,
    ALLOWED_MIME_TYPES,
)
from app.services.kyc_session_service import emit_workflow_event, ensure_active_kyc_session, ensure_tenant_for_user, write_audit_log
from app.services.s3 import build_s3_key, build_s3_url, generate_presigned_upload_url, upload_bytes_to_s3
from app.tasks.ocr_tasks import run_ocr

router = APIRouter(prefix="/documents", tags=["Documents"])


def _validate_document_payload(document_type: str, content_type: str, file_size_bytes: int) -> None:
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid document type: {document_type}")
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
    if file_size_bytes > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")


@router.post("/presigned-url", response_model=PresignedURLResponse)
async def get_presigned_upload_url(
    payload: PresignedURLRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_document_payload(payload.document_type, payload.content_type, payload.file_size_bytes)

    from app.core.config import settings
    tenant = await ensure_tenant_for_user(db, current_user)
    session = await ensure_active_kyc_session(db, current_user)
    document_id = uuid.uuid4()

    s3_result = generate_presigned_upload_url(
        str(tenant.id),
        str(current_user.id),
        session.onboarding_id,
        payload.document_type,
        str(document_id),
        payload.filename,
        payload.content_type,
    )

    doc = Document(
        id=document_id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        kyc_session_id=session.id,
        onboarding_id=session.onboarding_id,
        document_type=payload.document_type,
        s3_key=s3_result["s3_key"],
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_url=build_s3_url(settings.S3_BUCKET_NAME, s3_result["s3_key"]),
        mime_type=payload.content_type,
        file_size_bytes=payload.file_size_bytes,
        upload_status="pending",
        verification_status="pending",
    )
    db.add(doc)
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.document_upload_intent_created",
        payload={"document_id": str(doc.id), "document_type": payload.document_type, "s3_key": doc.s3_key},
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="DOCUMENT_UPLOAD_INTENT_CREATED",
        resource_type="documents",
        resource_id=doc.id,
        extra_metadata={"document_type": payload.document_type, "s3_key": doc.s3_key},
    )
    await db.commit()
    await db.refresh(doc)

    return PresignedURLResponse(
        upload_url=s3_result["upload_url"],
        s3_key=s3_result["s3_key"],
        document_id=doc.id,
        upload_headers=s3_result["upload_headers"],
    )


@router.post("/upload", response_model=DirectUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document_direct(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.config import settings
    tenant = await ensure_tenant_for_user(db, current_user)
    session = await ensure_active_kyc_session(db, current_user)

    content_type = file.content_type or "application/octet-stream"
    file_bytes = await file.read()
    _validate_document_payload(document_type, content_type, len(file_bytes))

    doc_id = uuid.uuid4()
    s3_key = build_s3_key(
        str(tenant.id),
        str(current_user.id),
        session.onboarding_id,
        document_type,
        str(doc_id),
        file.filename or "upload.bin",
    )
    upload_bytes_to_s3(file_bytes, s3_key, content_type)

    doc = Document(
        id=doc_id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        kyc_session_id=session.id,
        onboarding_id=session.onboarding_id,
        document_type=document_type,
        s3_key=s3_key,
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_url=build_s3_url(settings.S3_BUCKET_NAME, s3_key),
        mime_type=content_type,
        file_size_bytes=len(file_bytes),
        upload_status="uploaded",
        verification_status="pending",
    )
    db.add(doc)
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.document_uploaded",
        payload={"document_id": str(doc.id), "document_type": document_type, "s3_key": doc.s3_key},
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="DOCUMENT_UPLOADED",
        resource_type="documents",
        resource_id=doc.id,
        extra_metadata={"document_type": document_type, "s3_key": doc.s3_key},
    )
    await db.commit()
    await db.refresh(doc)

    if document_type != "selfie":
        run_ocr.delay(str(doc.id), doc.s3_key, str(current_user.id))
    return DirectUploadResponse(
        document_id=doc.id,
        s3_key=doc.s3_key,
        upload_status=doc.upload_status,
        verification_status=doc.verification_status,
    )


@router.post("/confirm", status_code=status.HTTP_202_ACCEPTED)
async def confirm_upload(
    payload: DocumentConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Called after frontend completes the S3 PUT. Triggers OCR."""
    result = await db.execute(
        select(Document).where(
            Document.id == payload.document_id,
            Document.user_id == current_user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.file_hash = payload.file_hash
    doc.upload_status = "uploaded"
    doc.verification_status = doc.verification_status or "pending"
    if doc.tenant_id and doc.kyc_session_id:
        await emit_workflow_event(
            db,
            tenant_id=doc.tenant_id,
            session_id=doc.kyc_session_id,
            user_id=current_user.id,
            event_type="kyc.document_upload_confirmed",
            payload={"document_id": str(doc.id), "s3_key": doc.s3_key},
        )
        await write_audit_log(
            db,
            tenant_id=doc.tenant_id,
            session_id=doc.kyc_session_id,
            actor_id=current_user.id,
            action="DOCUMENT_UPLOAD_CONFIRMED",
            resource_type="documents",
            resource_id=doc.id,
            extra_metadata={"s3_key": doc.s3_key},
        )
    await db.commit()

    if doc.document_type != "selfie":
        run_ocr.delay(str(doc.id), doc.s3_key, str(current_user.id))
        message = "Upload confirmed. OCR processing started."
    else:
        message = "Selfie upload confirmed."
    return {"message": message, "document_id": str(doc.id)}


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()
