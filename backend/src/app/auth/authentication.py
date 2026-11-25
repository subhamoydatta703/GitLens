import re
from typing import Annotated

from clerk_backend_api import AuthenticateRequestOptions, authenticate_request
from clerk_backend_api.security.types import RequestState
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config.auth_config import Settings, get_settings

http_bearer = HTTPBearer(auto_error=False)
GITHUB_USERNAME_PATTERN = re.compile(r"[A-Za-z0-9-]{1,39}")


def require_auth(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    _creds: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)] = None,
) -> RequestState:
    state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=settings.clerk_secret_key,
            jwt_key=settings.clerk_jwt_key,
            authorized_parties=settings.clerk_authorized_parties,
            accepts_token=["session_token"],
        ),
    )
    if not state.is_signed_in:
        raise HTTPException(
            status_code=401,
            detail=state.reason.name if state.reason else "unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return state


def require_user_id(state: Annotated[RequestState, Depends(require_auth)]) -> str:
    user_id = (state.payload or {}).get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Missing session user")
    return user_id


def get_github_username(value: object) -> str | None:
    if isinstance(value, str) and GITHUB_USERNAME_PATTERN.fullmatch(value):
        return value
    return None


def require_own_github_profile(
    username: str, state: Annotated[RequestState, Depends(require_auth)]
) -> str:
    github_username = get_github_username((state.payload or {}).get("github_username"))
    if github_username is None or github_username.lower() != username.lower():
        raise HTTPException(status_code=403, detail="Use your connected GitHub profile.")
    return github_username
