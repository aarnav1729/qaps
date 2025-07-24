
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

export const processWorkflowTransition = (qap: QAPFormData, nextLevel: number): QAPFormData => {
  const updatedQAP = { ...qap };
  
  switch (nextLevel) {
    case 3:
      if (qap.plant.toLowerCase() === 'p2') {
        // Auto-bypass to Level 4 for P2
        updatedQAP.status = 'level-4';
        updatedQAP.currentLevel = 4;
        updatedQAP.timeline.push({
          level: 3,
          action: 'Auto-bypassed (P2 plant)',
          user: 'system',
          timestamp: new Date()
        });
        updatedQAP.timeline.push({
          level: 4,
          action: 'Sent to Technical Head',
          user: 'system',
          timestamp: new Date()
        });
      } else {
        updatedQAP.status = 'level-3';
        updatedQAP.currentLevel = 3;
        updatedQAP.timeline.push({
          level: 3,
          action: 'Sent to Head for review',
          user: 'system',
          timestamp: new Date()
        });
      }
      break;
    
    case 4:
      updatedQAP.status = 'level-4';
      updatedQAP.currentLevel = 4;
      updatedQAP.timeline.push({
        level: 4,
        action: 'Sent to Technical Head',
        user: 'system',
        timestamp: new Date()
      });
      break;
    
    case 5:
      updatedQAP.status = 'level-5';
      updatedQAP.currentLevel = 5;
      updatedQAP.timeline.push({
        level: 5,
        action: 'Sent to Plant Head for approval',
        user: 'system',
        timestamp: new Date()
      });
      break;
    
    default:
      break;
  }
  
  return updatedQAP;
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

export const getUserAccessibleQAPs = (user: User, allQAPs: QAPFormData[]): QAPFormData[] => {
  if (user.role === 'admin') return allQAPs;
  
  const userPlants = user.plant?.split(',').map(p => p.trim()) || [];
  
  return allQAPs.filter(qap => {
    const qapPlant = qap.plant.toLowerCase();
    
    switch (user.role) {
      case 'requestor':
        return qap.submittedBy === user.username;
      
      case 'production':
      case 'quality':
      case 'technical':
        return userPlants.includes(qapPlant);
      
      case 'head':
        return userPlants.some(plant => ['p4', 'p5'].includes(plant)) && 
               userPlants.includes(qapPlant);
      
      case 'technical-head':
        return true; // Can see all QAPs
      
      case 'plant-head':
        return true; // Can see all QAPs
      
      default:
        return false;
    }
  });
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

export const calculateTurnaroundTime = (qap: QAPFormData, level: number): number => {
  if (!qap.timeline || qap.timeline.length === 0) return 0;
  
  const levelStart = qap.timeline.find(entry => 
    entry.level === level && entry.action.includes('Sent to')
  );
  const levelEnd = qap.timeline.find(entry => 
    entry.level === level && (entry.action.includes('Reviewed') || entry.action.includes('Approved'))
  );
  
  if (!levelStart || !levelEnd) return 0;
  
  return levelEnd.timestamp.getTime() - levelStart.timestamp.getTime();
};

export const calculateAverageTurnaroundTime = (qaps: QAPFormData[], filters: {
  plant?: string;
  level?: number;
  user?: string;
}): { average: number; count: number } => {
  let filteredQAPs = qaps.filter(qap => qap.status === 'approved');
  
  if (filters.plant) {
    filteredQAPs = filteredQAPs.filter(qap => qap.plant.toLowerCase() === filters.plant.toLowerCase());
  }
  
  const turnaroundTimes: number[] = [];
  
  filteredQAPs.forEach(qap => {
    if (filters.level) {
      const time = calculateTurnaroundTime(qap, filters.level);
      if (time > 0) turnaroundTimes.push(time);
    } else {
      // Calculate total turnaround time
      if (qap.submittedAt && qap.approvedAt) {
        turnaroundTimes.push(qap.approvedAt.getTime() - qap.submittedAt.getTime());
      }
    }
  });
  
  const average = turnaroundTimes.length > 0 
    ? turnaroundTimes.reduce((sum, time) => sum + time, 0) / turnaroundTimes.length 
    : 0;
  
  return { average, count: turnaroundTimes.length };
};
