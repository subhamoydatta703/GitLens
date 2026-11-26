from fastapi import APIRouter

from app.services.github.user_service import get_user

router = APIRouter()


@router.get("/{username}")
async def get_github_profile(username: str):
    return await get_user(username)
