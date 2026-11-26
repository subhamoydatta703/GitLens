import os

from dotenv import load_dotenv
from redis.asyncio import Redis, from_url

load_dotenv()

REDIS_URL = os.environ["REDIS_URL"]

# async redis client for caching
redis_client: Redis = from_url(REDIS_URL, decode_responses=True)


async def close_redis() -> None:
    await redis_client.aclose()
