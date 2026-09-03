export const keys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  catalogo: {
    exerciciosBase: () => ["catalogo", "exercicios-base"] as const,
    recursosTreino: () => ["catalogo", "recursos-treino"] as const,
    implementosExecucao: () => ["catalogo", "implementos-execucao"] as const,
  },
  personal: {
    alunos: () => ["personal", "alunos"] as const,
    aluno: (alunoId: string) => ["personal", "aluno", alunoId] as const,
    alunoConjuntos: (alunoId: string) => ["personal", "aluno", alunoId, "conjuntos"] as const,
    alunoPeso: (alunoId: string) => ["personal", "aluno", alunoId, "peso"] as const,
    alunoRecursos: (alunoId: string) =>
      ["personal", "aluno", alunoId, "recursos-treino"] as const,
    conjuntoTreinos: (conjuntoId: string) =>
      ["personal", "conjunto", conjuntoId, "treinos"] as const,
    treinoExercicios: (treinoId: string) =>
      ["personal", "treino", treinoId, "exercicios"] as const,
    alunoConjuntoSessoes: (alunoId: string, conjuntoId: string) =>
      ["personal", "aluno", alunoId, "conjunto", conjuntoId, "sessoes"] as const,
    alunoSessaoSeries: (alunoId: string, sessaoId: string) =>
      ["personal", "aluno", alunoId, "sessao", sessaoId, "series"] as const,
  },
  admin: {
    personais: () => ["admin", "personais"] as const,
    alunos: () => ["admin", "alunos"] as const,
  },
  aluno: {
    conjuntoAtivo: () => ["aluno", "conjunto-ativo"] as const,
    conjuntoAtivoTreinos: () => ["aluno", "conjunto-ativo", "treinos"] as const,
    sessoes: () => ["aluno", "sessoes", "historico"] as const,
    sessaoAtiva: () => ["aluno", "sessao-ativa"] as const,
    sessaoSeries: (sessaoId: string) => ["aluno", "sessao", sessaoId, "series"] as const,
    treinoExercicios: (treinoId: string) =>
      ["aluno", "treino", treinoId, "exercicios"] as const,
    ultimosPesos: (treinoId: string) =>
      ["aluno", "treino", treinoId, "ultimos-pesos"] as const,
  },
} as const;

/**
 * Políticas de staleTime por chave. Quando uma chave não está listada,
 * vale o staleTime padrão do QueryClient (5 min).
 */
export const staleTimes: Record<string, number> = {
  // Sessão ativa muda com frequência e é recarregada ao focar a tela.
  "aluno.sessao-ativa": 30_000,
  // Catálogo de exercícios base é quase estático; política única para as duas telas.
  "catalogo.exercicios-base": 1000 * 60 * 5,
};

export function staleTimeFor(key: readonly unknown[]): number | undefined {
  return staleTimes[key.join(".")];
}
