import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const loadUser = useCallback(async () => {
    setStatus('loading');
    try {
      const currentUser = await authApi.currentUser();
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch {
      setUser(null);
      setStatus('anonymous');
      return null;
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    const expire = () => {
      setUser(null);
      setStatus('anonymous');
    };
    const refresh = (event) => {
      if (!event.detail?.user) return;
      setUser(event.detail.user);
      setStatus('authenticated');
    };
    window.addEventListener('itcp:session-expired', expire);
    window.addEventListener('itcp:session-refreshed', refresh);
    return () => {
      window.removeEventListener('itcp:session-expired', expire);
      window.removeEventListener('itcp:session-refreshed', refresh);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);
    const nextUser = result.user || await authApi.currentUser();
    setUser(nextUser);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const register = useCallback(async (details) => {
    const result = await authApi.register(details);
    const nextUser = result.user || await authApi.currentUser();
    setUser(nextUser);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Local sign-out remains authoritative when remote revocation is temporarily unavailable.
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const acceptAuthResult = useCallback((nextUser) => {
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const value = useMemo(() => ({
    user,
    status,
    isAuthenticated: status === 'authenticated',
    login,
    register,
    logout,
    refreshUser: loadUser,
    acceptAuthResult,
  }), [acceptAuthResult, loadUser, login, logout, register, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
