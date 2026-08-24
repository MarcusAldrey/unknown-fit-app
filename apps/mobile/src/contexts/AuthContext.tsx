import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { setOnAuthFailure } from "../api/client";
import { authService } from "../api/services/auth";
import type { LoginRequest, Role } from "../types";

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
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    role: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    setOnAuthFailure(() => {
      setState({
        isLoading: false,
        isAuthenticated: false,
        role: null,
      });
    });
    return () => setOnAuthFailure(null);
  }, []);

  async function clearAuthState() {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    await SecureStore.deleteItemAsync("user_role");
    queryClient.clear();
  }

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

      // Validar token chamando uma rota autenticada existente
      try {
        await authService.me();
        setState({
          isLoading: false,
          isAuthenticated: true,
          role,
        });
      } catch {
        // Token inválido ou expirado
        await clearAuthState();
        setState({
          isLoading: false,
          isAuthenticated: false,
          role: null,
        });
      }
    } catch {
      setState({
        isLoading: false,
        isAuthenticated: false,
        role: null,
      });
    }
  }

  async function login(body: LoginRequest) {
    try {
      const data = await authService.login(body);

      await SecureStore.setItemAsync("access_token", data.access_token);
      await SecureStore.setItemAsync("refresh_token", data.refresh_token);
      await SecureStore.setItemAsync("user_role", data.role);

      setState({
        isLoading: false,
        isAuthenticated: true,
        role: data.role,
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        throw new Error("Email ou senha incorretos");
      }
      throw error;
    }
  }

  async function logout() {
    try {
      const refreshToken = await SecureStore.getItemAsync("refresh_token");
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Logout é best-effort; limpa o estado local mesmo se a API falhar.
    }

    await clearAuthState();

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
