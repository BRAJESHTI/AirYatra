"""
Seed Demo Users Script for AirYatra
Run this script on your production server to create demo users and operators.

Usage:
    cd /app/backend
    python scripts/seed_demo_users.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from uuid import uuid4
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# Demo Users
DEMO_USERS = [
    {"email": "admin@airyatra.com", "password": "Admin123!", "full_name": "Admin User", "phone": "+919999900001", "roles": ["admin"]},
    {"email": "finance@airyatra.com", "password": "Finance@123456", "full_name": "Finance Manager", "phone": "+919999900002", "roles": ["finance"]},
    {"email": "hr@airyatra.com", "password": "HR@123456", "full_name": "HR Manager", "phone": "+919999900003", "roles": ["hr"]},
    {"email": "sales@airyatra.com", "password": "Sales@123456", "full_name": "Sales Executive", "phone": "+919999900004", "roles": ["sales"]},
    {"email": "operator@airyatra.com", "password": "Operator@123456", "full_name": "Test Operator", "phone": "+919999900005", "roles": ["operator"]},
    {"email": "demo.operator@airyatra.com", "password": "Demo1234", "full_name": "Demo Operator", "phone": "+919999900006", "roles": ["operator"]},
    {"email": "pilot@airyatra.com", "password": "Pilot@123456", "full_name": "Captain Pilot", "phone": "+919999900007", "roles": ["operator"]},
    {"email": "customer@airyatra.com", "password": "Customer@123456", "full_name": "Demo Customer", "phone": "+919999900008", "roles": ["customer"]},
    {"email": "support@airyatra.com", "password": "Support@123456", "full_name": "Support Agent", "phone": "+919999900009", "roles": ["support"]},
]

# Demo Operators with coordinates
DEMO_OPERATORS = [
    {
        "company_name": "Mumbai Heli Services",
        "contact_name": "Rajesh Sharma",
        "contact_phone": "+919876543210",
        "contact_email": "operator@airyatra.com",
        "base_city": "Mumbai",
        "base_state": "Maharashtra",
        "base_latitude": 19.0760,
        "base_longitude": 72.8777,
    },
    {
        "company_name": "Pune Air Charter",
        "contact_name": "Captain Pilot",
        "contact_phone": "+919876543211",
        "contact_email": "pilot@airyatra.com",
        "base_city": "Pune",
        "base_state": "Maharashtra",
        "base_latitude": 18.5204,
        "base_longitude": 73.8567,
    },
    {
        "company_name": "Delhi Sky Aviation",
        "contact_name": "Vikram Singh",
        "contact_phone": "+919876543212",
        "contact_email": "delhi.sky@airyatra.com",
        "base_city": "Delhi",
        "base_state": "Delhi",
        "base_latitude": 28.7041,
        "base_longitude": 77.1025,
    }
]

async def seed_users(db):
    """Seed demo users"""
    print("\n📝 Seeding Demo Users...")
    created = 0
    skipped = 0
    
    for user_data in DEMO_USERS:
        existing = await db.users.find_one({"email": user_data["email"]})
        if existing:
            print(f"  ⏭️  Skipped (exists): {user_data['email']}")
            skipped += 1
            continue
        
        user = {
            "id": str(uuid4()),
            "email": user_data["email"],
            "password_hash": get_password_hash(user_data["password"]),
            "full_name": user_data["full_name"],
            "phone": user_data["phone"],
            "role": user_data["roles"][0],
            "roles": user_data["roles"],
            "is_verified": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user)
        print(f"  ✅ Created: {user_data['email']} ({user_data['roles'][0]})")
        created += 1
    
    print(f"\n  Users - Created: {created}, Skipped: {skipped}")
    return created

async def seed_operators(db):
    """Seed demo operators"""
    print("\n🚁 Seeding Demo Operators...")
    created = 0
    
    for op_data in DEMO_OPERATORS:
        existing = await db.operators.find_one({"company_name": op_data["company_name"]})
        if existing:
            print(f"  ⏭️  Skipped (exists): {op_data['company_name']}")
            continue
        
        # Get user_id for operator
        user = await db.users.find_one({"email": op_data["contact_email"]}, {"_id": 0, "id": 1})
        user_id = user["id"] if user else str(uuid4())
        
        operator = {
            "id": str(uuid4()),
            "user_id": user_id,
            "company_name": op_data["company_name"],
            "contact_name": op_data["contact_name"],
            "contact_phone": op_data["contact_phone"],
            "contact_email": op_data["contact_email"],
            "base_city": op_data["base_city"],
            "base_state": op_data["base_state"],
            "base_latitude": op_data["base_latitude"],
            "base_longitude": op_data["base_longitude"],
            "status": "active",
            "verification_status": "verified",
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "total_aircraft": 3,
            "rating": 4.8,
            "commission_rate": 10.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.operators.insert_one(operator)
        print(f"  ✅ Created: {op_data['company_name']} ({op_data['base_city']})")
        created += 1
    
    print(f"\n  Operators - Created: {created}")
    return created

async def main():
    print("=" * 60)
    print("       AirYatra - Demo Data Seeding Script")
    print("=" * 60)
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'airyatra_db')
    
    print(f"\n🔗 Connecting to MongoDB...")
    print(f"   URL: {mongo_url[:30]}...")
    print(f"   Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Verify connection
    try:
        await client.admin.command('ping')
        print("   ✅ Connected successfully!")
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        return
    
    # Seed data
    users_created = await seed_users(db)
    operators_created = await seed_operators(db)
    
    print("\n" + "=" * 60)
    print("                    SUMMARY")
    print("=" * 60)
    print(f"  Users Created: {users_created}")
    print(f"  Operators Created: {operators_created}")
    print("\n📋 Demo Login Credentials:")
    print("-" * 40)
    print("  Admin:    admin@airyatra.com / Admin123!")
    print("  Operator: operator@airyatra.com / Operator@123456")
    print("  Operator: demo.operator@airyatra.com / Demo1234")
    print("  Customer: customer@airyatra.com / Customer@123456")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
