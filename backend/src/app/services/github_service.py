
from logging import raiseExceptions

import httpx
import os
import asyncio
from dotenv import load_dotenv
from starlette import responses

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

URL="https://api.github.com/users"
REPO_URL="https://api.github.com/repos"

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
        response = await client.get(f"{URL}/{username}/repos?per_page=100")
        all_repos = []
        for repo in response.json():
            if(repo["fork"]):
                continue
            all_repos.append(repo["name"])


        response.raise_for_status()
        return all_repos
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
            
        }    

# get github repo commits
async def get_repo_commits(username:str, repo: str):
    try:
        response = await client.get(f"{REPO_URL}/{username}/{repo}/commits")
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
        
        languages = await client.get(f"{REPO_URL}/{username}/{repo}/languages")
        languages.raise_for_status()
        return languages.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
        }

# get all repo languages
async def get_all_repo_lan(username:str):
    try:
        all_repo_data ={}
        all_repos = await get_repos(username)
        for repo_name in all_repos:
            responses = await client.get(f"{REPO_URL}/{username}/{repo_name}/languages")

            if not responses.json():
                continue

            if responses.status_code != 200:
                continue
                
            name = list(responses.json().keys())
            byte_count = list(responses.json().values())
            all_repo_data[repo_name]={
                "languages": name,
                "byte": byte_count,
            }
        return all_repo_data
            
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return{
            "success": False,
            "message":"Internal server error"
        }

    
