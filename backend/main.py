import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.shipments import router as shipments_router
from routes.tracking import router as tracking_router
from routes.ai import router as ai_router
from websocket.handler import router as ws_router

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app = FastAPI(title="Digvijay BLR API", version="2.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Mobile apps (React Native) are not subject to CORS — this only matters for
# browser-based clients. For production, set ALLOWED_ORIGINS env var to your
# domain(s). Default "*" is safe for a mobile-only API.
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(shipments_router)
app.include_router(tracking_router)
app.include_router(ai_router)
app.include_router(ws_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "Digvijay BLR API", "version": "2.1.0"}


@app.on_event("startup")
def startup():
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "FIREBASE_PROJECT_ID"]
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        print(f"[WARN] Missing env vars: {missing} — some features may not work")
    port = os.getenv("PORT", "8000")
    env = os.getenv("ENVIRONMENT", "development")
    print(f"\n Digvijay BLR API v2.1.0 [{env}] on http://localhost:{port}")
    print(f"   Docs: http://localhost:{port}/docs\n")
