
import { QAPFormData, User } from '@/types/qap';

export const getNextLevelUsers = (qap: QAPFormData, currentLevel: number): string[] => {
  const plant = qap.plant.toLowerCase();
  
  switch (currentLevel) {
    case 2: // Level 2 to Level 3
      if (plant === 'p2') {
        // Auto-bypass to Technical Head for P2
        return ['jmr', 'baskara'];
      } else {
        // Send to Head for P4/P5
        return ['nrao'];
      }
    
    case 3: // Level 3 to Level 4
      return ['jmr', 'baskara'];
    
    case 4: // Level 4 to Level 5 (after final comments)
      return ['cmk'];
    
    default:
      return [];
  }
};

export const canUserAccessQAP = (user: User, qap: QAPFormData): boolean => {
  if (user.role === 'admin') return true;
  
  const userPlants = user.plant?.split(',').map(p => p.trim()) || [];
  const qapPlant = qap.plant.toLowerCase();
  
  switch (user.role) {
    case 'requestor':
      return qap.submittedBy === user.username;
    
    case 'production':
    case 'quality':
    case 'technical':
      return userPlants.includes(qapPlant) && qap.currentLevel === 2;
    
    case 'head':
      return userPlants.some(plant => ['p4', 'p5'].includes(plant)) && 
             userPlants.includes(qapPlant) && 
             qap.currentLevel === 3;
    
    case 'technical-head':
      return qap.currentLevel === 4;
    
    case 'plant-head':
      return qap.currentLevel === 5;
    
    default:
      return false;
  }
};

export const isQAPExpired = (submittedAt: Date, level: number): boolean => {
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  const timeElapsed = Date.now() - submittedAt.getTime();
  
  // Only Level 2 has 4-day timeout
  if (level === 2) {
    return timeElapsed > fourDaysMs;
  }
  
  return false;
};
