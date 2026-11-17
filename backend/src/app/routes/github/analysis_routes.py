from app.jobs.queue import queue
from fastapi import APIRouter, HTTPException


from app.schemas.github_schemas import AnalysisContext
from app.services.analysis import analyze
from app.services.github.evidence_service import get_saved_content

router = APIRouter()


@router.get("/analysis/jobs/{job_id}")
async def get_analysis_job(job_id: str):
    status = await queue.getJobState(job_id)

    if status == "unknown":
        raise HTTPException(
            status_code=404,
            detail="Analysis job not found.",
        )

    if status == "completed":
        job = await queue.getJob(job_id)
        if job is None:
            raise HTTPException(
                status_code=404,
                detail="Analysis job not found.",
            )
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
async def github_analyze_with_context(username: str, user_context: AnalysisContext, evidence_id: str | None = None):
    content = get_saved_content(username, user_context=user_context, evidence_id=evidence_id)
    job = await queue.add(
            "github_analyze",
            content.model_dump(mode="json"),
        )
    
    return {"job_id": job.id}

