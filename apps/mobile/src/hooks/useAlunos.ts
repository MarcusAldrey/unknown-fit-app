import { useQuery } from "@tanstack/react-query";

import { keys } from "../api/queryKeys";
import { personalService } from "../api/services/personal";
import type { AlunoResumo } from "@ecg/types";

export function useAlunos() {
  return useQuery<AlunoResumo[]>({
    queryKey: keys.personal.alunos(),
    queryFn: personalService.alunos,
  });
}
