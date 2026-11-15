from app.services.groq.groq_service import analyze, get_content
from app.schemas.github_schemas import AnalysisContext
from fastapi import APIRouter

from app.services.github_service import (
    get_all_lan,
    get_project_tree,
    get_readme,
    get_repo_commits,
    get_repo_languages,
    get_repos,
    get_tech_stack,
    get_user,
    repo_full_detail,
)

router = APIRouter(
    prefix="/github",
    tags=["github"],
)


@router.get("/{username}")
async def get_github_profile(username: str):
    return await get_user(username)

@router.get("/{username}/{repo}/commits")
async def get_github_repo_commits(username: str, repo: str):
    return await get_repo_commits(username, repo)


@router.get("/{username}/{repo}/languages")
async def get_github_repo_languages(username: str, repo: str):
    return await get_repo_languages(username, repo)

@router.get("/{username}/repos")
async def get_github_repos(username: str):
    return await get_repos(username)

@router.get("/{username}/repos/language-stats")
async def get_github_all_repo_lan(username: str):
    return await get_all_lan(username)

@router.get("/{username}/readme")
async def get_github_repo_readme(username: str):
    return await get_readme(username)

@router.get("/{username}/tech-stack")
async def get_user_tech_stacks(username: str):
    return await get_tech_stack(username)

@router.get("/{username}/get-tree")
async def get_tree(username: str):
    return await get_project_tree(username)

@router.get("/{username}/repo/detail")
async def repo_detail(username: str):
    return await repo_full_detail(username)

@router.get("/{username}/analyze")
async def github_analyze(username: str):
    content = await get_content(username)
    analysis = await analyze(content)
    return {"analysis": analysis}


@router.post("/{username}/analyze")
async def github_analyze_with_context(username: str, user_context: AnalysisContext):
    content = await get_content(username, user_context=user_context)
    analysis = await analyze(content)
    return {"analysis": analysis}
