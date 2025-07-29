
import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  username: string;
  role: 'requestor' | 'production' | 'quality' | 'technical' | 'head' | 'technical-head' | 'plant-head' | 'admin';
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
  // Level 1 - Requestors
  { username: 'praful', password: 'praful', role: 'requestor' as const },
  { username: 'yamini', password: 'yamini', role: 'requestor' as const },
  
  // Level 2 - Production
  { username: 'manoj', password: 'manoj', role: 'production' as const, plant: 'p2' },
  { username: 'malik', password: 'malik', role: 'production' as const, plant: 'p4' },
  { username: 'siva', password: 'siva', role: 'production' as const, plant: 'p5' },
  
  // Level 2 - Quality
  { username: 'abbas', password: 'abbas', role: 'quality' as const, plant: 'p2' },
  { username: 'sriram', password: 'sriram', role: 'quality' as const, plant: 'p4,p5' },
  
  // Level 2 - Technical
  { username: 'rahul', password: 'rahul', role: 'technical' as const, plant: 'p2' },
  { username: 'ramu', password: 'ramu', role: 'technical' as const, plant: 'p4,p5' },
  
  // Level 3 - Head
  { username: 'nrao', password: 'nrao', role: 'head' as const, plant: 'p4,p5' },
  
  // Level 4 - Technical Head
  { username: 'jmr', password: 'jmr', role: 'technical-head' as const },
  { username: 'baskara', password: 'baskara', role: 'technical-head' as const },
  
  // Level 5 - Plant Head
  { username: 'cmk', password: 'cmk', role: 'plant-head' as const },
  
  // Admin
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
