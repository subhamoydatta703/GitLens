from fastapi import APIRouter

from app.services.github.repo_service import get_all_repos

router = APIRouter()


@router.get("/{username}/repos")
async def get_github_repos(username: str):
    return await get_all_repos(username)
