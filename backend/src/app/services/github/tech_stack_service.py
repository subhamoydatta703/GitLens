import asyncio
import base64

import httpx

from app.schemas.github_schemas import RepoData, TechFilesDetails
from app.services.github.client import REPO_URL, client, semaphore
from app.services.github.tree_service import get_project_tree


async def get_pkg_data(username: str, repo: str, path: str):
    async with semaphore:
        try:
            response = await client.get(f"{REPO_URL}/{username}/{repo}/contents/{path}")
        except httpx.RequestError:
            return None

    if response.status_code != 200:
        return None

    return response.json()


async def get_tech_stack(username: str, repos: list[RepoData] | None = None) -> list[TechFilesDetails]:
    tech_files: list[TechFilesDetails] = []
    try:
        repo_pkg_data = await get_project_tree(username, repos=repos)

        results = await asyncio.gather(
            *(get_pkg_data(username, data.repo, data.path) for data in repo_pkg_data)
        )

        for data, file_data in zip(repo_pkg_data, results):
            if file_data is None:
                continue

            encoded_content = file_data.get("content")
            if not encoded_content:
                continue
            content = base64.b64decode(encoded_content).decode("utf-8")

            tech_files.append(
                TechFilesDetails(
                    repo=data.repo,
                    file_name=file_data["name"],
                    file_path=file_data["path"],
                    file_content=content,
                )
            )
    except httpx.RequestError as error:
        print("GitHub request failed:", error)
        return []

    return tech_files
