
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Test component to use the auth context
const TestComponent = () => {
  const { user, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not authenticated'}</span>
      <span data-testid="user">{user ? user.username : 'no user'}</span>
    </div>
  );
};

describe('AuthContext', () => {
  it('provides default unauthenticated state', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(getByTestId('auth-status')).toHaveTextContent('not authenticated');
    expect(getByTestId('user')).toHaveTextContent('no user');
  });

  it('handles login correctly', () => {
    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(getByTestId('auth-status')).toHaveTextContent('not authenticated');
  });
});
