import type { User } from '@ai-interviewer/shared';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  devLogin as apiDevLogin,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
} from '../lib/api';

interface AuthContextValue {
  user: User | undefined;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(({ user: current }) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        // In dev mode, no session yet just means nobody has signed in this browser —
        // auto-provision the seeded dev account instead of forcing a manual signup.
        if (import.meta.env.DEV) {
          return apiDevLogin().then(({ user: current }) => {
            if (!cancelled) setUser(current);
          });
        }
        if (!cancelled) setUser(undefined);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setUser(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedIn } = await apiLogin({ email, password });
    setUser(loggedIn);
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const { user: created } = await apiSignup({ email, password, name });
    setUser(created);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(undefined);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
