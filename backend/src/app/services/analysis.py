import json

from app.prompts.github_analysis import GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AIInput
from app.services.assessment_service import assessment
from app.services.batch_service import create_batches
from app.services.openrouter.ai_service import generate_content
from fastapi import HTTPException
import asyncio


BATCH_DELAY_SECONDS=60
async def analyze(
    content: AIInput, system_instruction: str = GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
):
    batches = create_batches(content)
    results = []

    if not batches:
        raise HTTPException(
            status_code=422,
            detail="No README or technical evidence is available for analysis.",
        )

    for i, batch in enumerate(batches):
        if i > 0:
            await asyncio.sleep(BATCH_DELAY_SECONDS)

        payload = json.dumps(batch, ensure_ascii=False)

        text = await generate_content(payload, system_instruction)

        results.append(text)

    return await assessment(results, user_context=content.user_context)