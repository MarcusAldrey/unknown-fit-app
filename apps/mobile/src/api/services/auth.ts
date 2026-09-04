import api from "../client";
import type { LoginRequest, TokenResponse, Usuario } from "@kine/types";

export const authService = {
  login: async (body: LoginRequest): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>("/auth/login", body);
    return data;
  },

  me: async (): Promise<Usuario> => {
    const { data } = await api.get<Usuario>("/auth/me");
    return data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/auth/logout", { refresh_token: refreshToken });
  },
};
