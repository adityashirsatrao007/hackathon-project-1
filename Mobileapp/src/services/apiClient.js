import axios from 'axios';
import { Platform } from 'react-native';
import { TOKEN_STORAGE_KEY, API_BASE_URL } from '../utils/constants';

// ── Platform-safe storage ─────────────────────────────────────────────────────
let storage;
if (Platform.OS === 'web') {
  storage = {
    getItemAsync: async (key) => { try { return localStorage.getItem(key); } catch { return null; } },
    setItemAsync: async (key, value) => { try { localStorage.setItem(key, value); } catch {} },
    deleteItemAsync: async (key) => { try { localStorage.removeItem(key); } catch {} },
  };
} else {
  storage = require('expo-secure-store');
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItemAsync(TOKEN_STORAGE_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // storage may fail silently
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await storage.deleteItemAsync(TOKEN_STORAGE_KEY);
      } catch {}
    }
    return Promise.reject(error);
  },
);

export default apiClient;
