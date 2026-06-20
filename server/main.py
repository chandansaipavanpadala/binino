import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.routes import upload, analyze, explain, mcu, detect
from server.services.job_manager import job_manager


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("binino.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Spawn job manager garbage collection loop
    logger.info("Initializing Binino backend, starting tempfile purger task...")
    cleanup_task = asyncio.create_task(job_manager.run_cleanup_loop())
    yield
    # Shutdown: Cancel task gracefully
    logger.info("Shutting down Binino backend, stopping cleanup task...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Binino Backend Handoff Server",
    description="Python API bridging raw binary firmware uploads and Ghidra decompilation",
    version="2.2.6",
    lifespan=lifespan
)

# CORS Configurations
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]  # Dev defaults
env_origins = os.environ.get("BININO_ALLOWED_ORIGINS")
if env_origins:
    allowed_origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]

logger.info(f"CORS origins configured: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(explain.router)
app.include_router(mcu.router)
app.include_router(detect.router)


@app.get("/")
def read_root():
    return {"name": "Binino API", "version": "2.2.6", "status": "online"}
