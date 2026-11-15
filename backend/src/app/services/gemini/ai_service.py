import asyncio
import json

from fastapi import HTTPException
from google.genai import errors, types

from app.prompts.github_analysis import GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AIInput, AnalysisContext, RepoData
from app.services.gemini.assessment_service import assessment
from app.services.gemini.batch_service import create_batches
from app.services.gemini.client import client
from app.services.github.profile_service import repo_full_detail
from app.services.github.readme_service import get_readme
from app.services.github.repo_service import get_all_repos

BATCH_DELAY_SECONDS = 60


async def get_content(
    username: str, user_context: AnalysisContext | None = None, repos: list[RepoData] | None = None
) -> AIInput:
    if repos is None:
        repos = await get_all_repos(username)
    repo_detail, readme = await asyncio.gather(
        repo_full_detail(username, repos=repos), get_readme(username, repos=repos)
    )

    return AIInput(user_detail=repo_detail, readme=readme, user_context=user_context, repositories=repos)


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
            print(error)
            raise HTTPException(
                status_code=error.code if error.code in {429, 503, 504} else 502,
                detail="The analysis provider could not complete the request.",
            ) from error

        text = response.text
        if not text or not text.strip():
            raise HTTPException(
                status_code=502,
                detail=f"No analysis was returned for repository group {i + 1}.",
            )
        if response.candidates and response.candidates[0].finish_reason == types.FinishReason.MAX_TOKENS:
            raise HTTPException(
                status_code=502,
                detail=f"Repository group {i + 1} reached its output limit before completing.",
            )

        results.append(text)

    return await assessment(results, user_context=content.user_context)
