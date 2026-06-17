import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → refresh token → retry
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
          const { jwt, refreshToken: newRefresh } = response.data.data;

          useAuthStore.getState().setTokens(jwt, newRefresh);
          original.headers.Authorization = `Bearer ${jwt}`;

          return api(original);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject({ status: error.response?.status, message, data: error.response?.data });
  },
);
