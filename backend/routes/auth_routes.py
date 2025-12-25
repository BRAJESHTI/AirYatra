from fastapi import APIRouter, HTTPException, Depends, status
from database import get_database
from models import UserCreate, UserLogin, Token, User
from auth import verify_password, get_password_hash, create_access_token
from middleware import get_current_user
import uuid
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user"""
    db = get_database()
    
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user_dict = user_data.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password_hash"] = get_password_hash(user_dict.pop("password"))
    user_dict["is_active"] = True
    user_dict["created_at"] = datetime.utcnow().isoformat()
    user_dict["updated_at"] = datetime.utcnow().isoformat()
    
    # Create a copy for insertion to avoid MongoDB adding _id to original dict
    insert_dict = user_dict.copy()
    await db.users.insert_one(insert_dict)
    
    access_token = create_access_token(data={"sub": user_dict["id"], "roles": user_dict["roles"]})
    
    user_response = {k: v for k, v in user_dict.items() if k != "password_hash"}
    
    return Token(access_token=access_token, user=user_response)

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login user"""
    db = get_database()
    
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    access_token = create_access_token(data={"sub": user["id"], "roles": user["roles"]})
    
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return Token(access_token=access_token, user=user_response)

@router.get("/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {k: v for k, v in user.items() if k != "password_hash"}

@router.put("/profile")
async def update_profile(
    profile_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    db = get_database()
    
    # Fields that can be updated
    allowed_fields = ["full_name", "phone", "address", "city", "state", "pincode"]
    
    update_data = {
        k: v for k, v in profile_data.items() 
        if k in allowed_fields and v is not None
    }
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    result = await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fetch updated user
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    
    return {
        "message": "Profile updated successfully",
        "user": updated_user
    }