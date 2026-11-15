import httpx
from fastapi import HTTPException

from app.schemas.github_schemas import GitHubUser
from app.services.github.client import URL, client


async def get_user(username: str) -> GitHubUser:
    try:
        response = await client.get(f"{URL}/{username}")
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Could not fetch GitHub user",
        ) from e

    data = response.json()

    return GitHubUser(
        name=data["name"],
        login=data["login"],
        followers=data["followers"],
        following=data["following"],
        bio=data["bio"]
    )
