import boto3
from botocore.exceptions import ClientError
from config import settings
import uuid
import logging

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key
        )
        self.bucket_name = settings.s3_bucket_name
    
    def generate_s3_key(self, user_id: str, document_type: str, filename: str) -> str:
        """Generate a secure S3 object key"""
        file_extension = filename.split('.')[-1].lower()
        unique_id = str(uuid.uuid4())
        s3_key = f"documents/{user_id}/{document_type}/{unique_id}.{file_extension}"
        return s3_key
    
    def generate_presigned_upload_url(self, s3_key: str, content_type: str, expiration: int = 600) -> str:
        """Generate presigned URL for upload"""
        try:
            presigned_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                    'ContentType': content_type,
                    'ServerSideEncryption': 'AES256'
                },
                ExpiresIn=expiration
            )
            return presigned_url
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise Exception("Failed to generate upload URL")
    
    def generate_presigned_download_url(self, s3_key: str, expiration: int = 3600) -> str:
        """Generate presigned URL for download"""
        try:
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            return presigned_url
        except ClientError as e:
            logger.error(f"Error generating download URL: {e}")
            raise Exception("Failed to generate download URL")
    
    def verify_object_exists(self, s3_key: str) -> bool:
        """Verify object exists in S3"""
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False
    
    def delete_object(self, s3_key: str) -> bool:
        """Delete object from S3"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            logger.error(f"Error deleting object: {e}")
            return False

s3_service = S3Service()