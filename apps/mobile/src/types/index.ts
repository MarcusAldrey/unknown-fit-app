// Tipos compartilhados do domínio ECG

export type Role = "PERSONAL" | "ALUNO";

export type Tecnica = "PADRAO" | "ISOMETRIA" | "INSTABILIDADE";

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

export type StatusSessao = "EM_ANDAMENTO" | "FINALIZADO";

// --- Auth ---

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: Role;
}

export interface RefreshRequest {
  refresh_token: string;
}

// --- Usuário ---

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
}

// --- Aluno ---

export interface AlunoResumo {
  id: string;
  nome: string;
  email: string;
}

export interface AlunoFicha {
  id: string;
  nome: string;
  email: string;
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

// --- Conjunto de Treino ---

export interface ConjuntoTreino {
  id: string;
  aluno_id: string;
  nome: string;
  ativo: boolean;
  data_inicio: string | null;
  data_fim: string | null;
}

export interface ConjuntoTreinoCreate {
  nome: string;
  data_inicio?: string;
  data_fim?: string;
}

// --- Treino ---

export interface Treino {
  id: string;
  conjunto_treino_id: string;
  codigo: string;
  nome: string;
  observacoes_aluno: string | null;
  ordem: number;
}

export interface TreinoCreate {
  codigo: string;
  nome: string;
  ordem: number;
}

// --- Exercício ---

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
  equivalentes: ExercicioTreinoEquivalente[];
}

export interface ExercicioTreinoEquivalente {
  id: string;
  exercicio_treino_id: string;
  exercicio_equivalente_treino_id: string;
  nome_exercicio: string;
  ordem: number;
}

export interface ExercicioTreinoEquivalentesUpdate {
  exercicios_equivalentes_ids: string[];
}

export interface ExercicioTreinoCreate {
  exercicio_base_id: string;
  ordem?: number;
  numero_series_prescritas: number;
  prescricao?: string;
  alvo_tipo: AlvoTipo;
  alvo_valor_min?: number;
  alvo_valor_max?: number;
  alvo_outros_texto?: string;
  rer_rm_tipo?: RerRmTipo;
  rer_rm_valor?: string;
  descanso_segundos?: number;
  tecnica?: Tecnica;
  observacoes?: string;
  observacoes_aluno?: string;
}

export interface ExercicioTreinoUpdate {
  exercicio_base_id?: string;
  ordem?: number;
  numero_series_prescritas?: number;
  prescricao?: string;
  alvo_tipo?: AlvoTipo;
  alvo_valor_min?: number;
  alvo_valor_max?: number;
  alvo_outros_texto?: string;
  rer_rm_tipo?: RerRmTipo;
  rer_rm_valor?: string;
  descanso_segundos?: number;
  tecnica?: Tecnica;
  observacoes?: string;
  observacoes_aluno?: string;
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

// --- Sessão de Treino ---

export interface SessaoTreino {
  id: string;
  aluno_id: string;
  treino_id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  status: StatusSessao;
}

export interface SessaoResumo {
  id: string;
  treino_id: string;
  treino_codigo: string;
  treino_nome: string;
  iniciado_em: string;
  finalizado_em: string | null;
  status: StatusSessao;
}

export interface SessaoCreate {
  treino_id: string;
}

export interface SessaoAtiva {
  id: string;
  treino_id: string;
  treino_codigo: string;
  treino_nome: string;
  iniciado_em: string;
  status: StatusSessao;
  series: SerieExecutada[];
}

// --- Série Executada ---

export interface SerieExecutada {
  id: string;
  sessao_treino_id: string;
  exercicio_treino_id: string;
  exercicio_treino_executado_id?: string | null;
  numero_serie: number;
  peso_utilizado: number | null;
  repeticoes_realizadas: number | null;
  concluida: boolean;
}

export interface SerieDetalhe {
  id: string;
  exercicio_treino_id: string;
  exercicio_treino_executado_id?: string | null;
  nome_exercicio: string;
  nome_exercicio_executado?: string | null;
  numero_serie: number;
  peso_utilizado: number | null;
  repeticoes_realizadas: number | null;
  concluida: boolean;
}

export interface UltimoPesoExercicio {
  exercicio_treino_id: string;
  peso_utilizado: number | null;
}

export interface SerieCreate {
  exercicio_treino_id: string;
  exercicio_treino_executado_id?: string;
  numero_serie: number;
  peso_utilizado?: number;
  repeticoes_realizadas?: number;
  concluida?: boolean;
}
