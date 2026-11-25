import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.jobs.queue import queue
from app.jobs.worker import create_worker
from app.routes.github import router as github_router
from app.routes.auth.protected import router as auth_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    worker = create_worker()
    try:
        yield
    finally:
        try:
            await worker.close()
        finally:
            await queue.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(github_router)
app.include_router(auth_router)
