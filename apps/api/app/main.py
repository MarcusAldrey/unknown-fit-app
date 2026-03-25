from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, personal, aluno, catalogo


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="ECG - Elite Training Gym",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(personal.router, prefix="/api/v1/personal", tags=["Personal"])
app.include_router(aluno.router, prefix="/api/v1/aluno", tags=["Aluno"])
app.include_router(catalogo.router, prefix="/api/v1/catalogo", tags=["Catálogo"])


@app.get("/health")
async def health():
    return {"status": "ok"}
