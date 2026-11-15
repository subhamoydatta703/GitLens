import asyncio
from time import time
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel

from app.schemas.github_schemas import AIInput, AnalysisContext
from app.services.gemini.ai_service import get_content


class SavedEvidence(BaseModel):
    evidence_id: str
    expires_at: float
    content: AIInput


saved_content: dict[str, SavedEvidence] = {}
pending_content: dict[str, asyncio.Task[SavedEvidence]] = {}
EVIDENCE_TTL_SECONDS = 600
MAX_SAVED_PROFILES = 20


async def _collect_content(username: str) -> SavedEvidence:
    try:
        content = await get_content(username)
        evidence = SavedEvidence(
            evidence_id=uuid4().hex,
            expires_at=time() + EVIDENCE_TTL_SECONDS,
            content=content,
        )
        # Only completed collections become available for analysis.
        if len(saved_content) >= MAX_SAVED_PROFILES:
            oldest = min(saved_content, key=lambda name: saved_content[name].expires_at)
            del saved_content[oldest]
        saved_content[username] = evidence
        return evidence
    finally:
        pending_content.pop(username, None)


async def prepare_content(username: str) -> SavedEvidence:
    username = username.lower()
    for name in list(saved_content):
        if saved_content[name].expires_at <= time():
            del saved_content[name]

    if username in saved_content:
        return saved_content[username]

    if username not in pending_content:
        task = asyncio.create_task(_collect_content(username))
        pending_content[username] = task
        task.add_done_callback(lambda done: None if done.cancelled() else done.exception())

    # One browser cancelling must not cancel a shared collection.
    return await asyncio.shield(pending_content[username])


def get_saved_content(
    username: str,
    user_context: AnalysisContext | None = None,
    evidence_id: str | None = None,
) -> AIInput:
    username = username.lower()
    evidence = saved_content.get(username)
    if evidence is None or evidence.expires_at <= time():
        saved_content.pop(username, None)
        raise HTTPException(409, "Reload the profile to prepare its analysis evidence.")
    if evidence_id is not None and evidence.evidence_id != evidence_id:
        raise HTTPException(409, "The analysis evidence changed. Reload the profile.")

    return evidence.content.model_copy(update={"user_context": user_context}, deep=True)
