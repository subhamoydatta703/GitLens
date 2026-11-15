from fastapi import APIRouter

from app.services.github.tech_stack_service import get_tech_stack

router = APIRouter()


@router.get("/{username}/tech-stack")
async def get_user_tech_stacks(username: str):
    return await get_tech_stack(username)
