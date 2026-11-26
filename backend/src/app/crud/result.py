from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.assessment_model import Assessment



# get report
async def get_report(db: AsyncSession, clerk_user_id: str)-> Assessment | None:
    stmt = select(Assessment).where(
    Assessment.clerk_user_id == clerk_user_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# create report
async def create_report(db: AsyncSession, clerk_id: str, report: str)-> Assessment:
    data = Assessment(report=report, clerk_id=clerk_id)
    db.add(data)
    await db.commit()
    await db.refresh(data)
    return data
