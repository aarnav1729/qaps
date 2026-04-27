import React, { createContext, useContext, useState, useEffect } from "react";
import type { UserRole } from "@/types/qap";

interface User {
  username: string;
  role: UserRole;
  plant?: string;
}
const API = window.location.origin;

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType|undefined>(undefined);

export const AuthProvider: React.FC<{children:React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User|null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const API = window.location.origin;

  // on mount, try /api/me (with cookie) → fall back to localStorage
  useEffect(() => {
    let mounted = true;
    fetch(`${API}/api/me`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (!mounted) return;
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      })
      .catch(() => {
        if (!mounted) return;
        const saved = localStorage.getItem('user');
        if (saved) setUser(JSON.parse(saved));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) return false;
      const { user: u } = await res.json();
      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await fetch(`${API}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => undefined).finally(() => {
      setUser(null);
      localStorage.removeItem('user');
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be in AuthProvider');
  return c;
};
