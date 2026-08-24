import { useQuery } from "@tanstack/react-query";

import { keys } from "../api/queryKeys";
import { alunoService } from "../api/services/aluno";
import type { SessaoAtiva } from "../types";

export function useSessaoAtiva() {
  return useQuery<SessaoAtiva | null>({
    queryKey: keys.aluno.sessaoAtiva(),
    queryFn: async () => {
      try {
        return await alunoService.sessaoAtiva();
      } catch (err: unknown) {
        if (err && typeof err === "object" && "response" in err) {
          const status = (err as { response?: { status?: number } }).response?.status;
          if (status === 404) return null;
        }
        throw err;
      }
    },
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    staleTime: 30_000,
  });
}
