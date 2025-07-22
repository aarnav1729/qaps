
import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  username: string;
  role: 'requestor' | 'approver-p2' | 'approver-p4' | 'admin';
  plant?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const hardcodedUsers = [
  { username: 'praful', password: 'praful', role: 'requestor' as const },
  { username: 'yamini', password: 'yamini', role: 'requestor' as const },
  { username: 'baskara', password: 'baskara', role: 'approver-p4' as const, plant: 'p4' },
  { username: 'nrao', password: 'nrao', role: 'approver-p2' as const, plant: 'p2' },
  { username: 'aarnav', password: 'aarnav', role: 'admin' as const }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const foundUser = hardcodedUsers.find(
      u => u.username === username && u.password === password
    );
    
    if (foundUser) {
      const userInfo = { 
        username: foundUser.username, 
        role: foundUser.role,
        plant: foundUser.plant 
      };
      setUser(userInfo);
      localStorage.setItem('user', JSON.stringify(userInfo));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
