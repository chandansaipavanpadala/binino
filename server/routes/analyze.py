import json
import logging
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from server.services.job_manager import job_manager
from server.services.ghidra_runner import ghidra_runner
from server.models.schemas import JobStatusResponse, AnalysisResultResponse

# Setup router
router = APIRouter(prefix="/api")
logger = logging.getLogger("binino.analyze")

@router.get("/analyze/{job_id}")
async def analyze_firmware(job_id: str):
    """Establishes a Server-Sent Events (SSE) stream reporting Ghidra decompilation updates."""
    record = job_manager.get_job(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis job not found.")

    async def event_generator():
        try:
            logger.info(f"SSE analysis stream established for job {job_id}")
            # Mark status as running at start
            job_manager.update_job_progress(job_id, percent=5, status="running")
            
            async for update in ghidra_runner.run_analysis(job_id, record.filepath, record.arch):
                event_name = update["event"]
                data = update["data"]

                # Update in-memory job records based on stream output
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
                
                # Format to SSE payload
                yield {
                    "event": event_name,
                    "data": json.dumps(data)
                }
        except Exception as ex:
            logger.error(f"Fatal exception in SSE stream for job {job_id}: {ex}")
            job_manager.update_job_progress(job_id, percent=0, status="failed", error=str(ex))
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
