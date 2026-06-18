from pydantic import BaseModel
from typing import List, Optional, Dict, Any

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
    flash_base: int
    mcu_profile: Dict[str, Any]

class ExplainRequest(BaseModel):
    function_name: str
    arch: str
    pseudo_c: str
    context_strings: List[str] = []
    context_symbols: List[str] = []

class MCUProfileModel(BaseModel):
    mcu_id: str
    display_name: str
    family: str
    protocol: str
    ghidra_lang: str
    default_baud: int
    flash_base: int
    default_flash_size: int
    flash_sizes: List[int]
    bootloader_note: str
    requires_tool: Optional[str] = None
    read_protected: bool = False
    supported: bool = True

class MCUListResponse(BaseModel):
    mcus: Dict[str, MCUProfileModel]


