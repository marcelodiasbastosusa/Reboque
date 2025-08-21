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