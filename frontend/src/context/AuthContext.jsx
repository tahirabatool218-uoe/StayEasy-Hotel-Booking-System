import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import authService from '../services/authService';
import { onUnauthorized } from '../services/api';

const AuthContext = createContext(null);

// Reads whatever was persisted from a previous session so state can be
// restored synchronously before the "am I still logged in" check below.
const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(getStoredUser);
  // True while we verify a persisted token against the backend on first load.
  const [loading, setLoading] = useState(true);

  const persistSession = (authPayload) => {
    const { token: newToken, ...profile } = authPayload;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(profile));
    setToken(newToken);
    setUser(profile);
  };

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    persistSession(data);
    return data;
  };

  const register = async (details) => {
    const data = await authService.register(details);
    persistSession(data);
    return data;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  // Adopt a token/profile that came from elsewhere — currently the fresh token
  // returned by PUT /users/change-password, which invalidates every token
  // issued before it (see authController generateToken + the User model's
  // passwordChangedAt). Without storing it, changing your own password would
  // sign you out on the next request.
  const updateSession = useCallback((profile, newToken) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
    }
    if (profile) {
      // Merge into what is stored so a caller that only knows some fields can
      // never wipe the others (for example profileImage).
      const merged = { ...(getStoredUser() || {}), ...profile };
      localStorage.setItem('user', JSON.stringify(merged));
      setUser(merged);
    }
  }, []);

  // The axios interceptor clears localStorage on a 401 but has no access to
  // React state. Subscribing here keeps the two in sync so the UI (navbar,
  // protected routes) drops the session the moment the backend rejects it.
  useEffect(() => onUnauthorized(logout), [logout]);

  // Restore authentication after a page refresh: if a token is present,
  // confirm it's still valid via GET /api/auth/me and refresh the cached
  // profile.
  //
  // Only a 401 (the backend saying the token is invalid, expired, or the user
  // is gone) ends the session. A network failure, timeout, 5xx or 503 says
  // nothing about the token, so the stored session is kept and the next
  // request re-checks it — a flaky connection must not sign anyone out.
  // (A 401 here also clears everything through the axios interceptor.)
  useEffect(() => {
    const restoreSession = async () => {
      const existingToken = localStorage.getItem('token');
      if (!existingToken) {
        setLoading(false);
        return;
      }

      try {
        const profile = await authService.getMe();
        localStorage.setItem('user', JSON.stringify(profile));
        setUser(profile);
        setToken(existingToken);
      } catch (error) {
        if (error?.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        } else {
          // Keep the cached session; fall back to the stored copy of the profile.
          setToken(existingToken);
          setUser((current) => current || getStoredUser());
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    loading,
    login,
    register,
    logout,
    updateSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
