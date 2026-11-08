from pydantic import BaseModel

class ReadmeResponse(BaseModel):
    repo:str
    readme:str