from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.authentication import require_own_github_profile
from app.services.github.evidence_service import prepare_content

router = APIRouter()


@router.post("/{username}/evidence")
async def prepare_github_evidence(
    github_username: Annotated[str, Depends(require_own_github_profile)],
):
    evidence = await prepare_content(github_username)
    return {
        "evidence_id": evidence.evidence_id,
        "expires_at": evidence.expires_at,
        "repositories": evidence.content.repositories,
        "tech": [file for profile in evidence.content.user_detail for file in profile.tech],
    }
