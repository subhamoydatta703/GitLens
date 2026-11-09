from pydantic import BaseModel

class ReadmeResponse(BaseModel):
    repo:str
    readme:str


class RepoData(BaseModel):
    repo: str
    default_branch: str

class TechFilesPath(BaseModel):
    repo: str
    path:str

class TechFilesDetails(BaseModel):
    repo:str
    file_name: str
    file_path:str
    file_content:str
    