import { useQuery } from "@tanstack/react-query";

import { keys } from "../api/queryKeys";
import { personalService } from "../api/services/personal";
import type { Treino } from "@kine/types";

export function useTreinos(conjuntoId: string | undefined) {
  return useQuery<Treino[]>({
    queryKey: keys.personal.conjuntoTreinos(conjuntoId ?? ""),
    queryFn: () => personalService.conjuntoTreinos(conjuntoId ?? ""),
    enabled: !!conjuntoId,
  });
}
