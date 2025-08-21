from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
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
import math


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "towfleets-secret-key-change-in-production-2024")
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
class PricingConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    price_per_mile: float = 2.50  # Base price per mile in USD
    price_per_hour: float = 60.00  # Base price per hour in USD  
    pickup_fee: float = 25.00  # Base pickup fee in USD
    updated_by_admin_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DriverPricing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_user_id: str
    price_per_mile: float = 2.50  # Driver's custom price per mile
    pickup_fee: float = 25.00  # Driver's custom pickup fee
    is_using_base_pricing: bool = True  # If True, uses admin pricing
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PriceOffer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tow_request_id: str
    offered_by_user_id: str  # Client or driver who made the offer
    offer_type: str  # "client_offer", "driver_counter", "system_calculated"
    amount: float
    message: Optional[str] = None
    status: str = "pending"  # pending, accepted, rejected, expired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None


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
    distance_miles: Optional[float] = None  # Calculated distance in miles
    estimated_duration_hours: Optional[float] = None  # Estimated duration
    vehicle_info: Optional[str] = None
    proposed_price: Optional[float] = None
    calculated_price: Optional[float] = None  # System calculated price
    final_agreed_price: Optional[float] = None  # Final negotiated price
    current_driver_id: Optional[str] = None  # Current driver considering the request
    vehicle_photos: List[str] = Field(default_factory=list)
    status: TowRequestStatus = TowRequestStatus.PENDING
    assigned_driver_id: Optional[str] = None
    accepted_by_company_id: Optional[str] = None
    driver_location_lat: Optional[float] = None
    driver_location_lng: Optional[float] = None
    notes: Optional[str] = None
    negotiation_status: str = "awaiting_driver"  # awaiting_driver, negotiating, price_agreed, expired
    offer_expires_at: Optional[datetime] = None
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


class PriceOfferCreate(BaseModel):
    amount: float
    message: Optional[str] = None


class DriverPricingUpdate(BaseModel):
    price_per_mile: Optional[float] = None
    pickup_fee: Optional[float] = None
    is_using_base_pricing: Optional[bool] = None


class PricingConfigUpdate(BaseModel):
    price_per_mile: Optional[float] = None
    price_per_hour: Optional[float] = None
    pickup_fee: Optional[float] = None


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
def calculate_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two coordinates using Haversine formula (in km)"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lng1_rad = math.radians(lng1)
    lat2_rad = math.radians(lat2)
    lng2_rad = math.radians(lng2)
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c  # Distance in kilometers


def calculate_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two coordinates using Haversine formula (in km)"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lng1_rad = math.radians(lng1)
    lat2_rad = math.radians(lat2)
    lng2_rad = math.radians(lng2)
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    distance_km = R * c
    distance_miles = distance_km * 0.621371  # Convert to miles
    return distance_miles


async def calculate_tow_price(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, driver_user_id=None):
    """Calculate tow price based on distance and driver/admin pricing"""
    
    # Calculate distance in miles
    distance_miles = calculate_distance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
    
    # Get pricing configuration
    if driver_user_id:
        # Try to get driver's custom pricing first
        driver_pricing = await db.driver_pricing.find_one({"driver_user_id": driver_user_id})
        
        if driver_pricing and not driver_pricing.get("is_using_base_pricing", True):
            price_per_mile = driver_pricing["price_per_mile"]
            pickup_fee = driver_pricing["pickup_fee"]
        else:
            # Use base admin pricing
            pricing_config = await db.pricing_config.find_one({}, sort=[("created_at", -1)])
            if pricing_config:
                price_per_mile = pricing_config["price_per_mile"]
                pickup_fee = pricing_config["pickup_fee"]
            else:
                # Default pricing if no config exists
                price_per_mile = 2.50
                pickup_fee = 25.00
    else:
        # Use base admin pricing for general calculations
        pricing_config = await db.pricing_config.find_one({}, sort=[("created_at", -1)])
        if pricing_config:
            price_per_mile = pricing_config["price_per_mile"]
            pickup_fee = pricing_config["pickup_fee"]
        else:
            price_per_mile = 2.50
            pickup_fee = 25.00
    
    # Calculate total price: pickup fee + (distance * price per mile)
    total_price = pickup_fee + (distance_miles * price_per_mile)
    
    return {
        "distance_miles": round(distance_miles, 2),
        "price_per_mile": price_per_mile,
        "pickup_fee": pickup_fee,
        "total_price": round(total_price, 2)
    }


