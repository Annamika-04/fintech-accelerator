from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import (
    DocumentConfirmRequest,
    DocumentOut,
    DocumentVerificationOut,
    PresignedURLRequest,
    PresignedURLResponse,
    ALLOWED_DOCUMENT_TYPES,
    ALLOWED_MIME_TYPES,
)
from app.services.s3 import generate_presigned_upload_url
from app.tasks.ocr_tasks import run_ocr

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/presigned-url", response_model=PresignedURLResponse)
async def get_presigned_upload_url(
    payload: PresignedURLRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid document type: {payload.document_type}")
    if payload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {payload.content_type}")
    if payload.file_size_bytes > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    from app.core.config import settings

    s3_result = generate_presigned_upload_url(
        str(current_user.id),
        payload.document_type,
        payload.filename,
        payload.content_type,
    )

    doc = Document(
        user_id=current_user.id,
        document_type=payload.document_type,
        s3_key=s3_result["s3_key"],
        s3_bucket=settings.S3_BUCKET_NAME,
        mime_type=payload.content_type,
        file_size_bytes=payload.file_size_bytes,
        upload_status="pending",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return PresignedURLResponse(
        upload_url=s3_result["upload_url"],
        s3_key=s3_result["s3_key"],
        document_id=doc.id,
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
    await db.commit()

    run_ocr.delay(str(doc.id), doc.s3_key, str(current_user.id))
    return {"message": "Upload confirmed. OCR processing started.", "document_id": str(doc.id)}


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.user_id == current_user.id)
    )
    return result.scalars().all()
