import api from "../client";
import type {
  ExercicioBase,
  RecursoTreino,
} from "@ecg/types";

export const catalogoService = {
  exerciciosBase: async (): Promise<ExercicioBase[]> => {
    const { data } = await api.get<ExercicioBase[]>("/catalogo/exercicios-base");
    return data;
  },

  recursosTreino: async (): Promise<RecursoTreino[]> => {
    const { data } = await api.get<RecursoTreino[]>("/catalogo/recursos-treino");
    return data;
  },

  editarExercicioBase: async (
    exercicioId: string,
    body: {
      nome?: string;
      grupo_muscular?: string;
      implemento_execucao?: string;
      pode_ser_feito_em_casa?: boolean;
    },
  ): Promise<ExercicioBase> => {
    const { data } = await api.patch<ExercicioBase>(
      `/catalogo/exercicios-base/${exercicioId}`,
      body,
    );
    return data;
  },

  criarRecursoTreino: async (nome: string): Promise<RecursoTreino> => {
    const { data } = await api.post<RecursoTreino>("/catalogo/recursos-treino", {
      nome,
    });
    return data;
  },

  editarRecursoTreino: async (
    recursoId: string,
    nome: string,
  ): Promise<RecursoTreino> => {
    const { data } = await api.patch<RecursoTreino>(
      `/catalogo/recursos-treino/${recursoId}`,
      { nome },
    );
    return data;
  },

  atualizarRequisitosRecurso: async (
    exercicioId: string,
    recursoIds: string[],
  ): Promise<ExercicioBase> => {
    const { data } = await api.put<ExercicioBase>(
      `/catalogo/exercicios-base/${exercicioId}/requisitos-recursos`,
      { recurso_ids: recursoIds },
    );
    return data;
  },
};
