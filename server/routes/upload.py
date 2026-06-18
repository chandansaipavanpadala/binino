import uuid
import re
import logging
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from server.services.job_manager import job_manager
from server.models.schemas import JobUploadResponse
from server.registry.mcu_registry import MCU_REGISTRY

# Setup router
router = APIRouter(prefix="/api")
logger = logging.getLogger("binino.upload")

def sanitize_filename(filename: str) -> str:
    """Restricts filename to alphanumeric, dots, dashes, and underscores."""
    if not filename:
        return "firmware.bin"
    # Keep only alphanumeric, dash, underscore, dot
    clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "", filename)
    # Check if empty after sanitization
    if not clean or clean in (".", ".."):
        return "firmware.bin"
    return clean

async def run_analysis(job_id: str):
    record = job_manager.get_job(job_id)
    if not record:
        return
    try:
        from server.services.ghidra_runner import ghidra_runner
        # Mark status as running at start
        job_manager.update_job_progress(job_id, percent=5, status="running")
        
        async for update in ghidra_runner.run_analysis(job_id, record.filepath, record.arch):
            event_name = update["event"]
            data = update["data"]
            if event_name == "status":
                job_manager.update_job_progress(
                    job_id,
                    percent=data["percent"],
                    status="running"
                )
            elif event_name == "result":
                job_manager.set_job_result(job_id, result=data)
            elif event_name == "error":
                job_manager.update_job_progress(
                    job_id,
                    percent=0,
                    status="failed",
                    error=data["message"]
                )
    except Exception as ex:
        logger.error(f"Background analysis task error for job {job_id}: {ex}")
        job_manager.update_job_progress(job_id, percent=0, status="failed", error=str(ex))

@router.post("/upload", response_model=JobUploadResponse, status_code=201)
async def upload_firmware(
    request: Request,
    file: UploadFile = File(...),
    arch: str = Form(...),
    flash_size: int = Form(...)
):
    # Validate architecture
    if arch not in MCU_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unsupported target microcontroller: {arch}")

    mcu_profile = MCU_REGISTRY[arch]

    # 1. Enforce 32MB content-length limitation
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 32 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Upload payload size exceeds the maximum limit of 32MB.")

    # 2. Sanitize filename to prevent path traversal
    filename = sanitize_filename(file.filename)
    job_id = uuid.uuid4().hex
    
    # Create the job record in manager
    record = job_manager.create_job(job_id, filename, arch, flash_size, mcu_profile.flash_base)
    
    # 3. Read stream in chunks and enforce size check in case content-length was missing/faked
    total_bytes = 0
    chunk_size = 64 * 1024  # 64KB chunks
    
    try:
        with open(record.filepath, "wb") as f:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > 32 * 1024 * 1024:
                    # Cleanup partially uploaded file
                    f.close()
                    if record.filepath.exists():
                        record.filepath.unlink()
                    raise HTTPException(status_code=413, detail="Uploaded file size exceeds the 32MB limit.")
                f.write(chunk)
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail=f"Failed to store binary file: {str(e)}")
        raise e

    # Update size in record
    record.flash_size = total_bytes
    
    logger.info(f"File saved successfully: {record.filepath} ({total_bytes} bytes)")
    
    # Start background analysis immediately
    asyncio.create_task(run_analysis(job_id))
    
    return JobUploadResponse(
        job_id=job_id,
        filename=filename,
        size_bytes=total_bytes,
        arch=arch,
        status="queued",
        created_at=record.created_at.isoformat()
    )
