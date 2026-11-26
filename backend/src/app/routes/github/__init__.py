from fastapi import APIRouter, Depends

from app.auth.authentication import require_auth
from app.routes.github.profile_routes import router as profile_router
from app.routes.github.analysis_routes import router as analysis_router
from app.routes.github.evidence_routes import router as evidence_router

router = APIRouter(
    prefix="/github",
    tags=["github"],
    dependencies=[Depends(require_auth)],
)

router.include_router(profile_router)
router.include_router(analysis_router)
router.include_router(evidence_router)
