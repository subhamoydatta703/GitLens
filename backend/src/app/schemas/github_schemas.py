
from pydantic import BaseModel, Field

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


class RepoLanguage(BaseModel):
    repo: str
    language:str
    byte: str | int

class GitHubUser(BaseModel):
    name: str | None = None
    login: str
    followers: int
    following: int
    bio: str | None = None

class GitHubProfile(BaseModel):
    name: str | None = None
    username: str
    followers: int
    following: int
    bio: str | None = None
    tech: list[TechFilesDetails]


class GitHubFullDetail(BaseModel):
    repo_detail: list[GitHubProfile]
    languages: list[RepoLanguage]
    readme: list[str]


class AnalysisContext(BaseModel):

    target_roles: list[str] = Field(default_factory=list, max_length=5)
    goals: str | None = Field(default=None, max_length=2000)
    additional_information: str | None = Field(default=None, max_length=12000)


class AIInput(BaseModel):
    user_detail: list[GitHubProfile]
    readme: list[ReadmeResponse]
    user_context: AnalysisContext | None = None
