from typing import Annotated

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.models import ClerkBaseError, NoResponseError
from clerk_backend_api.security.types import RequestState
from fastapi import APIRouter, Depends, HTTPException, Response

from app.auth.authentication import get_github_username, require_auth, require_user_id
from app.config.auth_config import Settings, get_settings

router = APIRouter(tags=["protected"])


@router.get("/me")
async def me(
    response: Response,
    state: Annotated[RequestState, Depends(require_auth)],
    user_id: Annotated[str, Depends(require_user_id)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    response.headers["Cache-Control"] = "no-store"
    payload = state.payload or {}
    username = get_github_username(payload.get("github_username"))
    refresh_session = username is None
    if username is None:
        try:
            async with Clerk(bearer_auth=settings.clerk_secret_key, timeout_ms=10000) as clerk:
                user = await clerk.users.get_async(user_id=user_id)
                for account in user.external_accounts:
                    if account.provider in {"github", "oauth_github"}:
                        username = get_github_username(account.username)
                        if username:
                            break
                if username is None:
                    raise HTTPException(status_code=403, detail="A connected GitHub username is required.")
                if user.public_metadata.get("github_username") != username:
                    await clerk.users.update_metadata_async(
                        user_id=user_id, public_metadata={"github_username": username}
                    )
        except (ClerkBaseError, NoResponseError, httpx.RequestError) as error:
            raise HTTPException(status_code=502, detail="Could not load your connected GitHub account.") from error

    return {
        "user_id": user_id,
        "session_id": payload.get("sid"),
        "github_username": username,
        "refresh_session": refresh_session,
    }
