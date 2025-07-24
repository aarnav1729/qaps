
export interface User {
  id: string;
  username: string;
  password: string;
  role: 'requestor' | 'production' | 'quality' | 'technical' | 'head' | 'technical-head' | 'plant-head' | 'admin';
  plant?: string;
}

export interface QAPFormData {
  id: string;
  customerName: string;
  projectName: string;
  orderQuantity: number;
  productType: string;
  plant: string;
  status: 'draft' | 'submitted' | 'level-2' | 'level-3' | 'level-4' | 'final-comments' | 'level-5' | 'approved' | 'rejected';
  submittedBy?: string;
  submittedAt?: Date;
  currentLevel: 1 | 2 | 3 | 4 | 5;
  levelResponses: {
    [level: number]: {
      [role: string]: {
        username: string;
        acknowledged: boolean;
        comments: { [itemIndex: number]: string };
        respondedAt?: Date;
      }
    }
  };
  finalComments?: string;
  finalCommentsBy?: string;
  finalCommentsAt?: Date;
  approver?: string;
  approvedAt?: Date;
  feedback?: string;
  timeline: TimelineEntry[];
  qaps: QAPSpecification[];
}

export interface TimelineEntry {
  level: number;
  action: string;
  user?: string;
  timestamp: Date;
  comments?: string;
}

export interface QAPSpecification {
  sno: number;
  criteria: string;
  subCriteria?: string;
  componentOperation?: string;
  characteristics?: string;
  class?: string;
  typeOfCheck?: string;
  sampling?: string;
  specification?: string;
  defect?: string;
  defectClass?: string;
  description?: string;
  criteriaLimits?: string;
  match?: 'yes' | 'no';
  customerSpecification?: string;
  selectedForReview?: boolean;
  reviewBy?: string[];
}

export interface DropdownOption {
  value: string;
  label: string;
}
