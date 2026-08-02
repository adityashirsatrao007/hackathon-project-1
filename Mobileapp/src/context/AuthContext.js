import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { authApi, orgsApi } from '../services/apiHandler';
import { TOKEN_STORAGE_KEY, ORG_STORAGE_KEY, USER_STORAGE_KEY } from '../utils/constants';

// ── Platform-safe storage ─────────────────────────────────────────────────────
// SecureStore only works on native. On web, fall back to localStorage.
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

async function readJSON(key) {
  try {
    const raw = await storage.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function writeJSON(key, value) {
  try {
    if (value) await storage.setItemAsync(key, JSON.stringify(value));
    else await storage.deleteItemAsync(key);
  } catch {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [activeOrg, setActiveOrgState] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Boot: load from storage ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await storage.getItemAsync(TOKEN_STORAGE_KEY);
        const cachedUser = await readJSON(USER_STORAGE_KEY);
        const cachedOrg = await readJSON(ORG_STORAGE_KEY);

        if (storedToken) {
          setToken(storedToken);
          if (cachedUser) setUser(cachedUser);
          if (cachedOrg) setActiveOrgState(cachedOrg);

          // Revalidate in background
          try {
            const me = await authApi.getMe();
            setUser(me);
            await writeJSON(USER_STORAGE_KEY, me);
          } catch {
            await storage.deleteItemAsync(TOKEN_STORAGE_KEY);
            await storage.deleteItemAsync(USER_STORAGE_KEY);
            setToken(null);
            setUser(null);
          }
        }
      } catch (e) {
        console.warn('[AuthContext] Boot error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Fetch role when activeOrg changes ──────────────────────────────────────
  useEffect(() => {
    if (!activeOrg?.id || !token) {
      setUserRole(null);
      return;
    }
    orgsApi.getMyRole(activeOrg.id)
      .then((data) => setUserRole(data.role))
      .catch(() => setUserRole(null));
  }, [activeOrg?.id, token]);

  /** Email/password login */
  const login = useCallback(async (accessToken, userData) => {
    await storage.setItemAsync(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    setUser(userData);
    await writeJSON(USER_STORAGE_KEY, userData);
  }, []);

  /** OAuth callback — receive token, fetch user */
  const loginWithToken = useCallback(async (accessToken) => {
    await storage.setItemAsync(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    setIsLoading(true);
    try {
      const me = await authApi.getMe();
      setUser(me);
      await writeJSON(USER_STORAGE_KEY, me);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await storage.deleteItemAsync(TOKEN_STORAGE_KEY);
    await storage.deleteItemAsync(USER_STORAGE_KEY);
    await storage.deleteItemAsync(ORG_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setActiveOrgState(null);
    setUserRole(null);
  }, []);

  const setActiveOrg = useCallback(async (org) => {
    setActiveOrgState(org);
    await writeJSON(ORG_STORAGE_KEY, org);
  }, []);

  const value = {
    user,
    token,
    activeOrg,
    userRole,
    isLoading,
    isAuthenticated: !!user,
    isOwnerOrAdmin: userRole === 'owner' || userRole === 'admin',
    login,
    loginWithToken,
    logout,
    setActiveOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
