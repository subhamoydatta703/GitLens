from fastapi import APIRouter

from app.services.github.tree_service import get_project_tree

router = APIRouter()


@router.get("/{username}/get-tree")
async def get_tree(username: str):
    return await get_project_tree(username)
