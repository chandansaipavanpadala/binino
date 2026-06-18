import json
import logging
import asyncio
from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from server.services.job_manager import job_manager
from server.models.schemas import JobStatusResponse, AnalysisResultResponse

# Setup router
router = APIRouter(prefix="/api")
logger = logging.getLogger("binino.analyze")

@router.get("/analyze/{job_id}")
async def analyze_firmware(request: Request, job_id: str):
    """Establishes a Server-Sent Events (SSE) stream reporting Ghidra decompilation updates."""
    record = job_manager.get_job(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis job not found.")

    async def event_generator():
        last_percent = -1
        last_status = ""
        try:
            logger.info(f"SSE analysis stream established for job {job_id}")
            
            while True:
                # Check for disconnection
                if await request.is_disconnected():
                    logger.info(f"SSE client disconnected for job {job_id}")
                    break

                rec = job_manager.get_job(job_id)
                if not rec:
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "stage": "Failed",
                            "message": "Analysis job disappeared.",
                            "percent": 0
                        })
                    }
                    break

                # Yield update if percent or status changed
                if rec.percent != last_percent or rec.status != last_status:
                    last_percent = rec.percent
                    last_status = rec.status
                    
                    if rec.status == "completed":
                        yield {
                            "event": "result",
                            "data": json.dumps(rec.result)
                        }
                        break
                    elif rec.status == "failed":
                        yield {
                            "event": "error",
                            "data": json.dumps({
                                "stage": "Failed",
                                "message": rec.error or "Analysis failed",
                                "percent": 0
                            })
                        }
                        break
                    else:
                        yield {
                            "event": "status",
                            "data": json.dumps({
                                "stage": "Analyzing",
                                "percent": rec.percent
                            })
                        }

                if rec.completion_event.is_set():
                    # Handle final status yield in next loop iteration
                    continue
                
                try:
                    await asyncio.wait_for(rec.completion_event.wait(), timeout=0.5)
                except asyncio.TimeoutError:
                    pass

        except Exception as ex:
            logger.error(f"Fatal exception in SSE stream for job {job_id}: {ex}")
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "Failed",
                    "message": f"Server connection failed: {str(ex)}",
                    "percent": 0
                })
            }

    return EventSourceResponse(event_generator())

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Fallback endpoint allowing status polling."""
    record = job_manager.get_job(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Job not found.")

    return JobStatusResponse(
        job_id=job_id,
        status=record.status,
        percent=record.percent,
        result_available=record.result is not None
    )

@router.get("/result/{job_id}", response_model=AnalysisResultResponse)
async def get_job_result(job_id: str):
    """Fetches the decompiled results package once ready."""
    record = job_manager.get_job(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    if not record.result:
        raise HTTPException(status_code=400, detail="Decompilation results are not available for this job.")

    return AnalysisResultResponse(**record.result)
