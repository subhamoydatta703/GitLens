from fastapi import APIRouter

from app.controller.github_controller import get_profile, get_repo_commits

router = APIRouter(
    prefix="/github",
    tags=["github"],
)

@router.get("/{username}")
async def get_github_profile(username:str):
    return  await get_profile(username)

@router.get("/{username}/{repo}/commits")
async def get_github_repo_commits(username:str, repo:str):
        return await get_repo_commits(username, repo)
    


