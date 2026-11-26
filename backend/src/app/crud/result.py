from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.assessment_model import Assessment
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func


# get report
async def get_report(db: AsyncSession, clerk_id: str)-> Assessment | None:
    stmt = select(Assessment).where(
    Assessment.clerk_user_id == clerk_id,
    Assessment.expires_at > func.now()
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# create report
async def create_report(db: AsyncSession, clerk_id: str, report: str)-> Assessment:
    data = Assessment(report=report, clerk_user_id=clerk_id, expires_at=datetime.now(timezone.utc) + timedelta(days=3))
    db.add(data)
    await db.commit()
    await db.refresh(data)
    return data
