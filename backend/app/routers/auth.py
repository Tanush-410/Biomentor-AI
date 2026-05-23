"""Authentication router."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import bcrypt
from jose import JWTError, jwt

from app.core import settings
from app.core.security import enforce_rate_limit, ensure_role, normalize_role
from app.database import get_db
from app.database.models import User
from app.schemas import Token, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password using bcrypt."""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create JWT token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    
    return encoded_jwt


@router.post("/register", response_model=UserResponse)
async def register(user: UserRegister, request: Request, db: Session = Depends(get_db)):
    """
    Register a new user.
    
    - **email**: User email (must be unique)
    - **password**: Password (min 8 characters)
    - **full_name**: User's full name
    """
    enforce_rate_limit(request, "auth-register", limit=8, window_seconds=300)

    # Check if user exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    new_user = User(
        email=user.email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name,
        role=normalize_role(user.role),
        institution_name=user.institution_name,
        focus_area=user.focus_area,
        class_code=user.class_code,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=Token)
async def login(user: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Login user and get access token.
    
    - **email**: User email
    - **password**: User password
    """
    enforce_rate_limit(request, "auth-login", limit=12, window_seconds=300)

    # Find user
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if db_user.locked_until and db_user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Too many failed logins. Please wait a few minutes before trying again.",
        )

    if not verify_password(user.password, db_user.hashed_password):
        db_user.failed_login_attempts = (db_user.failed_login_attempts or 0) + 1
        if db_user.failed_login_attempts >= 5:
            db_user.locked_until = datetime.utcnow() + timedelta(minutes=10)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    desired_role = normalize_role(user.desired_role or db_user.role, default=db_user.role)
    if db_user.role != desired_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is registered as {db_user.role}. Please switch to the correct mode.",
        )

    db_user.failed_login_attempts = 0
    db_user.locked_until = None
    db_user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user)

    # Create token
    access_token = create_access_token(data={"sub": db_user.id, "role": db_user.role})

    return {"access_token": access_token, "token_type": "bearer", "user": db_user}


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """Dependency to get current user from JWT token in Authorization header."""
    # Extract token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token = auth_header.split(" ")[1]
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    return user


def require_roles(*roles: str):
    """Dependency factory to enforce user roles."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        ensure_role(current_user.role, roles)
        return current_user

    return dependency


@router.get("/me", response_model=UserResponse)
async def get_user_endpoint(current_user = Depends(get_current_user)):
    """Get current logged-in user."""
    return current_user
