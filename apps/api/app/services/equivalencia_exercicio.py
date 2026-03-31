import uuid
from collections import deque

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExercicioTreinoEquivalente
from app.repositories import EquivalenciaExercicioRepository


def montar_nova_ordem_com_bloco(
    ordem_atual_ids: list[uuid.UUID],
    exercicio_base_id: uuid.UUID,
    equivalentes_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    if exercicio_base_id not in ordem_atual_ids:
        return ordem_atual_ids

    ids_validos = set(ordem_atual_ids)
    ids_equivalentes_validos: list[uuid.UUID] = []
    ids_equivalentes_set: set[uuid.UUID] = set()

    for equivalente_id in equivalentes_ids:
        if equivalente_id == exercicio_base_id:
            continue
        if equivalente_id not in ids_validos:
            continue
        if equivalente_id in ids_equivalentes_set:
            continue
        ids_equivalentes_validos.append(equivalente_id)
        ids_equivalentes_set.add(equivalente_id)

    if not ids_equivalentes_validos:
        return ordem_atual_ids

    ordem_sem_equivalentes = [
        exercicio_id
        for exercicio_id in ordem_atual_ids
        if exercicio_id not in ids_equivalentes_set
    ]
    indice_base = ordem_sem_equivalentes.index(exercicio_base_id)

    return [
        *ordem_sem_equivalentes[: indice_base + 1],
        *ids_equivalentes_validos,
        *ordem_sem_equivalentes[indice_base + 1 :],
    ]


def calcular_bloco_equivalencia(
    exercicio_base_id: uuid.UUID,
    exercicios_ids: list[uuid.UUID],
    equivalencias: list[tuple[uuid.UUID, uuid.UUID]],
) -> set[uuid.UUID]:
    exercicios_ids_set = set(exercicios_ids)
    if exercicio_base_id not in exercicios_ids_set:
        return {exercicio_base_id}

    adjacencia: dict[uuid.UUID, set[uuid.UUID]] = {
        exercicio_id: set() for exercicio_id in exercicios_ids
    }
    for origem_id, destino_id in equivalencias:
        adjacencia[origem_id].add(destino_id)
        adjacencia[destino_id].add(origem_id)

    visitados: set[uuid.UUID] = set()
    fila: deque[uuid.UUID] = deque([exercicio_base_id])
    while fila:
        atual_id = fila.popleft()
        if atual_id in visitados:
            continue
        visitados.add(atual_id)
        for vizinho_id in adjacencia.get(atual_id, set()):
            if vizinho_id not in visitados:
                fila.append(vizinho_id)

    return visitados


def calcular_bloco_limpeza_equivalencia(
    exercicio_base_id: uuid.UUID,
    equivalentes_ids: list[uuid.UUID],
    exercicios_ids: list[uuid.UUID],
    equivalencias: list[tuple[uuid.UUID, uuid.UUID]],
) -> set[uuid.UUID]:
    bloco_limpeza_ids = calcular_bloco_equivalencia(
        exercicio_base_id=exercicio_base_id,
        exercicios_ids=exercicios_ids,
        equivalencias=equivalencias,
    )

    for equivalente_id in equivalentes_ids:
        bloco_limpeza_ids |= calcular_bloco_equivalencia(
            exercicio_base_id=equivalente_id,
            exercicios_ids=exercicios_ids,
            equivalencias=equivalencias,
        )

    return bloco_limpeza_ids


async def calcular_bloco_equivalencia_ids(
    db: AsyncSession,
    treino_id: uuid.UUID,
    exercicio_base_id: uuid.UUID,
) -> set[uuid.UUID]:
    repo = EquivalenciaExercicioRepository(db)
    exercicios_ids = await repo.listar_ids_exercicios_treino(treino_id)
    equivalencias = await repo.listar_arestas_equivalencia(exercicios_ids)

    return calcular_bloco_equivalencia(
        exercicio_base_id=exercicio_base_id,
        exercicios_ids=exercicios_ids,
        equivalencias=equivalencias,
    )


async def reordenar_exercicios_para_manter_equivalentes_juntos(
    db: AsyncSession,
    treino_id: uuid.UUID,
    exercicio_base_id: uuid.UUID,
    equivalentes_ids: list[uuid.UUID],
) -> None:
    if not equivalentes_ids:
        return

    repo = EquivalenciaExercicioRepository(db)
    exercicios = await repo.listar_exercicios_ordenados(treino_id)

    ordem_atual_ids = [exercicio.id for exercicio in exercicios]
    nova_ordem_ids = montar_nova_ordem_com_bloco(
        ordem_atual_ids=ordem_atual_ids,
        exercicio_base_id=exercicio_base_id,
        equivalentes_ids=equivalentes_ids,
    )
    if nova_ordem_ids == ordem_atual_ids:
        return

    por_id = {exercicio.id: exercicio for exercicio in exercicios}
    for idx, exercicio_id in enumerate(nova_ordem_ids, start=1):
        exercicio = por_id[exercicio_id]
        if exercicio.ordem != idx:
            exercicio.ordem = idx

    await db.flush()


async def _validar_equivalentes_no_treino(
    db: AsyncSession,
    treino_id: uuid.UUID,
    equivalentes_ids: list[uuid.UUID],
) -> None:
    if not equivalentes_ids:
        return

    repo = EquivalenciaExercicioRepository(db)
    existentes_ids = await repo.listar_ids_exercicios_existentes_no_treino(
        treino_id=treino_id,
        exercicios_ids=equivalentes_ids,
    )
    if len(existentes_ids) != len(equivalentes_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Todos os equivalentes devem pertencer ao mesmo treino",
        )


async def substituir_equivalentes_no_treino(
    db: AsyncSession,
    treino_id: uuid.UUID,
    exercicio_id: uuid.UUID,
    equivalentes_ids: list[uuid.UUID],
) -> list[ExercicioTreinoEquivalente]:
    repo = EquivalenciaExercicioRepository(db)

    if exercicio_id in equivalentes_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Um exercício não pode ser equivalente de si mesmo",
        )

    await _validar_equivalentes_no_treino(
        db=db,
        treino_id=treino_id,
        equivalentes_ids=equivalentes_ids,
    )

    exercicios_ids = await repo.listar_ids_exercicios_treino(treino_id)
    equivalencias = await repo.listar_arestas_equivalencia(exercicios_ids)

    bloco_limpeza_ids = calcular_bloco_limpeza_equivalencia(
        exercicio_base_id=exercicio_id,
        equivalentes_ids=equivalentes_ids,
        exercicios_ids=exercicios_ids,
        equivalencias=equivalencias,
    )

    bloco_final_ids = {exercicio_id} | set(equivalentes_ids)
    exercicios_ordenados = await repo.listar_exercicios_ordenados(treino_id)
    bloco_final_ordenado_ids = [
        exercicio.id
        for exercicio in exercicios_ordenados
        if exercicio.id in bloco_final_ids
    ]

    await repo.remover_equivalencias_relacionadas(bloco_limpeza_ids)

    await db.flush()

    await repo.criar_bloco_equivalencias_completo(bloco_final_ordenado_ids)

    await db.flush()

    await reordenar_exercicios_para_manter_equivalentes_juntos(
        db=db,
        treino_id=treino_id,
        exercicio_base_id=exercicio_id,
        equivalentes_ids=[
            equivalente_id
            for equivalente_id in bloco_final_ordenado_ids
            if equivalente_id != exercicio_id
        ],
    )

    return await repo.listar_equivalentes_do_exercicio(exercicio_id)


async def remover_equivalencias_do_exercicio(
    db: AsyncSession,
    exercicio_id: uuid.UUID,
) -> None:
    repo = EquivalenciaExercicioRepository(db)
    await repo.remover_equivalencias_do_exercicio(exercicio_id)


async def reordenar_ordens_exercicios_do_treino(
    db: AsyncSession,
    treino_id: uuid.UUID,
) -> None:
    repo = EquivalenciaExercicioRepository(db)
    exercicios = await repo.listar_exercicios_ordenados(treino_id)

    for idx, exercicio in enumerate(exercicios, start=1):
        if exercicio.ordem != idx:
            exercicio.ordem = idx

    await db.flush()