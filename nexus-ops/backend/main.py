"""
NEXUS OPS – Backend Entry Point
FastAPI app with REST endpoints + WebSocket for real-time updates
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.tickets import router as ticket_router
from routes.websocket import router as ws_router
from utils.state import init_redis

app = FastAPI(
    title="NEXUS OPS API",
    description="Autonomous IT Operations Orchestrator",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ticket_router, prefix="/api")
app.include_router(ws_router)

@app.on_event("startup")
async def startup():
    await init_redis()
    print("✅ NEXUS OPS backend started")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "nexus-ops"}
