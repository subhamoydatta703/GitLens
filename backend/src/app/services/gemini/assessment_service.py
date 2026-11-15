import json

from fastapi import HTTPException
from google.genai import errors, types

from app.prompts.github_assessment import GITHUB_ASSESSMENT_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AnalysisContext
from app.services.gemini.client import client


async def assessment(
    results: list[str],
    user_context: AnalysisContext | None = None,
    system_instruction: str = GITHUB_ASSESSMENT_SYSTEM_INSTRUCTION,
):
    payload = json.dumps({
        "findings": results,
        "user_context": user_context.model_dump() if user_context else None,
    }, ensure_ascii=False)

    try:
        response = await client.aio.models.generate_content(
            model="gemini-3.6-flash",
            contents=payload,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=8192,
                temperature=0.3,
            ),
        )
    except errors.APIError as error:
        raise HTTPException(
            status_code=error.code if error.code in {429, 503, 504} else 502,
            detail="The analysis provider could not complete the final assessment.",
        ) from error

    text = response.text
    if not text or not text.strip():
        raise HTTPException(
            status_code=502,
            detail="No final assessment was returned.",
        )
    if response.candidates and response.candidates[0].finish_reason == types.FinishReason.MAX_TOKENS:
        raise HTTPException(
            status_code=502,
            detail="The final assessment reached its output limit before completing.",
        )

    return text
