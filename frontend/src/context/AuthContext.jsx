import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, orgsApi } from "@/services/api/apiHandler";
import { TOKEN_STORAGE_KEY, ORG_STORAGE_KEY } from "@/utils/constants";

const USER_STORAGE_KEY = "tracelify_user_cache";

function readUserCache() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUserCache(user) {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));

  // ── Instant render: seed from localStorage cache ──────────────────────────
  const [user, setUser] = useState(() => (localStorage.getItem(TOKEN_STORAGE_KEY) ? readUserCache() : null));

  const [activeOrg, setActiveOrgState] = useState(() => {
    try {
      const stored = localStorage.getItem(ORG_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Role of the current user in the activeOrg (owner | admin | member | null)
  const [userRole, setUserRole] = useState(null);

  // isLoading = true only when we have a token but NO cached user (first ever load)
  const [isLoading, setIsLoading] = useState(() => {
    const hasToken = !!localStorage.getItem(TOKEN_STORAGE_KEY);
    const hasCachedUser = !!readUserCache();
    return hasToken && !hasCachedUser;
  });

  /** Hydrate / re-validate user from server in the background */
  const hydrateUser = useCallback(async (storedToken) => {
    if (!storedToken) {
      setIsLoading(false);
      return;
    }
    try {
      const me = await authApi.getMe();
      setUser(me);
      writeUserCache(me);        // keep cache fresh for next load
    } catch {
      // Invalid/expired token — clear everything
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-validate on mount (background — UI already shows cached data)
  useEffect(() => {
    hydrateUser(token);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch role whenever activeOrg changes
  useEffect(() => {
    if (!activeOrg?.id || !token) {
      setUserRole(null);
      return;
    }
    orgsApi.getMyRole(activeOrg.id)
      .then((data) => setUserRole(data.role))
      .catch(() => setUserRole(null));
  }, [activeOrg?.id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Email/password login — store token + user immediately */
  const login = useCallback(async (accessToken, userData) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    setUser(userData);
    writeUserCache(userData);
  }, []);

  /** OAuth callback — receive token, fetch user */
  const loginWithToken = useCallback(async (accessToken) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
    setIsLoading(true);
    try {
      const me = await authApi.getMe();
      setUser(me);
      writeUserCache(me);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(ORG_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setActiveOrgState(null);
    setUserRole(null);
    window.location.href = "/login";
  }, []);

  const setActiveOrg = useCallback((org) => {
    setActiveOrgState(org);
    if (org) localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(org));
    else localStorage.removeItem(ORG_STORAGE_KEY);
  }, []);

  const value = {
    user,
    token,
    activeOrg,
    userRole,
    isLoading,
    isAuthenticated: !!user,
    /** Helpers */
    isOwnerOrAdmin: userRole === "owner" || userRole === "admin",
    login,
    loginWithToken,
    logout,
    setActiveOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside <AuthProvider>");
  return ctx;
}

export default AuthContext;
