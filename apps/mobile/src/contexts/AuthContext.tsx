import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

import api from "../api/client";
import type { Role, TokenResponse, LoginRequest } from "../types";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  role: Role | null;
}

interface AuthContextData extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    role: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      const role = (await SecureStore.getItemAsync("user_role")) as Role | null;

      if (!token) {
        setState({
          isLoading: false,
          isAuthenticated: false,
          role: null,
        });
        return;
      }

      // Validar token chamando uma rota autenticada
      try {
        await api.get("/alunos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Token válido
        setState({
          isLoading: false,
          isAuthenticated: true,
          role,
        });
      } catch (error: any) {
        // Token inválido ou expirado
        console.log("Token validation failed, clearing auth");
        await SecureStore.deleteItemAsync("access_token");
        await SecureStore.deleteItemAsync("refresh_token");
        await SecureStore.deleteItemAsync("user_role");
        setState({
          isLoading: false,
          isAuthenticated: false,
          role: null,
        });
      }
    } catch (error) {
      console.error("checkAuth error:", error);
      setState({
        isLoading: false,
        isAuthenticated: false,
        role: null,
      });
    }
  }

  async function login(body: LoginRequest) {
    try {
      console.log("[Auth] Login attempt:", body.email);
      const { data } = await api.post<TokenResponse>("/auth/login", body);
      console.log("[Auth] Login success:", data.role);

      await SecureStore.setItemAsync("access_token", data.access_token);
      await SecureStore.setItemAsync("refresh_token", data.refresh_token);
      await SecureStore.setItemAsync("user_role", data.role);

      setState({
        isLoading: false,
        isAuthenticated: true,
        role: data.role,
      });
    } catch (error: any) {
      console.error("[Auth] Login error:", error.message);
      if (error.response?.status === 422) {
        throw new Error("Email ou senha incorretos");
      }
      throw error;
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    await SecureStore.deleteItemAsync("user_role");

    setState({
      isLoading: false,
      isAuthenticated: false,
      role: null,
    });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
