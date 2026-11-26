import json
from datetime import datetime, timezone
from uuid import UUID

from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.redis_config import redis_client
from app.crud.result import get_report
from app.crud.user import create_user, get_user
from app.models.assessment_model import Assessment
from app.schemas.report_schemas import SavedAssessment

USER_CACHE_TTL_SECONDS = 3600
ASSESSMENT_CACHE_TTL_SECONDS = 3600
ASSESSMENT_MISS_TTL_SECONDS = 300
NO_ASSESSMENT_MARKER = "__none__"


def _user_cache_key(clerk_id: str) -> str:
    return f"user:{clerk_id}"


def _assessment_cache_key(clerk_id: str) -> str:
    return f"assessment:{clerk_id}"


def _remaining_ttl_seconds(expires_at: datetime) -> int:
    remaining = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    return max(1, min(ASSESSMENT_CACHE_TTL_SECONDS, remaining))


async def get_or_create_user(
    db: AsyncSession, clerk_id: str, username: str
) -> dict[str, str]:
    cache_key = _user_cache_key(clerk_id)

    # check redis cache first
    try:
        cached = await redis_client.get(cache_key)
        if cached is not None:
            return json.loads(cached)
    except (RedisError, ValueError):
        pass

    # cache miss: check db, create if not present
    user = await get_user(db, clerk_id)
    if user is None:
        user = await create_user(db, clerk_id, username)

    user_data = {
        "id": str(user.id),
        "clerk_user_id": user.clerk_user_id,
        "username": user.username,
    }

    try:
        await redis_client.set(
            cache_key, json.dumps(user_data), ex=USER_CACHE_TTL_SECONDS
        )
    except RedisError:
        pass

    return user_data


async def cache_assessment(
    clerk_id: str, user_id: UUID, username: str, report: Assessment
) -> SavedAssessment:
    saved = SavedAssessment(
        user_id=user_id,
        username=username,
        report=report.report,
        created_at=report.created_at,
    )
    try:
        await redis_client.set(
            _assessment_cache_key(clerk_id),
            saved.model_dump_json(),
            ex=_remaining_ttl_seconds(report.expires_at),
        )
    except RedisError:
        pass
    return saved


async def get_cached_assessment(
    db: AsyncSession, clerk_id: str, user_id: UUID, username: str
) -> SavedAssessment | None:
    cache_key = _assessment_cache_key(clerk_id)

    # check redis cache first
    try:
        cached = await redis_client.get(cache_key)
        if cached is not None:
            if cached == NO_ASSESSMENT_MARKER:
                return None
            return SavedAssessment.model_validate_json(cached)
    except (RedisError, ValueError):
        pass

    # cache miss: check db
    report = await get_report(db, clerk_id)
    if report is None:
        try:
            await redis_client.set(
                cache_key, NO_ASSESSMENT_MARKER, ex=ASSESSMENT_MISS_TTL_SECONDS
            )
        except RedisError:
            pass
        return None

    return await cache_assessment(clerk_id, user_id, username, report)
