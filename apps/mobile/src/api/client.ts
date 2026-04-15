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

console.log("[API Client] __DEV__:", __DEV__);
console.log("[API Client] envApiUrl:", envApiUrl);
console.log("[API Client] DEV_API_HOST:", DEV_API_HOST);
console.log("[API Client] API_BASE_URL:", API_BASE_URL);

export const hasAdminApiKey = ADMIN_API_KEY.length > 0;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Interceptor: injeta access token
api.interceptors.request.use(async (config) => {
  const requestUrl = config.url ?? "";
  config.headers = config.headers ?? {};

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

// Interceptor: refresh automático em 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url ?? "";
    const isAdminEndpoint = requestUrl.includes("/admin/");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAdminEndpoint
    ) {
      originalRequest._retry = true;

      const refreshToken = await SecureStore.getItemAsync("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          await SecureStore.setItemAsync("access_token", data.access_token);
          await SecureStore.setItemAsync("refresh_token", data.refresh_token);

          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return api(originalRequest);
        } catch {
          await SecureStore.deleteItemAsync("access_token");
          await SecureStore.deleteItemAsync("refresh_token");
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
