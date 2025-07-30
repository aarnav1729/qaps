import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  username: string;
  role:
    | "requestor"
    | "production"
    | "quality"
    | "technical"
    | "head"
    | "technical-head"
    | "plant-head"
    | "admin";
  plant?: string;
}
const API = "http://localhost:4000";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType|undefined>(undefined);

export const AuthProvider: React.FC<{children:React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User|null>(null);
  const API = 'http://localhost:4000';

  // on mount, try /api/me (with cookie) → fall back to localStorage
  useEffect(() => {
    fetch(`${API}/api/me`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      })
      .catch(() => {
        const saved = localStorage.getItem('user');
        if (saved) setUser(JSON.parse(saved));
      });
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

  const logout = () => {
    // fire & forget
    fetch(`${API}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    }).finally(() => {
      setUser(null);
      localStorage.removeItem('user');
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user
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
