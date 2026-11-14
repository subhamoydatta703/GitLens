import asyncio

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException
from google import genai
from google.genai import types

from app.prompts.github_analysis import GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AIInput
from app.services.github_service import get_readme, repo_full_detail

client = genai.Client()


async def get_all_input(username: str) -> AIInput:
    repo_detail, readme = await asyncio.gather(
        repo_full_detail(username), get_readme(username)
    )

    return AIInput(user_detail=repo_detail, readme=readme)


async def analyze(
    content: AIInput, system_instruction: str = GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
):
    try:
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=content.model_dump_json(),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=1000,
                temperature=0.3,
            ),
        )
    except httpx.RequestError:
        return None

    return response.text
