from pydantic import BaseModel
from typing import List, Optional, Dict

class JobUploadResponse(BaseModel):
    job_id: str
    filename: str
    size_bytes: int
    arch: str
    status: str = "queued"
    created_at: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    percent: int
    result_available: bool

class AnalysisResultResponse(BaseModel):
    job_id: str
    arch: str
    functions: List[str]
    strings: List[str]
    symbols: List[str]
    entry_point: str
    raw_assembly_snippet: str
    raw_c: Optional[str] = None
