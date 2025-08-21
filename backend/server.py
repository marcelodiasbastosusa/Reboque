from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from enum import Enum


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="TowFleets API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    CLIENT = "client"
    DEALER = "dealer"
    TOW_COMPANY = "tow_company"
    DRIVER = "driver"


class TowRequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    ON_MISSION = "on_mission"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DriverStatus(str, Enum):
    OFFLINE = "offline"
    AVAILABLE = "available"
    ON_MISSION = "on_mission"


# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool = True
    is_approved: bool = Field(default=True)  # Admin approval for companies/drivers
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


class TowRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str
    dropoff_lat: float
    dropoff_lng: float
    vehicle_info: Optional[str] = None
    proposed_price: Optional[float] = None
    vehicle_photos: List[str] = Field(default_factory=list)
    status: TowRequestStatus = TowRequestStatus.PENDING
    assigned_driver_id: Optional[str] = None
    accepted_by_company_id: Optional[str] = None
    driver_location_lat: Optional[float] = None
    driver_location_lng: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TowRequestCreate(BaseModel):
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str
    dropoff_lat: float
    dropoff_lng: float
    vehicle_info: Optional[str] = None
    proposed_price: Optional[float] = None
    notes: Optional[str] = None


class TowRequestUpdate(BaseModel):
    status: Optional[TowRequestStatus] = None
    assigned_driver_id: Optional[str] = None
    driver_location_lat: Optional[float] = None
    driver_location_lng: Optional[float] = None
    notes: Optional[str] = None


class DriverProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    license_number: str
    vehicle_info: str
    tow_company_id: Optional[str] = None  # None for independent drivers
    status: DriverStatus = DriverStatus.OFFLINE
    current_location_lat: Optional[float] = None
    current_location_lng: Optional[float] = None
    rating: float = 5.0
    total_jobs: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)


# Authentication endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    user_dict = user_data.dict(exclude={"password"})
    user_dict["hashed_password"] = hashed_password
    
    # Admin approval required for tow companies and drivers
    if user_data.role in [UserRole.TOW_COMPANY, UserRole.DRIVER]:
        user_dict["is_approved"] = False
    
    user = User(**user_dict)
    await db.users.insert_one(user.dict())
    
    # Create driver profile if role is driver
    if user_data.role == UserRole.DRIVER:
        driver_profile = DriverProfile(
            user_id=user.id,
            license_number="",  # Will be updated later
            vehicle_info="",    # Will be updated later
        )
        await db.driver_profiles.insert_one(driver_profile.dict())
    
    return user


@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user["is_approved"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending approval"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=User(**user)
    )


@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


# Tow Request endpoints
@api_router.post("/tow-requests", response_model=TowRequest)
async def create_tow_request(
    request_data: TowRequestCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.CLIENT, UserRole.DEALER]:
        raise HTTPException(status_code=403, detail="Only clients and dealers can create tow requests")
    
    request_dict = request_data.dict()
    request_dict["client_id"] = current_user.id
    
    tow_request = TowRequest(**request_dict)
    await db.tow_requests.insert_one(tow_request.dict())
    
    return tow_request


@api_router.get("/tow-requests", response_model=List[TowRequest])
async def get_tow_requests(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.CLIENT:
        # Clients see their own requests
        requests = await db.tow_requests.find({"client_id": current_user.id}).to_list(1000)
    elif current_user.role == UserRole.DRIVER:
        # Drivers see requests assigned to them or available requests
        requests = await db.tow_requests.find({
            "$or": [
                {"assigned_driver_id": current_user.id},
                {"status": TowRequestStatus.PENDING}
            ]
        }).to_list(1000)
    elif current_user.role in [UserRole.TOW_COMPANY, UserRole.ADMIN]:
        # Tow companies and admins see all requests
        requests = await db.tow_requests.find().to_list(1000)
    else:
        requests = []
    
    return [TowRequest(**request) for request in requests]


@api_router.get("/tow-requests/{request_id}", response_model=TowRequest)
async def get_tow_request(request_id: str, current_user: User = Depends(get_current_user)):
    request = await db.tow_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Tow request not found")
    
    tow_request = TowRequest(**request)
    
    # Authorization check
    if (current_user.role == UserRole.CLIENT and tow_request.client_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view this request")
    
    return tow_request


@api_router.put("/tow-requests/{request_id}", response_model=TowRequest)
async def update_tow_request(
    request_id: str,
    update_data: TowRequestUpdate,
    current_user: User = Depends(get_current_user)
):
    request = await db.tow_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Tow request not found")
    
    # Authorization and business logic checks
    if current_user.role == UserRole.DRIVER:
        # Drivers can update status and location
        if update_data.status and update_data.status not in [TowRequestStatus.ACCEPTED, TowRequestStatus.ON_MISSION, TowRequestStatus.COMPLETED]:
            raise HTTPException(status_code=403, detail="Invalid status update for driver")
    elif current_user.role == UserRole.TOW_COMPANY:
        # Tow companies can assign drivers and accept requests
        pass
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to update this request")
    
    # Update the request
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.tow_requests.update_one({"id": request_id}, {"$set": update_dict})
    
    updated_request = await db.tow_requests.find_one({"id": request_id})
    return TowRequest(**updated_request)


@api_router.post("/tow-requests/{request_id}/accept")
async def accept_tow_request(request_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.DRIVER, UserRole.TOW_COMPANY]:
        raise HTTPException(status_code=403, detail="Only drivers and tow companies can accept requests")
    
    request = await db.tow_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Tow request not found")
    
    if request["status"] != TowRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    update_data = {
        "status": TowRequestStatus.ACCEPTED,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if current_user.role == UserRole.DRIVER:
        update_data["assigned_driver_id"] = current_user.id
    elif current_user.role == UserRole.TOW_COMPANY:
        update_data["accepted_by_company_id"] = current_user.id
    
    await db.tow_requests.update_one({"id": request_id}, {"$set": update_data})
    
    updated_request = await db.tow_requests.find_one({"id": request_id})
    return TowRequest(**updated_request)


# Driver Profile endpoints
@api_router.get("/drivers/profile", response_model=DriverProfile)
async def get_driver_profile(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    
    profile = await db.driver_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    return DriverProfile(**profile)


@api_router.put("/drivers/location")
async def update_driver_location(
    lat: float,
    lng: float,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can update location")
    
    await db.driver_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": {"current_location_lat": lat, "current_location_lng": lng}}
    )
    
    return {"message": "Location updated successfully"}


@api_router.put("/drivers/status")
async def update_driver_status(
    status: DriverStatus,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can update status")
    
    await db.driver_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": {"status": status}}
    )
    
    return {"message": "Status updated successfully"}


# Admin endpoints
@api_router.get("/admin/pending-approvals")
async def get_pending_approvals(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pending_users = await db.users.find({
        "is_approved": False,
        "role": {"$in": [UserRole.TOW_COMPANY, UserRole.DRIVER]}
    }).to_list(1000)
    
    return [User(**user) for user in pending_users]


@api_router.post("/admin/approve-user/{user_id}")
async def approve_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_approved": True, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "User approved successfully"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()