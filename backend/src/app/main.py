from fastapi import FastAPI
from app.routes.github_routes import router as github_router


app = FastAPI()

app.include_router(github_router)