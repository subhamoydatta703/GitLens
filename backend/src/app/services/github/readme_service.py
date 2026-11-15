import httpx
from fastapi import HTTPException

from app.schemas.github_schemas import ReadmeResponse, RepoData
from app.services.github.client import REPO_URL, client
from app.services.github.repo_service import get_all_repos


async def get_readme(username: str, repos: list[RepoData] | None = None) -> list[ReadmeResponse]:

    try:
        if repos is None:
            repos = await get_all_repos(username)
        readme_data: list[ReadmeResponse] = []

        for repo in repos:
            repo_name = repo.repo

            response = await client.get(
                f"{REPO_URL}/{username}/{repo_name}/readme",
                headers={"Accept": "application/vnd.github.raw+json"},
            )
            readme_data.append(ReadmeResponse(
                repo=repo_name,
                readme=response.text
            ))
        return readme_data

    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Could not fetch GitHub repositories",
        ) from e
