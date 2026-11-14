import asyncio

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException
from google import genai
from google.genai import types

from app.prompts.github_analysis import GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AIInput, AnalysisContext
from app.services.github_service import get_readme, repo_full_detail

client = genai.Client()


async def get_content(
    username: str, user_context: AnalysisContext | None = None
) -> AIInput:
    repo_detail, readme = await asyncio.gather(
        repo_full_detail(username), get_readme(username)
    )

    return AIInput(
        user_detail=repo_detail, readme=readme, user_context=user_context
    )


async def analyze(
    content: AIInput, system_instruction: str = GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
):
    try:
        response = await client.aio.models.generate_content(
            model="gemini-3.6-flash",
            contents=content.model_dump_json(),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=8192,
                temperature=0.3,
            ),
        )
    except httpx.RequestError:
        return None

    return response.text
