from fastapi import APIRouter

from app.routes.github.profile_routes import router as profile_router
from app.routes.github.repo_routes import router as repo_router
from app.routes.github.language_routes import router as language_router
from app.routes.github.readme_routes import router as readme_router
from app.routes.github.tech_stack_routes import router as tech_stack_router
from app.routes.github.tree_routes import router as tree_router
from app.routes.github.analysis_routes import router as analysis_router
from app.routes.github.evidence_routes import router as evidence_router

router = APIRouter(
    prefix="/github",
    tags=["github"],
)

router.include_router(profile_router)
router.include_router(repo_router)
router.include_router(language_router)
router.include_router(readme_router)
router.include_router(tech_stack_router)
router.include_router(tree_router)
router.include_router(analysis_router)
router.include_router(evidence_router)
