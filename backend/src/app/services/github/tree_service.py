from app.schemas.github_schemas import RepoData, TechFilesPath
from app.services.github.client import REPO_URL, client
from app.services.github.repo_service import get_all_repos


async def get_project_tree(username: str, repos: list[RepoData] | None = None) -> list[TechFilesPath]:
    if repos is None:
        repos = await get_all_repos(username)

    wanted_files = [
        "package.json",
        "requirements.txt",
        "pyproject.toml",
        "pom.xml",
        "dockerfile",
        "docker-compose.yml",
    ]
    ignored_folders = {"node_modules", ".next", ".git", "dist", "build"}

    files: list[TechFilesPath] = []
    for repo in repos:
        repo_name = repo.repo
        repo_branch = repo.default_branch
        response = await client.get(
            f"{REPO_URL}/{username}/{repo_name}/git/trees/{repo_branch}?recursive=1"
        )
        file_tree = response.json()

        if response.status_code != 200:

            continue

        tree = file_tree.get("tree", [])

        for item in tree:

            path = item["path"]
            part_path = item["path"].split("/")
            file = item["path"].split("/")[-1].lower()

            if any(folder in ignored_folders for folder in part_path):
                continue


            if item["type"] == "blob" and file in wanted_files:
                files.append(TechFilesPath(repo=repo_name, path=item["path"]))
    return files
