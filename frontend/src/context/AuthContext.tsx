import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, SofiaUser } from '../api/client';

interface AuthContextValue {
  user: SofiaUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; age?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const USER_KEY = 'sofia_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SofiaUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const storedUser = localStorage.getItem(USER_KEY);
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setToken(null);
      }
    }
    setIsReady(true);
  }, []);

  function persist(response: { token: string; user: SofiaUser }) {
    setToken(response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setUser(response.user);
  }

  async function login(email: string, password: string) {
    const response = await api.login({ email, password });
    persist(response);
  }

  async function register(data: { name: string; email: string; password: string; age?: string }) {
    const response = await api.register(data);
    persist(response);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('sofia_active_session_id');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isReady, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within an AuthProvider');
  return context;
}
