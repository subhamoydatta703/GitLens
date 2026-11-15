import asyncio

from app.schemas.github_schemas import GitHubProfile, RepoData
from app.services.github.tech_stack_service import get_tech_stack
from app.services.github.user_service import get_user


async def repo_full_detail(username: str, repos: list[RepoData] | None = None) -> list[GitHubProfile]:
    user, tech_stack = await asyncio.gather(
        get_user(username),
        get_tech_stack(username, repos=repos),
    )

    repo_details: list[GitHubProfile] = []

    repo_details.append(
        GitHubProfile(
            name=user.name,
            username=user.login,
            followers=user.followers,
            following=user.following,
            bio=user.bio,
            tech=tech_stack,
        )
    )

    return repo_details
