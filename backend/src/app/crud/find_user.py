from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_model import GithubUser


# create user
async def create_user(db: AsyncSession, clerk_id: str, username:str):
    user = GithubUser(clerk_user_id=clerk_id, username=username)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# get user
async def get_user(db: AsyncSession, clerk_id:str):
    stmt = select(GithubUser).where(
    GithubUser.clerk_user_id == clerk_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
