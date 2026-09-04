import api from "../client";
import type {
  ConjuntoTreino,
  ExercicioTreino,
  SerieCreate,
  SerieDetalhe,
  SessaoAtiva,
  SessaoResumo,
  SessaoTreino,
  Treino,
  UltimoPesoExercicio,
} from "@kine/types";

export const alunoService = {
  conjuntoAtivo: async (): Promise<ConjuntoTreino> => {
    const { data } = await api.get<ConjuntoTreino>("/aluno/me/conjunto-ativo");
    return data;
  },

  conjuntoAtivoTreinos: async (): Promise<Treino[]> => {
    const { data } = await api.get<Treino[]>("/aluno/me/conjunto-ativo/treinos");
    return data;
  },

  sessoes: async (): Promise<SessaoResumo[]> => {
    const { data } = await api.get<SessaoResumo[]>("/aluno/sessoes");
    return data;
  },

  sessaoAtiva: async (): Promise<SessaoAtiva> => {
    const { data } = await api.get<SessaoAtiva>("/aluno/sessoes/ativa");
    return data;
  },

  treinoExercicios: async (treinoId: string): Promise<ExercicioTreino[]> => {
    const { data } = await api.get<ExercicioTreino[]>(
      `/aluno/treinos/${treinoId}/exercicios`,
    );
    return data;
  },

  sessaoSeries: async (sessaoId: string): Promise<SerieDetalhe[]> => {
    const { data } = await api.get<SerieDetalhe[]>(
      `/aluno/sessoes/${sessaoId}/series`,
    );
    return data;
  },

  ultimoPeso: async (exercicioId: string): Promise<UltimoPesoExercicio> => {
    const { data } = await api.get<UltimoPesoExercicio>(
      `/aluno/exercicios/${exercicioId}/ultimo-peso`,
    );
    return data;
  },

  iniciarSessao: async (treinoId: string): Promise<SessaoTreino> => {
    const { data } = await api.post<SessaoTreino>("/aluno/sessoes", {
      treino_id: treinoId,
    });
    return data;
  },

  finalizarSessao: async (sessaoId: string): Promise<SessaoTreino> => {
    const { data } = await api.patch<SessaoTreino>(
      `/aluno/sessoes/${sessaoId}/finalizar`,
    );
    return data;
  },

  descartarSessao: async (sessaoId: string): Promise<void> => {
    await api.delete(`/aluno/sessoes/${sessaoId}`);
  },

  registrarSerie: async (sessaoId: string, body: SerieCreate): Promise<unknown> => {
    const { data } = await api.post(`/aluno/sessoes/${sessaoId}/series`, body);
    return data;
  },

  excluirSerie: async (sessaoId: string, serieId: string): Promise<void> => {
    await api.delete(`/aluno/sessoes/${sessaoId}/series/${serieId}`);
  },

  atualizarObsTreino: async (
    treinoId: string,
    observacoesAluno: string | null,
  ): Promise<Treino> => {
    const { data } = await api.patch<Treino>(
      `/aluno/treinos/${treinoId}/observacoes-aluno`,
      { observacoes_aluno: observacoesAluno },
    );
    return data;
  },

  atualizarObsExercicio: async (
    exercicioId: string,
    observacoesAluno: string | null,
  ): Promise<ExercicioTreino> => {
    const { data } = await api.patch<ExercicioTreino>(
      `/aluno/exercicios/${exercicioId}/observacoes-aluno`,
      { observacoes_aluno: observacoesAluno },
    );
    return data;
  },
};
