import base64
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from server.services.runtime_detector import detect_runtime

router = APIRouter(prefix="/api")
logger = logging.getLogger("binino.detect")

class DetectRequest(BaseModel):
    port_data: str  # Base64 encoded string
    arch: str

class DetectResponse(BaseModel):
    runtime: str
    confidence: str
    runtime_version: Optional[str] = None
    action: str
    message: str
    filesystem_commands: Optional[Dict[str, str]] = None
    frozen_module_hint: bool = False

@router.post("/detect", response_model=DetectResponse)
async def detect_mcu_runtime(req: DetectRequest):
    """
    Decodes the first 512 bytes of serial port data and detects
    whether the microcontroller is running an interpreted runtime.
    """
    logger.info(f"Received detection request for architecture: {req.arch}")
    
    try:
        # Decode base64 bytes
        if req.port_data:
            decoded_bytes = base64.b64decode(req.port_data)
            decoded_text = decoded_bytes.decode("latin-1")
        else:
            decoded_text = ""
    except Exception as e:
        logger.error(f"Error decoding base64 port data: {e}")
        decoded_text = ""

    result = detect_runtime(decoded_text, req.arch)
    logger.info(f"Detection result: {result['runtime']} (confidence: {result['confidence']})")
    
    return result
