import json

from app.prompts.github_assessment import GITHUB_ASSESSMENT_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AnalysisContext
from app.services.openrouter.ai_service import generate_content


async def assessment(
    results: list[str],
    user_context: AnalysisContext | None = None,
    system_instruction: str = GITHUB_ASSESSMENT_SYSTEM_INSTRUCTION,
):
    payload = json.dumps({
        "findings": results,
        "user_context": user_context.model_dump() if user_context else None,
    }, ensure_ascii=False)

    return await generate_content(payload, system_instruction)
