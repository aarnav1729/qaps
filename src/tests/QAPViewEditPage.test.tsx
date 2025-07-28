
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import QAPViewEditPage from '../pages/QAPViewEditPage';
import { QAPFormData } from '../types/qap';

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      username: 'test_user',
      role: 'requestor',
      plant: 'P4'
    }
  })
}));

const mockQAPData: QAPFormData[] = [
  {
    id: '1',
    customerName: 'Test Customer',
    projectName: 'Test Project',
    orderQuantity: 100,
    productType: 'Test Product',
    plant: 'P4',
    status: 'draft',
    submittedBy: 'test_user',
    currentLevel: 1,
    levelResponses: {},
    timeline: [],
    qaps: [],
    createdAt: new Date(),
    lastModifiedAt: new Date()
  }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('QAPViewEditPage', () => {
  it('renders QAP details correctly', () => {
    const mockOnSave = vi.fn();
    const { getByText } = renderWithRouter(
      <QAPViewEditPage 
        qapData={mockQAPData} 
        onSave={mockOnSave}
      />
    );
    
    expect(getByText('Test Customer')).toBeTruthy();
    expect(getByText('Test Project')).toBeTruthy();
  });

  it('shows edit button for draft QAPs', () => {
    const mockOnSave = vi.fn();
    const { getByText } = renderWithRouter(
      <QAPViewEditPage 
        qapData={mockQAPData} 
        onSave={mockOnSave}
      />
    );
    
    expect(getByText('Edit QAP')).toBeTruthy();
  });
});
