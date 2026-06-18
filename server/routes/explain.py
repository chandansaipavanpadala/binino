import os
import json
import logging
import asyncio
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from server.models.schemas import ExplainRequest
from anthropic import AsyncAnthropic

router = APIRouter(prefix="/api")
logger = logging.getLogger("binino.explain")

# System prompt configured for embedded decompilation analysis
SYSTEM_PROMPT = (
    "You are a senior embedded systems reverse engineer analysing decompiled firmware. "
    "Explain in clear, technical English: "
    "1) What this function does at a high level. "
    "2) What hardware components or peripherals it likely interacts with. "
    "3) Notable patterns — loops, memory operations, peripheral register writes. "
    "4) Any suspicious or notable patterns an auditor should review. "
    "Keep response under 300 words. Plain paragraphs — no markdown headers."
)

async def simulated_explain_generator(req: ExplainRequest):
    """Generates realistic decompiler analysis descriptions for Demo Mode."""
    fn = req.function_name.lower()
    
    if "init" in fn:
        text = (
            "This function initializes core hardware peripherals and system clocks. "
            "It writes to the PLL registers (specifically setting CPU PLL clock modes at offset 0x3FF00044) "
            "and explicitly disables the watchdog timer at 0x60000900 to prevent resets during boot. "
            "Auditors should check if the watchdog is re-enabled later in the firmware runtime."
        )
    elif "wifi" in fn or "connect" in fn:
        text = (
            "This function establishes a connection to a wireless access point. "
            "It checks for SSID and password nullity, and enters a register-polling loop at 0x60001000 "
            "waiting for the WiFi connection status flag. It has a retry limit of 5 and calls vTaskDelay "
            "to yield execution control. A potential issue is the blocking nature of the wait loop if task context yields fail."
        )
    elif "packet" in fn or "process" in fn:
        text = (
            "This function parses a 32-bit packet frame. It extracts type, length, and a checksum byte, "
            "verifies the checksum natively, and directs control flow based on packet type (PING or SENSOR_DATA). "
            "It logs errors on checksum failure. Auditors should verify if length validations are performed "
            "to prevent buffer overflows on payload processing."
        )
    elif "sensor" in fn or "read" in fn or "adc" in fn:
        text = (
            "This function triggers and reads data from an Analog-to-Digital Converter (ADC). "
            "It controls the trigger flag at 0x60002100, polls for the end-of-conversion status flag, "
            "reads the ADC value at 0x60002104, and packs it into a formatted 32-bit sensor data frame. "
            "Auditors should inspect the busy-waiting loop to ensure it cannot lock the CPU permanently."
        )
    elif "log" in fn or "write" in fn:
        text = (
            "This function writes logging messages. It checks the message pointer for nullity and "
            "prints the message prefix to the console. It is a utility function with minimal hardware interaction."
        )
    else:
        text = (
            f"This function, {req.function_name}, appears to perform general application logic. "
            f"It runs on the {req.arch.upper()} architecture. It features a sequence of local variable assignments, "
            "register reads, and branch logic. The flow suggests standard initialization or utility operations. "
            "Review the caller to verify context and input validation bounds."
        )

    words = text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield {
            "event": "token",
            "data": json.dumps({"token": chunk})
        }
        await asyncio.sleep(0.04)  # 40ms typewriter speed

    yield {
        "event": "done",
        "data": json.dumps({"tokens_used": len(words) * 2})
    }

async def real_explain_generator(api_key: str, req: ExplainRequest):
    """Queries Anthropic API directly and streams text tokens back."""
    client = AsyncAnthropic(api_key=api_key)
    
    try:
        user_content = (
            f"Function Name: {req.function_name}\n"
            f"Architecture: {req.arch}\n\n"
            f"Decompiled Pseudo-C:\n{req.pseudo_c}\n\n"
            f"Extracted Strings Context:\n{', '.join(req.context_strings[:10])}\n\n"
            f"Global Symbols Context:\n{', '.join(req.context_symbols[:10])}"
        )
        
        response = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_content}
            ],
            stream=True
        )
        
        input_tokens = 0
        output_tokens = 0
        
        async for chunk in response:
            if chunk.type == "message_start":
                input_tokens = chunk.message.usage.input_tokens
            elif chunk.type == "content_block_delta" and chunk.delta.type == "text_delta":
                yield {
                    "event": "token",
                    "data": json.dumps({"token": chunk.delta.text})
                }
            elif chunk.type == "message_delta":
                output_tokens = chunk.usage.output_tokens
                
        yield {
            "event": "done",
            "data": json.dumps({"tokens_used": input_tokens + output_tokens})
        }
    except Exception as e:
        logger.error(f"Claude API query exception: {e}")
        yield {
            "event": "error",
            "data": json.dumps({"message": f"Anthropic connection failed: {str(e)}"})
        }

@router.post("/explain")
async def explain_function(req: ExplainRequest):
    """Endpoint facilitating real-time streamed explanations of decompiled logic."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    
    if not api_key:
        logger.info(f"ANTHROPIC_API_KEY is not defined. Initiating simulated explanation stream for: {req.function_name}")
        return EventSourceResponse(simulated_explain_generator(req))
    else:
        logger.info(f"Connecting to Anthropic API to decompile function: {req.function_name}")
        return EventSourceResponse(real_explain_generator(api_key, req))
