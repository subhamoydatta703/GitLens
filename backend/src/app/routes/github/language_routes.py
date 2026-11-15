from fastapi import APIRouter

from app.services.github.language_service import get_all_lan, get_repo_languages

router = APIRouter()


@router.get("/{username}/{repo}/languages")
async def get_github_repo_languages(username: str, repo: str):
    return await get_repo_languages(username, repo)


@router.get("/{username}/repos/language-stats")
async def get_github_all_repo_lan(username: str):
    return await get_all_lan(username)
