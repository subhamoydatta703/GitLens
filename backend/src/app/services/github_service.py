
from logging import raiseExceptions

import httpx
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

URL="https://api.github.com/users"

headers ={
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {GITHUB_TOKEN}",
}
client = httpx.AsyncClient(headers=headers)
# get github user
async def get_user(username:str):
    try:
        response = await client.get(f"{URL}/{username}")

        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
            
        }

# get github repos of the user

async def get_repos(username:str):
    try:
        response = await client.get(f"{URL}/{username}/repos")
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
            
        }    

async def get_repo_commits(username:str, repo: str):
    try:
        response = await client.get(f"https://api.github.com/repos/{username}/{repo}/commits")
        return response.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
            
        }
# get github profile of the user

async def get_profile(username:str):
    try:
        user, repos = await asyncio.gather(
            get_user(username),
            get_repos(username)
        )
        return{
            "user":user,
            "repos":repos
        }
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
            
        }

# repo languages
async def get_repo_languages(username: str, repo: str):
    try:
        languages = await client.get(f"https://api.github.com/repos/{username}/{repo}/languages")
        # print(languages.content)
        print()
        # print("Languages\n", languages)
        languages.raise_for_status()
        return languages.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
        }
        
    
