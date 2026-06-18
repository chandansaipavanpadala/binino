import os
import shutil
import tempfile
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

# Setup logger
logger = logging.getLogger("binino.job_manager")

@dataclass
class JobRecord:
    job_id: str
    filename: str
    filepath: Path
    arch: str
    flash_size: int
    flash_base: int
    status: str  # 'queued' | 'running' | 'completed' | 'failed'
    percent: int
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime = None
    completion_event: asyncio.Event = field(default_factory=asyncio.Event)

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, JobRecord] = {}
        # Support cross-platform: fallback to standard tempdir on Windows
        if os.name == 'nt':
            self.base_dir = Path(tempfile.gettempdir()) / "binino_jobs"
        else:
            self.base_dir = Path("/tmp/binino_jobs")

    def get_job_dir(self, job_id: str) -> Path:
        """Returns the specific work directory for a job."""
        # Sanitize job ID directory name: alphanumeric only (uuid4 with no dashes)
        clean_id = "".join(c for c in job_id if c.isalnum())
        return self.base_dir / clean_id

    def create_job(self, job_id: str, filename: str, arch: str, flash_size: int, flash_base: int) -> JobRecord:
        """Allocates directory space and registers a new job record."""
        job_dir = self.get_job_dir(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        
        filepath = job_dir / filename
        
        record = JobRecord(
            job_id=job_id,
            filename=filename,
            filepath=filepath,
            arch=arch,
            flash_size=flash_size,
            flash_base=flash_base,
            status="queued",
            percent=0
        )
        self.jobs[job_id] = record
        logger.info(f"Registered job {job_id} for {filename} ({arch})")
        return record

    def get_job(self, job_id: str) -> Optional[JobRecord]:
        """Fetches job metadata from the memory store."""
        return self.jobs.get(job_id)

    def update_job_progress(self, job_id: str, percent: int, status: str = "running", error: str = None):
        """Updates the progress details of an active job."""
        record = self.get_job(job_id)
        if record:
            record.percent = percent
            record.status = status
            if error:
                record.error = error
            if status in ("completed", "failed"):
                record.completion_event.set()
            logger.debug(f"Job {job_id} progress: {percent}% (status: {status})")

    def set_job_result(self, job_id: str, result: dict):
        """Stores the final analysis result and sets status to completed."""
        record = self.get_job(job_id)
        if record:
            record.result = result
            record.status = "completed"
            record.percent = 100
            record.completion_event.set()
            logger.info(f"Job {job_id} analysis completed successfully.")

    async def run_cleanup_loop(self):
        """Infinite loop purger running in background cleaning files >1 hour old."""
        while True:
            try:
                await asyncio.sleep(300)  # Check every 5 minutes
                now = datetime.utcnow()
                expiration_limit = now - timedelta(hours=1)
                
                expired_job_ids = []
                for job_id, record in list(self.jobs.items()):
                    if record.created_at < expiration_limit:
                        # Only cleanup completed/failed/queued/done/error, NEVER running
                        if record.status in ("completed", "failed", "queued", "done", "error") and record.status != "running":
                            expired_job_ids.append(job_id)
                
                for job_id in expired_job_ids:
                    # Clean directory
                    job_dir = self.get_job_dir(job_id)
                    if job_dir.exists():
                        shutil.rmtree(job_dir, ignore_errors=True)
                    # Clean memory dict
                    self.jobs.pop(job_id, None)
                    logger.info(f"Purged expired job storage for {job_id}")
            except Exception as e:
                logger.error(f"Error in job manager cleanup: {e}")

# Global job manager singleton instance
job_manager = JobManager()
