
import httpx
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
print(GITHUB_TOKEN)
URL="https://api.github.com/users"

headers ={
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {GITHUB_TOKEN}",
}
client = httpx.AsyncClient(headers=headers)
# get github user
async def get_user(username:str):
    response = await client.get(f"{URL}/{username}")
    print("STATUS:", response.status_code)
    print("CONTENT-TYPE:", response.headers.get("content-type"))
    print("BODY:", response.text)
    return response.json()

# get github repos of the user

async def get_repos(username:str):
    response = await client.get(f"{URL}/{username}/repos")
    return response.json()    



# get github profile of the user

async def get_profile(username:str):
    user, repos = await asyncio.gather(
        get_user(username),
        get_repos(username)
    )
    return{
        "user":user,
        "repos":repos
    }

    