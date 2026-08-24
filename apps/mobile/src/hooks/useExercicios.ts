import { useQuery } from "@tanstack/react-query";

import { keys } from "../api/queryKeys";
import { personalService } from "../api/services/personal";
import type { ExercicioTreino } from "../types";

export function useExercicios(treinoId: string | undefined) {
  return useQuery<ExercicioTreino[]>({
    queryKey: keys.personal.treinoExercicios(treinoId ?? ""),
    queryFn: () => personalService.treinoExercicios(treinoId ?? ""),
    enabled: !!treinoId,
  });
}
