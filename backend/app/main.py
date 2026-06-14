"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core import settings
from app.database import get_database_backend, init_db
from app.routers import auth_router, classrooms_router, collaboration_router, documents_router, educator_router, quiz_router, qa_router
from app.routers.learning import router as learning_router
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Smart Learning Assistant",
    description="AI-powered learning platform for exam preparation",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize database
@app.on_event("startup")
async def startup():
    """Initialize on startup."""
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully!")


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "debug": settings.debug,
        "database_backend": get_database_backend(),
    }


# Include routers
app.include_router(auth_router)
app.include_router(classrooms_router)
app.include_router(documents_router)
app.include_router(quiz_router)
app.include_router(qa_router)
app.include_router(learning_router)
app.include_router(educator_router)
app.include_router(collaboration_router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Smart Learning Assistant API",
        "version": "0.1.0",
        "docs": "/api/docs",
        "api_endpoints": {
            "auth": "/api/auth",
            "documents": "/api/documents",
            "quiz": "/api/quiz",
            "qa": "/api/qa"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug
    )
