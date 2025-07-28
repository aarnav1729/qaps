
import { describe, it, expect } from 'vitest';
import { canUserAccessQAP, getQAPsForUser } from '../utils/workflowUtils';
import { QAPFormData } from '../types/qap';

const mockQAP: QAPFormData = {
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
};

describe('workflowUtils', () => {
  describe('canUserAccessQAP', () => {
    it('allows requestor to access their own draft QAP', () => {
      const user = { id: 'test_user', username: 'test_user', password: '', role: 'requestor' as const, plant: 'P4' };
      expect(canUserAccessQAP(mockQAP, user)).toBe(true);
    });

    it('allows admin to access any QAP', () => {
      const user = { id: 'admin', username: 'admin', password: '', role: 'admin' as const };
      expect(canUserAccessQAP(mockQAP, user)).toBe(true);
    });

    it('denies access to unrelated users', () => {
      const user = { id: 'other_user', username: 'other_user', password: '', role: 'requestor' as const, plant: 'P2' };
      expect(canUserAccessQAP(mockQAP, user)).toBe(false);
    });
  });

  describe('getQAPsForUser', () => {
    it('returns QAPs for requestor', () => {
      const user = { id: 'test_user', username: 'test_user', password: '', role: 'requestor' as const, plant: 'P4' };
      const qaps = getQAPsForUser([mockQAP], user);
      expect(qaps).toHaveLength(1);
      expect(qaps[0].id).toBe('1');
    });

    it('returns all QAPs for admin', () => {
      const user = { id: 'admin', username: 'admin', password: '', role: 'admin' as const };
      const qaps = getQAPsForUser([mockQAP], user);
      expect(qaps).toHaveLength(1);
    });
  });
});
