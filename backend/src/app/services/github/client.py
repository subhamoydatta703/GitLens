import asyncio
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]

URL = "https://api.github.com/users"
REPO_URL = "https://api.github.com/repos"

headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {GITHUB_TOKEN}",
}
client = httpx.AsyncClient(headers=headers)

semaphore = asyncio.Semaphore(5)
