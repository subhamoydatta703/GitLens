from fastapi import APIRouter

from app.services.github_service import get_profile, get_repo_commits, get_repo_languages, get_repos

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


@router.get("/{username}/{repo}/languages")
async def get_github_repo_languages(username: str, repo: str):
        return await get_repo_languages(username, repo)

@router.get("/{username}/repos")
async def get_github_repos(username:str):
    return await get_repos(username)
    


