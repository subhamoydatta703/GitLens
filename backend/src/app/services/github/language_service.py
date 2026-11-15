import asyncio

import httpx

from app.schemas.github_schemas import RepoLanguage
from app.services.github.client import REPO_URL, client, semaphore
from app.services.github.repo_service import get_all_repos


async def get_repo_languages(username: str, repo: str):
    try:
        languages = await client.get(f"{REPO_URL}/{username}/{repo}/languages")
        languages.raise_for_status()
        print(languages.json())
        return languages.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return {"success": False, "message": "Internal server error"}


async def get_repo_lang_fn(username: str, repo: str) -> list[RepoLanguage]:
    async with semaphore:
        try:
            languages = await get_repo_languages(username, repo)
        except httpx.RequestError:
            return []

        if languages.get("success") is False:
            return []

        languages_data: list[RepoLanguage] = []

        for language, byte_count in languages.items():
            languages_data.append(
                RepoLanguage(
                    repo=repo,
                    language=language,
                    byte=byte_count
                )
            )

        return languages_data


async def get_all_lan(username: str) -> list[list[RepoLanguage]]:
    repos = await get_all_repos(username)

    results = await asyncio.gather(
        *(get_repo_lang_fn(username, repo.repo) for repo in repos)
    )


    return results
