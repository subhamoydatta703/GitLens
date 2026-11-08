import os

from dotenv import load_dotenv
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

# 1. Engine + connection pool
engine = create_async_engine(
    DATABASE_URL, pool_size=5, max_overflow=5, pool_timeout=30, pool_pre_ping=True
)

# 2. Session factory
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


# 3. FastAPI database dependency
async def get_db():
    async with SessionLocal() as session:
        yield session
