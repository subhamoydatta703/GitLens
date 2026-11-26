from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_model import GithubUser


# get user
async def get_user(db: AsyncSession, clerk_id:str)-> GithubUser | None:
    stmt = select(GithubUser).where(
    GithubUser.clerk_user_id == clerk_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# create user
async def create_user(db: AsyncSession, clerk_id: str, username:str)-> GithubUser:
    user = GithubUser(clerk_user_id=clerk_id, username=username)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
