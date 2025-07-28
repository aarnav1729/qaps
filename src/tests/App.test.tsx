
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      username: 'test_user',
      role: 'admin',
      plant: 'P4'
    },
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('App Component', () => {
  it('renders without crashing', () => {
    renderWithRouter(<App />);
  });

  it('handles basic routing', () => {
    const { container } = renderWithRouter(<App />);
    expect(container).toBeTruthy();
  });
});
