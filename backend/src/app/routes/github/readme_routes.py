from fastapi import APIRouter

from app.services.github.readme_service import get_readme

router = APIRouter()


@router.get("/{username}/readme")
async def get_github_repo_readme(username: str):
    return await get_readme(username)
