import axios from "axios";

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }
    if (!error.response) {
      return "Não foi possível conectar ao servidor.";
    }
    return `Erro ${error.response.status}.`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Erro desconhecido.";
}
