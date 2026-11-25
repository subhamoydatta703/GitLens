from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.auth.authentication import require_own_github_profile, require_user_id
from app.jobs.queue import queue
from app.schemas.github_schemas import AnalysisContext
from app.services.github.evidence_service import get_saved_content

router = APIRouter()


@router.get("/analysis/jobs/{job_id}")
async def get_analysis_job(
    job_id: str, user_id: Annotated[str, Depends(require_user_id)]
):
    status = await queue.getJobState(job_id)
    job = None if status == "unknown" else await queue.getJob(job_id)

    if job is None or job.data.get("owner_id") != user_id:
        raise HTTPException(
            status_code=404,
            detail="Analysis job not found.",
        )

    if status == "completed":
        return {
            "status": status,
            "result": job.returnvalue,
        }

    if status == "failed":
        return {
            "status": status,
            "message": "The analysis could not be completed.",
        }

    return {"status": status}


@router.post("/{username}/analyze")
async def github_analyze_with_context(
    github_username: Annotated[str, Depends(require_own_github_profile)],
    user_context: AnalysisContext,
    user_id: Annotated[str, Depends(require_user_id)],
    evidence_id: str | None = None,
):
    content = get_saved_content(github_username, user_context=user_context, evidence_id=evidence_id)
    payload = content.model_dump(mode="json")
    payload["owner_id"] = user_id
    job = await queue.add("github_analyze", payload)

    return {"job_id": job.id}