async def find_nearest_available_driver(pickup_lat, pickup_lng):
    """Find the nearest available driver"""
    available_drivers = await find_nearby_available_drivers(pickup_lat, pickup_lng, max_distance_km=80)
    
    if available_drivers:
        return available_drivers[0]  # Return closest driver
    return None


async def move_to_next_driver(tow_request_id):
    """Move tow request to the next available driver"""
    request = await db.tow_requests.find_one({"id": tow_request_id})
    if not request:
        return None
    
    # Find next available driver
    next_driver = await find_nearest_available_driver(
        request["pickup_lat"], 
        request["pickup_lng"]
    )
    
    if next_driver:
        # Calculate price for this driver
        price_calc = await calculate_tow_price(
            request["pickup_lat"], 
            request["pickup_lng"],
            request["dropoff_lat"], 
            request["dropoff_lng"],
            next_driver["driver"]["id"]
        )
        
        # Update request with new driver and calculated price
        await db.tow_requests.update_one(
            {"id": tow_request_id},
            {"$set": {
                "current_driver_id": next_driver["driver"]["id"],
                "calculated_price": price_calc["total_price"],
                "distance_miles": price_calc["distance_miles"],
                "negotiation_status": "awaiting_driver",
                "offer_expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return next_driver
    
    return None


async def find_nearby_available_drivers(pickup_lat, pickup_lng, max_distance_km=50):
    """Find available drivers within specified distance"""
    available_drivers = []
    
    # Get all drivers who are available and approved
    drivers = await db.users.find({
        "role": "driver",
        "is_approved": True,
        "is_active": True
    }).to_list(1000)
    
    for driver in drivers:
        # Get driver profile to check status and location
        profile = await db.driver_profiles.find_one({"user_id": driver["id"]})
        
        if (profile and 
            profile.get("status") == "available" and 
            profile.get("current_location_lat") and 
            profile.get("current_location_lng")):
            
            distance = calculate_distance(
                pickup_lat, pickup_lng,
                profile["current_location_lat"], 
                profile["current_location_lng"]
            )
            
            if distance <= max_distance_km:
                available_drivers.append({
                    "driver": driver,
                    "profile": profile,
                    "distance_km": round(distance, 2)
                })
    
    # Sort by distance (closest first)
    available_drivers.sort(key=lambda x: x["distance_km"])
    return available_drivers


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
    
    # Create user dict with hashed password
    user_dict = user_data.dict(exclude={"password"})
    user_dict["hashed_password"] = hashed_password
    
    # Admin approval required for tow companies and drivers
    if user_data.role in [UserRole.TOW_COMPANY, UserRole.DRIVER]:
        user_dict["is_approved"] = False
    
    # Add UUID and timestamps
    user_dict["id"] = str(uuid.uuid4())
    user_dict["created_at"] = datetime.now(timezone.utc)
    user_dict["updated_at"] = datetime.now(timezone.utc)
    
    # Store in database with hashed password
    await db.users.insert_one(user_dict)
    
    # Create driver profile if role is driver
    if user_data.role == UserRole.DRIVER:
        driver_profile = DriverProfile(
            user_id=user_dict["id"],
            license_number="",  # Will be updated later
            vehicle_info="",    # Will be updated later
        )
        await db.driver_profiles.insert_one(driver_profile.dict())
    
    # Return user without hashed password
    return User(**{k: v for k, v in user_dict.items() if k != "hashed_password"})


@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if hashed_password exists (for older users created before the fix)
    if "hashed_password" not in user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account needs to be re-created. Please register again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("is_approved", True):  # Default to True for backward compatibility
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
        user=User(**{k: v for k, v in user.items() if k != "hashed_password"})
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
    
    # Calculate distance and find nearest driver
    nearest_driver = await find_nearest_available_driver(
        request_data.pickup_lat, 
        request_data.pickup_lng
    )
    
    # Calculate price based on nearest driver or admin pricing
    driver_id = nearest_driver["driver"]["id"] if nearest_driver else None
    price_calc = await calculate_tow_price(
        request_data.pickup_lat,
        request_data.pickup_lng, 
        request_data.dropoff_lat,
        request_data.dropoff_lng,
        driver_id
    )
    
    # Create request with calculated values
    request_dict = request_data.dict()
    request_dict["client_id"] = current_user.id
    request_dict["distance_miles"] = price_calc["distance_miles"]
    request_dict["calculated_price"] = price_calc["total_price"]
    request_dict["current_driver_id"] = driver_id
    request_dict["negotiation_status"] = "awaiting_driver" if driver_id else "no_drivers_available"
    request_dict["offer_expires_at"] = datetime.now(timezone.utc) + timedelta(minutes=5) if driver_id else None
    
    tow_request = TowRequest(**request_dict)
    await db.tow_requests.insert_one(tow_request.dict())
    
    return tow_request


@api_router.post("/tow-requests/{request_id}/offer")
async def make_price_offer(
    request_id: str,
    offer_data: PriceOfferCreate,
    current_user: User = Depends(get_current_user)
):
    """Client makes a price offer or driver makes a counter-offer"""
    
    request = await db.tow_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Tow request not found")
    
    # Determine offer type based on user role
    if current_user.role in [UserRole.CLIENT, UserRole.DEALER]:
        if request["client_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        offer_type = "client_offer"
    elif current_user.role == UserRole.DRIVER:
        if request["current_driver_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Request not assigned to you")
        offer_type = "driver_counter"
    else:
        raise HTTPException(status_code=403, detail="Invalid user role for making offers")
    
    # Create offer
    offer = PriceOffer(
        tow_request_id=request_id,
        offered_by_user_id=current_user.id,
        offer_type=offer_type,
        amount=offer_data.amount,
        message=offer_data.message,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    
    await db.price_offers.insert_one(offer.dict())
    
    # Update request status
    update_data = {
        "negotiation_status": "negotiating",
        "updated_at": datetime.now(timezone.utc)
    }
    
    if offer_type == "client_offer":
        update_data["proposed_price"] = offer_data.amount
    
    await db.tow_requests.update_one({"id": request_id}, {"$set": update_data})
    
    return offer


@api_router.post("/tow-requests/{request_id}/accept-offer")
async def accept_price_offer(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Accept the current price offer and proceed with the tow"""
    
    request = await db.tow_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Tow request not found")
    
    # Get latest offer
    latest_offer = await db.price_offers.find_one(
        {"tow_request_id": request_id}, 
        sort=[("created_at", -1)]
    )
    
    if not latest_offer:
        raise HTTPException(status_code=400, detail="No offer to accept")
    
    # Determine who can accept
    if current_user.role == UserRole.DRIVER and request["current_driver_id"] == current_user.id:
        # Driver accepting client's offer
        if latest_offer["offer_type"] != "client_offer":
            raise HTTPException(status_code=400, detail="No client offer to accept")
    elif (current_user.role in [UserRole.CLIENT, UserRole.DEALER] and 
          request["client_id"] == current_user.id):
        # Client accepting driver's counter-offer
        if latest_offer["offer_type"] != "driver_counter":
            raise HTTPException(status_code=400, detail="No driver counter-offer to accept")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to accept this offer")
    
    # Accept the offer and assign the job
    await db.price_offers.update_one(
        {"id": latest_offer["id"]}, 
        {"$set": {"status": "accepted"}}
    )
    
    await db.tow_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": TowRequestStatus.ACCEPTED,
            "assigned_driver_id": request["current_driver_id"],
            "final_agreed_price": latest_offer["amount"],
            "negotiation_status": "price_agreed",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update driver status
    await db.driver_profiles.update_one(
        {"user_id": request["current_driver_id"]},
        {"$set": {"status": DriverStatus.ON_MISSION}}
    )
    
    return {"message": "Offer accepted, tow request assigned", "agreed_price": latest_offer["amount"]}


@api_router.post("/tow-requests/{request_id}/reject-offer")
async def reject_price_offer(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Reject the current offer and move to next driver or end negotiation"""
    
    request = await db.tow_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Tow request not found")
    
    # Get latest offer
    latest_offer = await db.price_offers.find_one(
        {"tow_request_id": request_id}, 
        sort=[("created_at", -1)]
    )
    
    if latest_offer:
        await db.price_offers.update_one(
            {"id": latest_offer["id"]}, 
            {"$set": {"status": "rejected"}}
        )
    
    # If driver rejects, move to next available driver
    if (current_user.role == UserRole.DRIVER and 
        request["current_driver_id"] == current_user.id):
        
        next_driver = await move_to_next_driver(request_id)
        
        if next_driver:
            return {
                "message": "Offer rejected, moved to next driver", 
                "next_driver_distance": f"{next_driver['distance_km']} km"
            }
        else:
            # No more drivers available
            await db.tow_requests.update_one(
                {"id": request_id},
                {"$set": {
                    "negotiation_status": "no_drivers_available",
                    "current_driver_id": None,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            return {"message": "No more drivers available"}
    
    # If client rejects driver's counter-offer, driver can make another offer
    elif (current_user.role in [UserRole.CLIENT, UserRole.DEALER] and 
          request["client_id"] == current_user.id):
        
        await db.tow_requests.update_one(
            {"id": request_id},
            {"$set": {
                "negotiation_status": "awaiting_driver",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return {"message": "Counter-offer rejected, awaiting new driver offer"}
    
    else:
        raise HTTPException(status_code=403, detail="Not authorized to reject this offer")


# Driver Pricing Management
@api_router.get("/drivers/pricing", response_model=DriverPricing)
async def get_driver_pricing(current_user: User = Depends(get_current_user)):
    """Get driver's current pricing configuration"""
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can access pricing")
    
    pricing = await db.driver_pricing.find_one({"driver_user_id": current_user.id})
    
    if not pricing:
        # Create default pricing for new driver
        default_pricing = DriverPricing(driver_user_id=current_user.id)
        await db.driver_pricing.insert_one(default_pricing.dict())
        return default_pricing
    
    return DriverPricing(**pricing)


@api_router.put("/drivers/pricing", response_model=DriverPricing)
async def update_driver_pricing(
    pricing_data: DriverPricingUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update driver's pricing configuration"""
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can update pricing")
    
    update_dict = {k: v for k, v in pricing_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    # Ensure pricing exists
    existing = await db.driver_pricing.find_one({"driver_user_id": current_user.id})
    if not existing:
        # Create new pricing
        new_pricing = DriverPricing(driver_user_id=current_user.id, **update_dict)
        await db.driver_pricing.insert_one(new_pricing.dict())
        return new_pricing
    else:
        # Update existing
        await db.driver_pricing.update_one(
            {"driver_user_id": current_user.id},
            {"$set": update_dict}
        )
        updated_pricing = await db.driver_pricing.find_one({"driver_user_id": current_user.id})
        return DriverPricing(**updated_pricing)


# Admin Pricing Management  
@api_router.get("/admin/pricing-config", response_model=PricingConfig)
async def get_pricing_config(current_user: User = Depends(get_current_user)):
    """Get current admin pricing configuration"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.pricing_config.find_one({}, sort=[("created_at", -1)])
    
    if not config:
        # Create default config
        default_config = PricingConfig(updated_by_admin_id=current_user.id)
        await db.pricing_config.insert_one(default_config.dict())
        return default_config
    
    return PricingConfig(**config)


@api_router.put("/admin/pricing-config", response_model=PricingConfig)
async def update_pricing_config(
    config_data: PricingConfigUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update admin pricing configuration"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_dict = {k: v for k, v in config_data.dict().items() if v is not None}
    update_dict["updated_by_admin_id"] = current_user.id
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    # Create new config (keep history)
    existing = await db.pricing_config.find_one({}, sort=[("created_at", -1)])
    
    if existing:
        new_config = PricingConfig(**existing, **update_dict)
    else:
        new_config = PricingConfig(**update_dict)
    
    await db.pricing_config.insert_one(new_config.dict())
    return new_config


@api_router.get("/tow-requests/{request_id}/offers")
async def get_request_offers(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all offers for a tow request"""
    
    request = await db.tow_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Tow request not found")
    
    # Check authorization
    if (current_user.role in [UserRole.CLIENT, UserRole.DEALER] and 
        request["client_id"] != current_user.id) or \
       (current_user.role == UserRole.DRIVER and 
        request["current_driver_id"] != current_user.id) or \
       (current_user.role not in [UserRole.CLIENT, UserRole.DEALER, UserRole.DRIVER, UserRole.ADMIN]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    offers = await db.price_offers.find(
        {"tow_request_id": request_id}
    ).sort("created_at", -1).to_list(100)
    
    return [PriceOffer(**offer) for offer in offers]


@api_router.get("/tow-requests/nearby", response_model=List[Dict])
async def get_nearby_tow_requests(
    current_user: User = Depends(get_current_user),
    max_distance: Optional[float] = 50.0
):
    """Get tow requests near the driver's current location"""
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can access nearby requests")
    
    # Get driver's current location
    driver_profile = await db.driver_profiles.find_one({"user_id": current_user.id})
    if not driver_profile or not driver_profile.get("current_location_lat"):
        raise HTTPException(status_code=400, detail="Driver location not set")
    
    # Check if driver is available
    if driver_profile.get("status") != "available":
        return []  # Don't show requests if driver is not available
    
    # Get pending requests
    pending_requests = await db.tow_requests.find({"status": TowRequestStatus.PENDING}).to_list(1000)
    
    nearby_requests = []
    for request in pending_requests:
        distance = calculate_distance(
            driver_profile["current_location_lat"],
            driver_profile["current_location_lng"],
            request["pickup_lat"],
            request["pickup_lng"]
        )
        
        if distance <= max_distance:
            request_with_distance = TowRequest(**request).dict()
            request_with_distance["distance_km"] = round(distance, 2)
            nearby_requests.append(request_with_distance)
    
    # Sort by distance (closest first)
    nearby_requests.sort(key=lambda x: x["distance_km"])
    return nearby_requests


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
    
    # For drivers, check if they are available and close enough
    if current_user.role == UserRole.DRIVER:
        driver_profile = await db.driver_profiles.find_one({"user_id": current_user.id})
        
        if not driver_profile:
            raise HTTPException(status_code=400, detail="Driver profile not found")
        
        if driver_profile.get("status") != "available":
            raise HTTPException(status_code=400, detail="Driver must be available to accept requests")
        
        # Check distance (optional validation)
        if (driver_profile.get("current_location_lat") and 
            driver_profile.get("current_location_lng")):
            distance = calculate_distance(
                driver_profile["current_location_lat"],
                driver_profile["current_location_lng"],
                request["pickup_lat"],
                request["pickup_lng"]
            )
            
            if distance > 100:  # Max 100km
                raise HTTPException(status_code=400, detail="Request too far from your location")
    
    update_data = {
        "status": TowRequestStatus.ACCEPTED,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if current_user.role == UserRole.DRIVER:
        update_data["assigned_driver_id"] = current_user.id
        
        # Update driver status to on_mission
        await db.driver_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": {"status": DriverStatus.ON_MISSION}}
        )
        
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


# Admin Panel HTML Route
@app.get("/admin-panel", response_class=HTMLResponse)
async def admin_panel():
    """Serve the admin panel HTML"""
    html_content = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TowFleets - Painel do Gabriel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
        .login-section, .admin-section { padding: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; }
        .form-group input { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; }
        .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
        .btn:hover { transform: translateY(-2px); }
        .btn-approve { background: #10b981; margin-right: 10px; }
        .btn-reject { background: #ef4444; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #e5e7eb; }
        .stat-number { font-size: 2rem; font-weight: bold; color: #667eea; margin-bottom: 5px; }
        .user-card { background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
        .user-name { font-size: 1.2rem; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
        .user-role { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
        .role-driver { background: #dbeafe; color: #1e40af; }
        .role-tow_company { background: #e0e7ff; color: #7c3aed; }
        .hidden { display: none; }
        .alert { padding: 15px; margin-bottom: 20px; border-radius: 8px; font-weight: 500; }
        .alert-success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
        .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚛 TowFleets</h1>
            <p>Painel Administrativo - Gabriel Dias</p>
        </div>
        
        <div id="loginSection" class="login-section">
            <h2 style="margin-bottom: 20px;">Login do Administrador</h2>
            <div id="loginAlert"></div>
            <div class="form-group">
                <label>Email:</label>
                <input type="email" id="email" value="gabriel@gmail.com">
            </div>
            <div class="form-group">
                <label>Senha:</label>
                <input type="password" id="password">
            </div>
            <button id="loginBtn" class="btn" onclick="login()">Entrar</button>
        </div>
        
        <div id="adminSection" class="admin-section hidden">
            <div id="adminAlert"></div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-number" id="totalPending">0</div><div>Aprovações Pendentes</div></div>
                <div class="stat-card"><div class="stat-number" id="pendingDrivers">0</div><div>Motoristas Pendentes</div></div>
                <div class="stat-card"><div class="stat-number" id="pendingCompanies">0</div><div>Empresas Pendentes</div></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                <h2>Usuários Pendentes</h2>
                <button class="btn" onclick="loadPendingUsers()">🔄 Atualizar</button>
            </div>
            <div id="pendingUsers"></div>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin + '/api';
        let authToken = null;
        
        async function login() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            const loginAlert = document.getElementById('loginAlert');
            
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner"></span>Entrando...';
            
            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    authToken = data.access_token;
                    
                    if (data.user.role === 'admin') {
                        document.getElementById('loginSection').classList.add('hidden');
                        document.getElementById('adminSection').classList.remove('hidden');
                        loadPendingUsers();
                    } else {
                        loginAlert.innerHTML = '<div class="alert alert-error">Apenas administradores podem acessar.</div>';
                    }
                } else {
                    const error = await response.json();
                    loginAlert.innerHTML = `<div class="alert alert-error">Erro: ${error.detail}</div>`;
                }
            } catch (error) {
                loginAlert.innerHTML = '<div class="alert alert-error">Erro de conexão.</div>';
            }
            
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Entrar';
        }
        
        async function loadPendingUsers() {
            const pendingUsersDiv = document.getElementById('pendingUsers');
            pendingUsersDiv.innerHTML = '<div style="text-align: center; padding: 20px;"><span class="spinner"></span>Carregando...</div>';
            
            try {
                const response = await fetch(`${API_BASE}/admin/pending-approvals`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                if (response.ok) {
                    const users = await response.json();
                    displayPendingUsers(users);
                    updateStats(users);
                } else {
                    pendingUsersDiv.innerHTML = '<div class="alert alert-error">Erro ao carregar usuários.</div>';
                }
            } catch (error) {
                pendingUsersDiv.innerHTML = '<div class="alert alert-error">Erro de conexão.</div>';
            }
        }
        
        function updateStats(users) {
            document.getElementById('totalPending').textContent = users.length;
            document.getElementById('pendingDrivers').textContent = users.filter(u => u.role === 'driver').length;
            document.getElementById('pendingCompanies').textContent = users.filter(u => u.role === 'tow_company').length;
        }
        
        function displayPendingUsers(users) {
            const pendingUsersDiv = document.getElementById('pendingUsers');
            
            if (users.length === 0) {
                pendingUsersDiv.innerHTML = '<div style="text-align: center; padding: 40px;"><h3>🎉 Nenhum usuário pendente!</h3><p>Todos já foram aprovados.</p></div>';
                return;
            }
            
            const roleNames = { 'driver': 'Motorista', 'tow_company': 'Empresa de Reboque' };
            
            const usersHTML = users.map(user => {
                const createdDate = new Date(user.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                
                return `
                    <div class="user-card">
                        <div class="user-name">${user.full_name}</div>
                        <span class="user-role role-${user.role}">${roleNames[user.role]}</span>
                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 15px;">
                            <strong>Email:</strong> ${user.email}<br>
                            <strong>Telefone:</strong> ${user.phone || 'Não informado'}<br>
                            <strong>Cadastrado:</strong> ${createdDate}
                        </div>
                        <button class="btn btn-approve" onclick="approveUser('${user.id}', '${user.full_name}')">✅ Aprovar</button>
                        <button class="btn btn-reject">❌ Rejeitar</button>
                    </div>
                `;
            }).join('');
            
            pendingUsersDiv.innerHTML = usersHTML;
        }
        
        async function approveUser(userId, userName) {
            const adminAlert = document.getElementById('adminAlert');
            
            try {
                const response = await fetch(`${API_BASE}/admin/approve-user/${userId}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                if (response.ok) {
                    adminAlert.innerHTML = `<div class="alert alert-success">✅ ${userName} foi aprovado!</div>`;
                    loadPendingUsers();
                } else {
                    adminAlert.innerHTML = `<div class="alert alert-error">❌ Erro ao aprovar ${userName}</div>`;
                }
            } catch (error) {
                adminAlert.innerHTML = `<div class="alert alert-error">❌ Erro de conexão</div>`;
            }
        }
        
        document.getElementById('password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


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