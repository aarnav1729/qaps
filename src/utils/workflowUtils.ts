import { QAPFormData, User } from '@/types/qap';

export const getNextLevelUsers = (qap: QAPFormData, currentLevel: number | string): string[] => {
  const plant = qap.plant.toLowerCase();
  
  switch (currentLevel) {
    case 2: // Level 2 to Level 3
      if (['p4', 'p5'].includes(plant)) {
        return ['nrao']; // Head for P4/P5
      } else {
        return ['jmr', 'baskara']; // Direct to Technical Head for P2
      }
    
    case 3: // Level 3 to Level 4
      return ['jmr', 'baskara']; // Technical Head
    
    case 4: // Level 4 to Final Comments (back to requestor)
      return [qap.submittedBy || ''];
    
    case 'final-comments': // Final Comments to Level 3 (Head) for P4/P5
      if (['p4', 'p5'].includes(plant)) {
        return ['nrao']; // Head for P4/P5
      } else {
        return ['jmr', 'baskara']; // Direct to Technical Head for P2
      }
    
    case 'level-3-final': // Level 3 Final to Level 4 Final
      return ['jmr', 'baskara']; // Technical Head
    
    case 'level-4-final': // Level 4 Final to Level 5 (Plant Head)
      return ['cmk']; // Plant Head
    
    default:
      return [];
  }
};

export const processWorkflowTransition = (qap: QAPFormData, nextLevel: number | string): QAPFormData => {
  const updatedQAP = { ...qap };
  const now = new Date();
  
  // End current level timing
  if (typeof updatedQAP.currentLevel === 'number') {
    if (updatedQAP.levelEndTimes) {
      updatedQAP.levelEndTimes[updatedQAP.currentLevel] = now;
    } else {
      updatedQAP.levelEndTimes = { [updatedQAP.currentLevel]: now };
    }
  }
  
  switch (nextLevel) {
    case 3:
      if (['p4', 'p5'].includes(qap.plant.toLowerCase())) {
        updatedQAP.status = 'level-3';
        updatedQAP.currentLevel = 3;
        updatedQAP.timeline.push({
          level: 3,
          action: 'Sent to Head for review',
          user: 'system',
          timestamp: now
        });
      } else {
        // Skip to Level 4 for P2
        updatedQAP.status = 'level-4';
        updatedQAP.currentLevel = 4;
        updatedQAP.timeline.push({
          level: 3,
          action: 'Auto-bypassed (P2 plant)',
          user: 'system',
          timestamp: now
        });
        updatedQAP.timeline.push({
          level: 4,
          action: 'Sent to Technical Head',
          user: 'system',
          timestamp: now
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
        timestamp: now
      });
      break;
    
    case 'final-comments':
      updatedQAP.status = 'final-comments';
      updatedQAP.currentLevel = 1;
      updatedQAP.timeline.push({
        level: 1,
        action: 'Sent to Requestor for final comments',
        user: 'system',
        timestamp: now
      });
      break;
    
    case 'level-3-final':
      updatedQAP.status = 'level-3-final';
      updatedQAP.currentLevel = 3;
      updatedQAP.timeline.push({
        level: 3,
        action: 'Sent to Head for final review',
        user: 'system',
        timestamp: now
      });
      break;
    
    case 'level-4-final':
      updatedQAP.status = 'level-4-final';
      updatedQAP.currentLevel = 4;
      updatedQAP.timeline.push({
        level: 4,
        action: 'Sent to Technical Head for final review',
        user: 'system',
        timestamp: now
      });
      break;
    
    case 5:
      updatedQAP.status = 'level-5';
      updatedQAP.currentLevel = 5;
      updatedQAP.timeline.push({
        level: 5,
        action: 'Sent to Plant Head for final approval',
        user: 'system',
        timestamp: now
      });
      break;
    
    default:
      break;
  }
  
  // Start new level timing
  if (typeof updatedQAP.currentLevel === 'number') {
    if (updatedQAP.levelStartTimes) {
      updatedQAP.levelStartTimes[updatedQAP.currentLevel] = now;
    } else {
      updatedQAP.levelStartTimes = { [updatedQAP.currentLevel]: now };
    }
  }
  
  updatedQAP.lastModifiedAt = now;
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
             (qap.currentLevel === 3 || qap.status === 'level-3-final');
    
    case 'technical-head':
      return qap.currentLevel === 4 || qap.status === 'level-4-final';
    
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
