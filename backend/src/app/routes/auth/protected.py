from typing import Annotated
from uuid import UUID

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.models import ClerkBaseError, NoResponseError
from clerk_backend_api.security.types import RequestState
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.authentication import get_github_username, require_auth, require_user_id
from app.config.auth_config import Settings, get_settings
from app.config.db_config import get_db
from app.services.cache_service import get_cached_assessment, get_or_create_user

router = APIRouter(tags=["protected"])


@router.get("/me")
async def me(
    response: Response,
    state: Annotated[RequestState, Depends(require_auth)],
    user_id: Annotated[str, Depends(require_user_id)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[AsyncSession, Depends(get_db)],
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

    db_user = await get_or_create_user(db, user_id, username)
    assessment = await get_cached_assessment(
        db, user_id, UUID(db_user["id"]), db_user["username"]
    )

    return {
        "user_id": user_id,
        "session_id": payload.get("sid"),
        "github_username": username,
        "refresh_session": refresh_session,
        "db_user": db_user,
        "assessment": assessment.model_dump(mode="json") if assessment else None,
    }
