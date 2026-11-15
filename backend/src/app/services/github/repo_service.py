import httpx
from fastapi import HTTPException

from app.schemas.github_schemas import RepoData
from app.services.github.client import URL, client, semaphore


async def get_all_repos(username: str) -> list[RepoData]:
    try:
        all_repos: list[RepoData] = []
        page = 1
        while True:
            async with semaphore:
                response = await client.get(f"{URL}/{username}/repos?per_page=100&page={page}")
            response.raise_for_status()

            for repo in response.json():
                all_repos.append(
                    RepoData(
                        repo=repo["name"],
                        default_branch=repo["default_branch"],
                        fork=repo["fork"],
                    )
                )

            if "next" not in response.links:
                break
            page += 1

        return all_repos

    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Could not fetch GitHub repositories",
        ) from e
