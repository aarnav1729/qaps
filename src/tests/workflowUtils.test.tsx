import { describe, it, expect } from 'vitest';
import { canUserAccessQAP, getUserAccessibleQAPs } from '../utils/workflowUtils';
import type { QAPFormData } from '../types/qap';
import type { User } from '../contexts/AuthContext';

const mockQAP: QAPFormData = {
  id: '1',
  customerName: 'Test Customer',
  projectName: 'Test Project',
  orderQuantity: 1000,
  productType: 'Solar Panel',
  plant: 'p2',
  status: 'level-2',
  submittedBy: 'praful',
  currentLevel: 2,
  levelResponses: {},
  timeline: [],
  qaps: [],
  createdAt: new Date(),
  lastModifiedAt: new Date()
};

const mockUser: User = {
  username: 'manoj',
  role: 'production',
  plant: 'p2'
};

describe('workflowUtils', () => {
  it('should allow production user to access QAP in their plant', () => {
    const result = canUserAccessQAP(mockUser, mockQAP);
    expect(result).toBe(true);
  });

  it('should filter QAPs based on user access', () => {
    const qaps = [mockQAP];
    const result = getUserAccessibleQAPs(mockUser, qaps);
    expect(result).toHaveLength(1);
  });

  it('should not allow access to QAP in different plant', () => {
    const differentPlantQAP = { ...mockQAP, plant: 'p4' };
    const result = canUserAccessQAP(mockUser, differentPlantQAP);
    expect(result).toBe(false);
  });
});