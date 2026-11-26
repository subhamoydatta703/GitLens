from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.config.db_config import SessionLocal
from app.crud.result import create_report, get_report
from app.schemas.github_schemas import AIInput
from app.services.analysis import analyze
from app.services.cache_service import (
    cache_assessment,
    get_cached_assessment,
    get_or_create_user,
)


async def _get_existing_report(clerk_id: str, username: str) -> str | None:
    async with SessionLocal() as db:
        db_user = await get_or_create_user(db, clerk_id, username)
        existing = await get_cached_assessment(
            db, clerk_id, UUID(db_user["id"]), db_user["username"]
        )
        return existing.report if existing is not None else None


async def _save_completed_report(clerk_id: str, username: str, analysis: str) -> None:
    async with SessionLocal() as db:
        db_user = await get_or_create_user(db, clerk_id, username)
        existing = await get_report(db, clerk_id)
        if existing is not None:
            await cache_assessment(
                clerk_id, UUID(db_user["id"]), db_user["username"], existing
            )
            return

        try:
            saved = await create_report(db, clerk_id, analysis)
        except IntegrityError:
            await db.rollback()
            return

        await cache_assessment(
            clerk_id, UUID(db_user["id"]), db_user["username"], saved
        )


async def process(job, token):
    content = AIInput.model_validate(job.data)
    clerk_id = job.data.get("owner_id") if isinstance(job.data, dict) else None
    username = content.user_detail[0].username if content.user_detail else ""

    # return existing report within the 3-day window without re-running AI
    if isinstance(clerk_id, str) and clerk_id:
        existing_report = await _get_existing_report(clerk_id, username)
        if existing_report is not None:
            return {"analysis": existing_report}

    try:
        analysis = await analyze(content)
    except HTTPException as error:
        raise RuntimeError(str(error.detail)) from error

    if isinstance(clerk_id, str) and clerk_id:
        await _save_completed_report(clerk_id, username, analysis)

    return {"analysis": analysis}