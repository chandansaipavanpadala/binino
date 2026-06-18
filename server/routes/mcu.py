import logging
from fastapi import APIRouter
from server.registry.mcu_registry import MCU_REGISTRY
from server.models.schemas import MCUListResponse

router = APIRouter(prefix="/api")
logger = logging.getLogger("binino.mcu")

@router.get("/mcu/list", response_model=MCUListResponse)
async def get_mcu_list():
    """Returns the full microcontroller registry profiles mapped by mcu_id."""
    logger.info("Received request for supported microcontrollers list")
    return {"mcus": {mcu_id: profile.to_dict() for mcu_id, profile in MCU_REGISTRY.items()}}
