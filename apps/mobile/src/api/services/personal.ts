import api from "../client";
import type {
  AlunoFicha,
  AlunoRecursoDisponibilidade,
  AlunoResumo,
  ConjuntoTreino,
  ConjuntoTreinoCreate,
  ExercicioTreino,
  ExercicioTreinoCreate,
  ExercicioTreinoUpdate,
  RegistroPeso,
  SerieDetalhe,
  SessaoResumo,
  Treino,
  TreinoCreate,
} from "@kine/types";

export const personalService = {
  alunos: async (): Promise<AlunoResumo[]> => {
    const { data } = await api.get<AlunoResumo[]>("/personal/alunos");
    return data;
  },

  fichaAluno: async (alunoId: string): Promise<AlunoFicha> => {
    const { data } = await api.get<AlunoFicha>(`/personal/alunos/${alunoId}`);
    return data;
  },

  alunoConjuntos: async (alunoId: string): Promise<ConjuntoTreino[]> => {
    const { data } = await api.get<ConjuntoTreino[]>(
      `/personal/alunos/${alunoId}/conjuntos`,
    );
    return data;
  },

  criarConjunto: async (
    alunoId: string,
    body: ConjuntoTreinoCreate,
  ): Promise<ConjuntoTreino> => {
    const { data } = await api.post<ConjuntoTreino>(
      `/personal/alunos/${alunoId}/conjuntos`,
      body,
    );
    return data;
  },

  ativarConjunto: async (
    alunoId: string,
    conjuntoId: string,
  ): Promise<ConjuntoTreino> => {
    const { data } = await api.patch<ConjuntoTreino>(
      `/personal/alunos/${alunoId}/conjuntos/${conjuntoId}/ativar`,
    );
    return data;
  },

  editarConjunto: async (
    conjuntoId: string,
    body: { nome?: string; data_inicio?: string | null; data_fim?: string | null },
  ): Promise<ConjuntoTreino> => {
    const { data } = await api.patch<ConjuntoTreino>(
      `/personal/conjuntos/${conjuntoId}`,
      body,
    );
    return data;
  },

  alunoPeso: async (alunoId: string): Promise<RegistroPeso[]> => {
    const { data } = await api.get<RegistroPeso[]>(
      `/personal/alunos/${alunoId}/peso`,
    );
    return data;
  },

  registrarPeso: async (alunoId: string, peso: number): Promise<RegistroPeso> => {
    const { data } = await api.post<RegistroPeso>(
      `/personal/alunos/${alunoId}/peso`,
      { peso },
    );
    return data;
  },

  alunoRecursos: async (
    alunoId: string,
  ): Promise<AlunoRecursoDisponibilidade[]> => {
    const { data } = await api.get<AlunoRecursoDisponibilidade[]>(
      `/personal/alunos/${alunoId}/recursos-treino`,
    );
    return data;
  },

  atualizarRecursosEmLote: async (
    alunoId: string,
    disponivelParaAluno: boolean,
  ): Promise<AlunoRecursoDisponibilidade[]> => {
    const { data } = await api.patch<AlunoRecursoDisponibilidade[]>(
      `/personal/alunos/${alunoId}/recursos-treino`,
      { disponivel_para_aluno: disponivelParaAluno },
    );
    return data;
  },

  atualizarRecurso: async (
    alunoId: string,
    recursoId: string,
    disponivelParaAluno: boolean,
  ): Promise<AlunoRecursoDisponibilidade> => {
    const { data } = await api.patch<AlunoRecursoDisponibilidade>(
      `/personal/alunos/${alunoId}/recursos-treino/${recursoId}`,
      { disponivel_para_aluno: disponivelParaAluno },
    );
    return data;
  },

  conjuntoTreinos: async (conjuntoId: string): Promise<Treino[]> => {
    const { data } = await api.get<Treino[]>(
      `/personal/conjuntos/${conjuntoId}/treinos`,
    );
    return data;
  },

  criarTreino: async (conjuntoId: string, body: TreinoCreate): Promise<Treino> => {
    const { data } = await api.post<Treino>(
      `/personal/conjuntos/${conjuntoId}/treinos`,
      body,
    );
    return data;
  },

  editarTreino: async (
    treinoId: string,
    body: Partial<TreinoCreate>,
  ): Promise<Treino> => {
    const { data } = await api.patch<Treino>(`/personal/treinos/${treinoId}`, body);
    return data;
  },

  deletarTreino: async (treinoId: string): Promise<void> => {
    await api.delete(`/personal/treinos/${treinoId}`);
  },

  treinoExercicios: async (treinoId: string): Promise<ExercicioTreino[]> => {
    const { data } = await api.get<ExercicioTreino[]>(
      `/personal/treinos/${treinoId}/exercicios`,
    );
    return data;
  },

  criarExercicio: async (
    treinoId: string,
    body: ExercicioTreinoCreate,
  ): Promise<ExercicioTreino> => {
    const { data } = await api.post<ExercicioTreino>(
      `/personal/treinos/${treinoId}/exercicios`,
      body,
    );
    return data;
  },

  editarExercicio: async (
    exercicioId: string,
    body: ExercicioTreinoUpdate,
  ): Promise<ExercicioTreino> => {
    const { data } = await api.patch<ExercicioTreino>(
      `/personal/exercicios/${exercicioId}`,
      body,
    );
    return data;
  },

  deletarExercicio: async (exercicioId: string): Promise<void> => {
    await api.delete(`/personal/exercicios/${exercicioId}`);
  },

  substituirEquivalentes: async (
    exercicioId: string,
    exerciciosEquivalentesIds: string[],
  ): Promise<unknown> => {
    const { data } = await api.put(
      `/personal/exercicios/${exercicioId}/equivalentes`,
      { exercicios_equivalentes_ids: exerciciosEquivalentesIds },
    );
    return data;
  },

  alunoConjuntoSessoes: async (
    alunoId: string,
    conjuntoId: string,
  ): Promise<SessaoResumo[]> => {
    const { data } = await api.get<SessaoResumo[]>(
      `/personal/alunos/${alunoId}/conjuntos/${conjuntoId}/sessoes`,
    );
    return data;
  },

  alunoSessaoSeries: async (
    alunoId: string,
    sessaoId: string,
  ): Promise<SerieDetalhe[]> => {
    const { data } = await api.get<SerieDetalhe[]>(
      `/personal/alunos/${alunoId}/sessoes/${sessaoId}/series`,
    );
    return data;
  },
};
