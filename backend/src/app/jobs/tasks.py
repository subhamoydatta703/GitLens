from fastapi import HTTPException

from app.schemas.github_schemas import AIInput
from app.services.analysis import analyze


async def process(job, token):
    content = AIInput.model_validate(job.data)

    try:
        analysis = await analyze(content)
    except HTTPException as error:
        raise RuntimeError(str(error.detail)) from error

    return {"analysis": analysis}