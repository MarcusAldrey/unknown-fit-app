import type { ImplementoExecucao } from "../types";

const IMPLEMENTO_LABELS: Record<ImplementoExecucao, string> = {
  BARRA: "Barra",
  ELASTICO: "Elástico",
  HALTERE: "Halteres",
  KETTLEBELL: "Kettlebell",
  CABO: "Cabo",
  MAQUINA: "Máquina",
  PESO_CORPO: "Peso corporal",
  OUTRO: "Outro",
};

export function formatarImplementoExecucao(valor: ImplementoExecucao): string {
  return IMPLEMENTO_LABELS[valor] ?? valor;
}
