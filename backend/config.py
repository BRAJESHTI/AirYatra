from pydantic_settings import BaseSettings
from pathlib import Path
import os
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

class Settings(BaseSettings):
    mongo_url: str = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name: str = os.getenv('DB_NAME', 'airyatra_db')
    jwt_secret_key: str = os.getenv('JWT_SECRET_KEY', 'secret')
    jwt_algorithm: str = os.getenv('JWT_ALGORITHM', 'HS256')
    access_token_expire_minutes: int = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', 10080))
    aws_access_key_id: str = os.getenv('AWS_ACCESS_KEY_ID', '')
    aws_secret_access_key: str = os.getenv('AWS_SECRET_ACCESS_KEY', '')
    aws_region: str = os.getenv('AWS_REGION', 'ap-south-1')
    s3_bucket_name: str = os.getenv('S3_BUCKET_NAME', 'airyatra-documents')
    razorpay_key_id: str = os.getenv('RAZORPAY_KEY_ID', '')
    razorpay_key_secret: str = os.getenv('RAZORPAY_KEY_SECRET', '')
    sendgrid_api_key: str = os.getenv('SENDGRID_API_KEY', '')
    sender_email: str = os.getenv('SENDER_EMAIL', 'noreply@airyatra.com')
    emergent_llm_key: str = os.getenv('EMERGENT_LLM_KEY', '')

settings = Settings()