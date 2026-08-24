from fastapi import APIRouter

from app.routers.personal import (
    alunos,
    conjuntos,
    exercicios,
    recursos,
    sessoes,
    treinos,
)

router = APIRouter()
router.include_router(alunos.router)
router.include_router(recursos.router)
router.include_router(conjuntos.router)
router.include_router(treinos.router)
router.include_router(exercicios.router)
router.include_router(sessoes.router)
