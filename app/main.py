from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import RequestLoggingMiddleware
from app.api.v1 import auth, documents, face_verification, aml, risk, cases, dev_auth, onboarding, mobile_auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    yield


app = FastAPI(
    title="KYC + AML Compliance Platform",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ] if settings.DEBUG else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

prefix = settings.API_V1_PREFIX
app.include_router(mobile_auth.router, prefix=prefix)
app.include_router(auth.router, prefix=prefix)
app.include_router(documents.router, prefix=prefix)
app.include_router(face_verification.router, prefix=prefix)
app.include_router(aml.router, prefix=prefix)
app.include_router(risk.router, prefix=prefix)
app.include_router(cases.router, prefix=prefix)
app.include_router(dev_auth.router, prefix=prefix)
app.include_router(onboarding.router, prefix=prefix)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "env": settings.APP_ENV}
