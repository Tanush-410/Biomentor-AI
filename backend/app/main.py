"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core import settings
from app.database import get_database_backend, init_db
from app.routers import (
    auth_router,
    certificates_router,
    classrooms_router,
    collaboration_router,
    documents_router,
    educator_router,
    quiz_router,
    qa_router,
    sticky_notes_router,
)
from app.routers.learning import router as learning_router
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully!")
    yield


app = FastAPI(
    title="Smart Learning Assistant",
    description="AI-powered learning platform for exam preparation",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Production frontends often come from Vercel preview and production domains.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
app.include_router(certificates_router)
app.include_router(classrooms_router)
app.include_router(documents_router)
app.include_router(quiz_router)
app.include_router(qa_router)
app.include_router(learning_router)
app.include_router(educator_router)
app.include_router(collaboration_router)
app.include_router(sticky_notes_router)


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
