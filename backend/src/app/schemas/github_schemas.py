from pydantic import BaseModel

class ReadmeResponse(BaseModel):
    repo:str
    readme:str


class RepoData(BaseModel):
    repo: str
    default_branch: str