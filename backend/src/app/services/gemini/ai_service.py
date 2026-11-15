import asyncio
from logging import raiseExceptions

import httpx
from fastapi import HTTPException
from google import genai
from google.genai import errors, types

from app.prompts.github_analysis import GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AIInput, AnalysisContext
from app.services.github.profile_service import repo_full_detail
from app.services.github.readme_service import get_readme
from app.services.github.repo_service import get_all_repos

client = genai.Client()


async def get_content(
    username: str, user_context: AnalysisContext | None = None
) -> AIInput:
    repos = await get_all_repos(username)
    repo_detail, readme = await asyncio.gather(
        repo_full_detail(username, repos=repos), get_readme(username, repos=repos)
    )

    return AIInput(user_detail=repo_detail, readme=readme, user_context=user_context, repositories=repos)



async def analyze(
    content: AIInput, system_instruction: str = GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
):
    payload = content.model_dump_json()

    try:
        token_count = await client.aio.models.count_tokens(
            model="gemini-3.5-flash-lite",
            contents=[system_instruction, payload],
        )
        print("Estimated input tokens (system instruction and payload as text):", token_count.total_tokens)

        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=payload,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=8192,
                temperature=0.3,
            ),
        )

    except errors.APIError as error:
        print(error)
        raise HTTPException(
            status_code=error.code if error.code in {429, 503, 504} else 502,
            detail="The analysis provider could not complete the request.",
        ) from error

    return response.text
