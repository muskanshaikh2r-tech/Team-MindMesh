from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database.connection import init_db
from .database.repository import seed_default_models_if_empty
from .api.routes import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_default_models_if_empty()
    yield

app = FastAPI(
    title="ModelRouter Gateway API",
    description="Cost-, Latency- & Quality-Aware AI Routing Platform (VORTEXA 3.0 / A-01)",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def root():
    return {
        "service": "ModelRouter Gateway",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "principles": "Filter -> Rank -> Try"
    }

@app.get("/health")
def health():
    return {"status": "ok"}
