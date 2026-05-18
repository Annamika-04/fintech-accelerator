import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

cognito = boto3.client(
    "cognito-idp",
    region_name=settings.COGNITO_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
)


def admin_create_user(email: str, role: str) -> dict:
    try:
        response = cognito.admin_create_user(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:role", "Value": role},
            ],
            MessageAction="SUPPRESS",
        )
        return response["User"]
    except ClientError as exc:
        logger.error("cognito_create_user_failed", email=email, error=str(exc))
        raise HTTPException(status_code=400, detail=f"Cognito error: {exc.response['Error']['Message']}")


def admin_disable_user(cognito_sub: str) -> None:
    try:
        cognito.admin_disable_user(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=cognito_sub,
        )
    except ClientError as exc:
        logger.error("cognito_disable_user_failed", sub=cognito_sub, error=str(exc))
        raise HTTPException(status_code=400, detail="Failed to disable user")


def admin_add_user_to_group(cognito_sub: str, group_name: str) -> None:
    try:
        cognito.admin_add_user_to_group(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=cognito_sub,
            GroupName=group_name,
        )
    except ClientError as exc:
        logger.warning("cognito_add_group_failed", sub=cognito_sub, group=group_name, error=str(exc))
