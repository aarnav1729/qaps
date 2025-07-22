
export interface User {
  id: string;
  username: string;
  password: string;
  role: 'requestor' | 'approver-p2' | 'approver-p4' | 'admin';
  plant?: string;
}

export interface QAPFormData {
  id: string;
  customerName: string;
  projectName: string;
  orderQuantity: number;
  productType: string;
  plant: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'edit-requested';
  submittedBy?: string;
  submittedAt?: Date;
  approver?: string;
  approvedAt?: Date;
  feedback?: string;
  editReason?: string;
  qaps: QAPSpecification[];
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
}

export interface DropdownOption {
  value: string;
  label: string;
}
