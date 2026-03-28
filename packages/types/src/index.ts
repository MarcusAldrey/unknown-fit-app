// Re-exportação central dos tipos do domínio ECG.
// Espelha os schemas do backend para consumo no frontend.

export type Role = "PERSONAL" | "ALUNO";
export type Tecnica = "PADRAO" | "ISOMETRIA" | "INSTABILIDADE";
export type StatusSessao = "EM_ANDAMENTO" | "FINALIZADO";
export type ImplementoExecucao =
  | "BARRA"
  | "ELASTICO"
  | "HALTERE"
  | "KETTLEBELL"
  | "CABO"
  | "MAQUINA"
  | "PESO_CORPO"
  | "OUTRO";

export type AlvoTipo = "SEGUNDOS" | "REPETICOES" | "PASSOS" | "OUTROS";

export type RerRmTipo = "RER" | "RM";

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
  treina_em_academia_condominio: boolean;
}

export interface AlunoRecursoDisponibilidade {
  recurso_treino_id: string;
  nome_recurso: string;
  disponivel_para_aluno: boolean;
}

export interface RegistroPeso {
  id: string;
  aluno_id: string;
  peso: number;
  registrado_em: string;
}

export interface RegistroPesoCreate {
  peso: number;
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
  observacoes_aluno: string | null;
  ordem: number;
}

export interface ExercicioTreino {
  id: string;
  treino_id: string;
  exercicio_base_id: string;
  nome_exercicio: string;
  ordem: number;
  numero_series_prescritas: number;
  prescricao: string | null;
  alvo_tipo: AlvoTipo;
  alvo_valor_min: number | null;
  alvo_valor_max: number | null;
  alvo_outros_texto: string | null;
  rer_rm_tipo: RerRmTipo | null;
  rer_rm_valor: string | null;
  descanso_segundos: number | null;
  tecnica: Tecnica;
  observacoes: string | null;
  observacoes_aluno: string | null;
}

export interface ExercicioBase {
  id: string;
  nome: string;
  grupo_muscular: string;
  implemento_execucao: ImplementoExecucao;
  pode_ser_feito_em_casa: boolean;
  requisitos_alternativos_recurso: RecursoTreino[];
}

export interface RecursoTreino {
  id: string;
  nome: string;
  ativo: boolean;
  criado_por_sistema: boolean;
  criado_em: string;
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
