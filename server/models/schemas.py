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

class FunctionRecord(BaseModel):
    name: str
    address: str
    size: Optional[int] = None
    pseudo_c: str
    assembly: Optional[str] = None

class StringRecord(BaseModel):
    address: str
    value: str
    encoding: Optional[str] = None

class SymbolRecord(BaseModel):
    address: str
    name: str
    type: Optional[str] = None

class AnalysisResultResponse(BaseModel):
    job_id: str
    arch: str
    functions: List[FunctionRecord]
    strings: List[StringRecord]
    symbols: List[SymbolRecord]
    entry_point: str
    raw_assembly_snippet: str
    simulated: Optional[bool] = None

