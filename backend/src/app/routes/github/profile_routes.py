from fastapi import APIRouter

from app.services.github.profile_service import repo_full_detail
from app.services.github.user_service import get_user

router = APIRouter()


@router.get("/{username}")
async def get_github_profile(username: str):
    return await get_user(username)


@router.get("/{username}/repo/detail")
async def repo_detail(username: str):
    return await repo_full_detail(username)
