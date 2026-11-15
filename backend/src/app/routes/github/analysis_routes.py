from fastapi import APIRouter

from app.schemas.github_schemas import AnalysisContext
from app.services.gemini.ai_service import analyze
from app.services.github.evidence_service import get_saved_content

router = APIRouter()


@router.get("/{username}/analyze")
async def github_analyze(username: str, evidence_id: str | None = None):
    content = get_saved_content(username, evidence_id=evidence_id)
    analysis = await analyze(content)
    return {"analysis": analysis}


@router.post("/{username}/analyze")
async def github_analyze_with_context(username: str, user_context: AnalysisContext, evidence_id: str | None = None):
    content = get_saved_content(username, user_context=user_context, evidence_id=evidence_id)
    analysis = await analyze(content)
    return {"analysis": analysis}
