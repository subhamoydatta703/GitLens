import asyncio
import os

import httpx
from dotenv import load_dotenv
from groq import Groq

from app.prompts.github_analysis import GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
from app.schemas.github_schemas import AIInput, AnalysisContext
from app.services.github_service import get_readme, repo_full_detail


load_dotenv()

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)


async def get_content(
    username: str, user_context: AnalysisContext | None = None
) -> AIInput:
    repo_detail, readme = await asyncio.gather(
        repo_full_detail(username), get_readme(username)
    )

    return AIInput(user_detail=repo_detail, readme=readme, user_context=user_context)


async def analyze(
    content: AIInput, system_instruction: str = GITHUB_ANALYSIS_SYSTEM_INSTRUCTION
):
    try:
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_instruction,
                },
                {
                    "role": "user",
                    "content": content.model_dump_json(),
                },
            ],
            model="openai/gpt-oss-120b",
        )
    except httpx.RequestError:
        return None

    return response.choices[0].message.content
