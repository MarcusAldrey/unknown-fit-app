import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// Prioriza URL explícita via env (EXPO_PUBLIC_API_URL) para produção.
const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const envAdminApiKey = process.env.EXPO_PUBLIC_ADMIN_API_KEY?.trim();
const hostFromExpo = Constants.expoConfig?.hostUri?.split(":")[0];
const extraApiHost =
  typeof Constants.expoConfig?.extra?.apiHost === "string"
    ? Constants.expoConfig.extra.apiHost
    : undefined;
const extraAdminApiKey =
  typeof Constants.expoConfig?.extra?.adminApiKey === "string"
    ? Constants.expoConfig.extra.adminApiKey
    : undefined;

// Prioriza host detectado pelo Expo para evitar IP fixo stale em app.json.
const DEV_API_HOST = hostFromExpo ?? extraApiHost ?? "127.0.0.1";
const DEV_API_BASE_URL = `http://${DEV_API_HOST}:8000/api/v1`;
const API_BASE_URL =
  envApiUrl || (__DEV__ ? DEV_API_BASE_URL : "https://api.ecg.com/api/v1");
const ADMIN_API_KEY = envAdminApiKey ?? extraAdminApiKey ?? "";

if (__DEV__) {
  console.log("[API Client] __DEV__:", __DEV__);
  console.log("[API Client] envApiUrl:", envApiUrl);
  console.log("[API Client] DEV_API_HOST:", DEV_API_HOST);
  console.log("[API Client] API_BASE_URL:", API_BASE_URL);
}

export const hasAdminApiKey = ADMIN_API_KEY.length > 0;

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

type AuthFailureHandler = () => void;

let onAuthFailure: AuthFailureHandler | null = null;

export function setOnAuthFailure(handler: AuthFailureHandler | null): void {
  onAuthFailure = handler;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Interceptor: injeta access token
api.interceptors.request.use(async (config) => {
  const requestUrl = config.url ?? "";
  config.headers = config.headers ?? {};

  if (__DEV__) {
    console.log(
      `[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
    );
  }

  const token = await SecureStore.getItemAsync("access_token");
  if (token) {
    (config.headers as Record<string, string>).Authorization =
      `Bearer ${token}`;
  }

  if (hasAdminApiKey && requestUrl.includes("/admin/")) {
    (config.headers as Record<string, string>)["X-Admin-Key"] = ADMIN_API_KEY;
  }

  return config;
});

// Single-flight refresh: 401s concorrentes compartilham uma única chamada.
let refreshPromise: Promise<string | null> | null = null;

async function refreshTokens(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync("refresh_token");
  if (!refreshToken) {
    return null;
  }

  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    await SecureStore.setItemAsync("access_token", data.access_token);
    await SecureStore.setItemAsync("refresh_token", data.refresh_token);
    return data.access_token as string;
  } catch {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    return null;
  }
}

// Interceptor: refresh automático em 401
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(
        `[API Response] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
      );
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url ?? "";
    const requestMethod = (originalRequest?.method ?? "").toLowerCase();
    const isAdminEndpoint = requestUrl.includes("/admin/");

    const isExpectedSessaoAtiva404 =
      error.response?.status === 404 &&
      requestUrl.includes("/aluno/sessoes/ativa");

    const isExpectedDescartarSessao404 =
      error.response?.status === 404 &&
      requestMethod === "delete" &&
      /\/aluno\/sessoes\/[0-9a-f-]+$/i.test(requestUrl);

    if (isExpectedSessaoAtiva404) {
      if (__DEV__) console.log("[API Info] Nenhuma sessão ativa no momento.");
      return Promise.reject(error);
    }

    if (isExpectedDescartarSessao404) {
      if (__DEV__) console.log("[API Info] Sessão já não estava em andamento.");
      return Promise.reject(error);
    }

    if (__DEV__) {
      console.error(
        `[API Error] ${error.response?.status || error.code} ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      );
      console.error(`[API Error] Message: ${error.message}`);
      if (error.response?.data) {
        console.error(`[API Error] Data:`, error.response.data);
      }
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAdminEndpoint
    ) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshTokens().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }

      onAuthFailure?.();
    }

    return Promise.reject(error);
  },
);

export default api;
