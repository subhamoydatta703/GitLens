from fastapi import APIRouter

from app.services.github.evidence_service import prepare_content

router = APIRouter()


@router.post("/{username}/evidence")
async def prepare_github_evidence(username: str):
    evidence = await prepare_content(username)
    return {
        "evidence_id": evidence.evidence_id,
        "expires_at": evidence.expires_at,
        "repositories": evidence.content.repositories,
        "tech": [file for profile in evidence.content.user_detail for file in profile.tech],
    }
