import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.shipments import router as shipments_router
from routes.tracking import router as tracking_router
from websocket.handler import router as ws_router

app = FastAPI(title="Digvijay BLR API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(shipments_router)
app.include_router(tracking_router)
app.include_router(ws_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "Digvijay BLR API", "version": "2.0.0"}


@app.on_event("startup")
def startup():
    port = os.getenv("PORT", "8000")
    print(f"\n🚀 Digvijay BLR API running on http://localhost:{port}")
    print(f"   Docs: http://localhost:{port}/docs\n")
