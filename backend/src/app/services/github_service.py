import asyncio
import os
from logging import raiseExceptions
from fastapi import HTTPException

import httpx, base64
from dotenv import load_dotenv
from starlette import responses
from app.schemas.github_schemas import ReadmeResponse, RepoData

load_dotenv()

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]

URL = "https://api.github.com/users"
REPO_URL = "https://api.github.com/repos"

headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {GITHUB_TOKEN}",
}
client = httpx.AsyncClient(headers=headers)


# get github user
async def get_user(username: str):
    try:
        response = await client.get(f"{URL}/{username}")

        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return {"success": False, "message": "Internal server error"}


# get github repos of the user
async def get_repos(username: str) -> list[RepoData]:
    try:
        response = await client.get(f"{URL}/{username}/repos?per_page=100")
        response.raise_for_status()

        all_repos:list[RepoData]= []
        for repo in response.json():
            if not repo["fork"]:
                all_repos.append( RepoData(
                                   repo=repo["name"],
                                   default_branch=repo["default_branch"],
                               ))
        return all_repos

    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Could not fetch GitHub repositories",
        ) from e

    # get forked rwepos


async def get_forked_repos(username: str)->list[RepoData]:
    try:
        response = await client.get(f"{URL}/{username}/repos?per_page=100")
        forked_repos: list[RepoData]= []
        for repo in response.json():
            if repo["fork"]:
              forked_repos.append( RepoData(
                                 repo=repo["name"],
                                 default_branch=repo["default_branch"],
                             ))
        return forked_repos
        
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Could not fetch GitHub repositories",
        ) from e


# get github repo commits
async def get_repo_commits(username: str, repo: str):
    try:
        response = await client.get(f"{REPO_URL}/{username}/{repo}/commits")
        return response.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return {"success": False, "message": "Internal server error"}


# # get github profile of the user
# async def get_profile(username:str):
#     try:
#         user, repos = await asyncio.gather(
#             get_user(username),
#             get_repos(username)
#         )
#         return{
#             "user":user,
#             "repos":repos
#         }
#     except httpx.HTTPStatusError as e:
#         print("github services error:", e.response.status_code)
#         return{
#             "success": False,
#             "message":"Internal server error"
#
#         }


# repo languages
async def get_repo_languages(username: str, repo: str):
    try:
        languages = await client.get(f"{REPO_URL}/{username}/{repo}/languages")
        languages.raise_for_status()
        return languages.json()
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        return {"success": False, "message": "Internal server error"}


# # get all repo languages
# async def get_all_repo_lan(username:str):
#     try:
#         all_repo_data ={}
#         all_repos = await get_repos(username)
#         for repo_name in all_repos:
#             responses = await client.get(f"{REPO_URL}/{username}/{repo_name}/languages")
#
#             if not responses.json():
#                 continue
#
#             if responses.status_code != 200:
#                 continue
#
#             name = list(responses.json().keys())
#             byte_count = list(responses.json().values())
#             all_repo_data[repo_name]={
#                 "languages": name,
#                 "byte": byte_count,
#             }
#         return all_repo_data
#
#     except httpx.HTTPStatusError as e:
#         print("github services error:", e.response.status_code)
#         return{
#             "success": False,
#             "message":"Internal server error"
#         }


# get redme of a repo
async def get_readme(username: str):

    try:
        repos, forked_repos = await asyncio.gather(
            get_repos(username), get_forked_repos(username)
        )
        all_repos = repos + forked_repos
        readme_data=[]
        # print(all_repos)
        # return all_repos
        for repo in all_repos:
            # print("----------",repo,"----------")
            repo_name = repo.repo
            # print(repo_name)
            response =await client.get(f"{REPO_URL}/{username}/{repo_name}/readme", headers={"Accept": "application/vnd.github.raw+json"},)
            readme_data.append({
                "repo": repo_name,
                "readme": response.text
            })
        return readme_data
        
    except httpx.HTTPStatusError as e:
        print("github services error:", e.response.status_code)
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Could not fetch GitHub repositories",
        ) from e
        
# get tech stack

async def get_tech_stack(username: str, repo: str):
    tech_files = []

    responses = await asyncio.gather(
        client.get(f"{REPO_URL}/{username}/{repo}/contents/package.json"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/requirements.txt"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/pyproject.toml"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/pom.xml"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/Dockerfile"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/docker-compose.yml"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/docker-compose.yaml"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/compose.yml"),
        client.get(f"{REPO_URL}/{username}/{repo}/contents/compose.yaml"),
        return_exceptions=True,
    )
    
    for response in responses:
        if not isinstance(response, httpx.Response):
            continue
    
        if response.status_code == 404:
            continue
    
        # response.raise_for_status()
        # tech_files.append(response.json())
        file_data = response.json()
        encoded_content = file_data.get("content")
        if not encoded_content:
            continue
        content = base64.b64decode(encoded_content).decode("utf-8")
        tech_files.append({
            "file": file_data["name"],
            "content": content
        })
        # print("file data: \n\n", file_data)

    return tech_files

async def get_stack(username:str):
    repos, forked_repos = await asyncio.gather(
        get_repos(username), get_forked_repos(username)
    )
    all_repos = repos + forked_repos
    repo_file_data=[]
    for repo in all_repos:
       response= await get_tech_stack(username, repo)
       # print("ok ok ",response)
       repo_file_data.append(
           {
               "repo": repo,
               "data":response
           }
       )
       # print(repo_file_data)
    return repo_file_data

async def get_project_tree(username:str):
    repos, forked_repos = await asyncio.gather(
        get_repos(username), get_forked_repos(username)
    )
    all_repos = repos + forked_repos
    # responses =[]
    wanted_files = [
        "package.json",
        "requirements.txt",
        "pyproject.toml",
        "pom.xml",
        "Dockerfile",
        "docker-compose.yml",
    ]
    
    files = []
    for repo in all_repos:
        repo_name = repo.repo
        repo_branch = repo.default_branch
        response = await client.get(f"{REPO_URL}/{username}/{repo_name}/git/trees/{repo_branch}?recursive=1")
        file_tree = response.json()
       

        if response.status_code != 200:
            # print(repo_name, response.status_code, file_tree)
            continue  # use this when inside your repo loop
        
        tree = file_tree.get("tree", [])
        
        for item in tree:
            # print(item["path"])
        
        # return file_tree
    #     for item in file_tree["tree"]:
            if item["type"] == "blob" and item["path"].split("/")[-1].lower() in wanted_files:
                files.append(item["path"])
    return files

