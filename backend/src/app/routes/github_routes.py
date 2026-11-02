from fastapi import APIRouter

from app.controller.github_controller import get_profile

router = APIRouter(
    prefix="/github",
    tags=["github"],
)

@router.get("/{username}")
async def get_github_profile(username:str):
    return  await get_profile(username)
    


