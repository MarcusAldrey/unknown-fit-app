// Re-exportação central dos tipos do domínio ECG.
// Espelha os schemas do backend para consumo no frontend.

export type Role = "PERSONAL" | "ALUNO";
export type Tecnica = "PADRAO" | "ISOMETRIA" | "INSTABILIDADE";
export type StatusSessao = "EM_ANDAMENTO" | "FINALIZADO";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: Role;
}

export interface AlunoResumo {
  id: string;
  nome: string;
  email: string;
}

export interface AlunoFicha extends AlunoResumo {
  idade: number | null;
  peso: number | null;
  altura: number | null;
}

export interface ConjuntoTreino {
  id: string;
  aluno_id: string;
  nome: string;
  ativo: boolean;
  data_inicio: string | null;
  data_fim: string | null;
}

export interface Treino {
  id: string;
  conjunto_treino_id: string;
  codigo: string;
  nome: string;
  ordem: number;
}

export interface ExercicioTreino {
  id: string;
  treino_id: string;
  nome_exercicio: string;
  ordem: number;
  numero_series_prescritas: number;
  prescricao: string | null;
  repeticao_ou_tempo: string | null;
  rer_rm_valor: string | null;
  descanso_segundos: number | null;
  tecnica: Tecnica;
  observacoes: string | null;
}

export interface ExercicioBase {
  id: string;
  nome: string;
  grupo_muscular: string;
  equipamento: string | null;
}

export interface SessaoTreino {
  id: string;
  aluno_id: string;
  treino_id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  status: StatusSessao;
}

export interface SerieExecutada {
  id: string;
  sessao_treino_id: string;
  exercicio_treino_id: string;
  numero_serie: number;
  peso_utilizado: number | null;
  repeticoes_realizadas: number | null;
  concluida: boolean;
}
