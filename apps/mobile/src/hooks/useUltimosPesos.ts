import { useQuery } from "@tanstack/react-query";

import { keys } from "../api/queryKeys";
import { alunoService } from "../api/services/aluno";
import type { UltimoPesoExercicio } from "@ecg/types";

/**
 * Centraliza o fan-out de último peso por exercício em uma única query,
 * evitando N+1 requests na tela de sessão.
 */
export function useUltimosPesos(exercicioIds: string[]) {
  return useQuery<Record<string, UltimoPesoExercicio>>({
    queryKey: keys.aluno.ultimosPesos(exercicioIds.join(",")),
    queryFn: async () => {
      const resultados = await Promise.all(
        exercicioIds.map(async (id) => {
          const peso = await alunoService.ultimoPeso(id);
          return [id, peso] as const;
        }),
      );
      return Object.fromEntries(resultados);
    },
    enabled: exercicioIds.length > 0,
  });
}
