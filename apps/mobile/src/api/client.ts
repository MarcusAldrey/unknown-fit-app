import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// Prioriza URL explícita via env para evitar depender de IP fixo de rede.
const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const hostFromExpo = Constants.expoConfig?.hostUri?.split(":")[0];
const extraApiHost =
  typeof Constants.expoConfig?.extra?.apiHost === "string"
    ? Constants.expoConfig.extra.apiHost
    : undefined;

const DEV_API_HOST = extraApiHost ?? hostFromExpo ?? "127.0.0.1";
const DEV_API_BASE_URL = `http://${DEV_API_HOST}:8000/api/v1`;
const API_BASE_URL =
  envApiUrl || (__DEV__ ? DEV_API_BASE_URL : "https://api.ecg.com/api/v1");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Interceptor: injeta access token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: refresh automático em 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
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
