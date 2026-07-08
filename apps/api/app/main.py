from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth, credentials, datacenters, servers, terminal, tools


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="ServerHub API",
    description="API de gestion de serveurs avec collecte SSH et terminal web",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(credentials.router)
app.include_router(datacenters.router)
app.include_router(servers.router)
app.include_router(terminal.router)
app.include_router(tools.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "serverhub-api"}
