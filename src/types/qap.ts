// src/types/qap.ts

// ---- Auth / Users -----------------------------------------------------------

export type UserRole =
  | "requestor"
  | "production"
  | "quality"
  | "technical"
  | "head"
  | "technical-head"
  | "plant-head"
  | "admin"
  | "sales";

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  /**
   * Comma separated list of plants assigned to the user, e.g. "p2,p5".
   * Empty or missing → acts as "all plants".
   */
  plant?: string;
}

// ---- QAP domain -------------------------------------------------------------

export type QAPStatus =
  | "draft"
  | "submitted"
  | "level-2"
  | "level-3"
  | "level-4"
  | "final-comments"
  | "level-5"
  | "approved"
  | "rejected"
  // kept for UI compatibility although BE doesn’t emit them currently:
  | "edit-requested"
  | "level-3b"
  | "level-4b";

export type CurrentLevel = 1 | 2 | 3 | 4 | 5;

export interface LevelResponseDetails {
  username: string;
  acknowledged: boolean;
  /** keys are item indices (as numbers or numeric-like strings); values are comment text */
  comments: { [itemIndex: number]: string };
  respondedAt?: string | Date;
}

export type LevelResponses = {
  [level: number]: {
    [role: string]: LevelResponseDetails;
  };
};

export interface TimelineEntry {
  level: number;
  action: string;
  user?: string;
  timestamp: Date | string;
  /** milliseconds */
  duration?: number;
  comments?: string;
}

// Core “base” for a spec row
interface BaseSpec {
  sno: number;
  subCriteria?: string;
  /** "yes" | "no" if the row matches customer's spec */
  match?: "yes" | "no";
  /** free text typed by reviewer or mapped from customer */
  customerSpecification?: string;
  /** BE stores comma string; FE may use string[] — support both for safety */
  reviewBy?: string | string[];
  /** used by the UI to flag rows the requestor picked for review */
  selectedForReview?: boolean;
}

// MQP spec row (process/measurement type)
export interface MQPSpecification extends BaseSpec {
  componentOperation?: string;
  characteristics?: string;
  class?: string; // "Critical" | "Major" | "Minor"
  typeOfCheck?: string;
  sampling?: string;
  specification?: string;
  /** not used for MQP, but keep optional to allow easy flattening */
  defect?: string;
  defectClass?: string;
  description?: string;
  criteriaLimits?: string;
}

// Visual / EL spec row (defect-type)
export interface VisualSpecification extends BaseSpec {
  defect?: string;
  defectClass?: string;
  description?: string;
  criteriaLimits?: string;
  /** not used for Visual, but kept optional for the same reason */
  class?: string;
  typeOfCheck?: string;
  sampling?: string;
  specification?: string;
}

export type AnyQAPSpec = MQPSpecification | VisualSpecification;

/**
 * What the API now returns under each QAP: split spec arrays.
 * (Older snapshots may still have a flat `qaps` array; keep that optional.)
 */
export interface QAPSpecsBundle {
  mqp: MQPSpecification[];
  visual: VisualSpecification[];
}

export interface FinalCommentsAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

// Embedded Sales Request bits (subset that the UI typically needs)
export interface SalesRequestAttachment {
  title: string;
  url: string;
}

export interface SalesRequestSummary {
  id: string;
  projectCode?: string | null;
  customerName: string;

  moduleManufacturingPlant?: string | null; // "P2" | "P5" | "P6" (usually uppercased)
  moduleCellType?: string | null; // "M10" | "M10R" | "G12" | "G12R"
  cellType?: string | null; // "DCR" | "NDCR"
  cellTech?: string | null; // "PERC" | "TOPCon"
  cutCells?: number | string | null;

  rfqOrderQtyMW?: number;
  premierBiddedOrderQtyMW?: number | null;

  deliveryStartDate?: string | null; // "YYYY-MM-DD"
  deliveryEndDate?: string | null; // "YYYY-MM-DD"
  factoryAuditTentativeDate?: string | null;

  projectLocation?: string | null;
  cableLengthRequired?: number | null;

  qapType?: string | null; // "Customer" | "Premier Energies"
  qapTypeAttachmentUrl?: string | null;
  primaryBomAttachmentUrl?: string | null;

  bomFrom?: "Customer" | "Premier Energies" | undefined;
  bom?: unknown; // keep generic to avoid over-constraining the UI
  wattageBinningDist?: unknown;

  inlineInspection?: "yes" | "no";
  pdi?: "yes" | "no";
  cellProcuredBy?: string | null;
  agreedCTM?: number | null;
  xPitchMm?: number | null;
  trackerDetails?: number | null;

  priority?: "high" | "low";
  remarks?: string | null;

  otherAttachments?: SalesRequestAttachment[];

  createdBy?: string;
  createdAt?: string;
}

export interface QAPFormData {
  id: string;

  // header
  customerName: string;
  projectCode: string;
  projectName: string;
  orderQuantity: number;
  productType: string;
  plant: string;

  // status / routing
  status: QAPStatus;
  currentLevel: CurrentLevel;

  // submitter
  submittedBy?: string;
  salesRequestId?: string;
  submittedAt?: string | Date;

  // reviewers’ per-level responses
  levelResponses: LevelResponses;

  // final comments round-trip
  finalComments?: string;
  finalCommentsBy?: string;
  finalCommentsAt?: Date | string;
  /**
   * Some UIs use a single object; the BE currently exposes
   * `finalAttachmentName`/`finalAttachmentUrl`. Keep both.
   */
  finalCommentsAttachment?: FinalCommentsAttachment;
  finalAttachmentName?: string | null;
  finalAttachmentUrl?: string | null;

  // plant-head approval
  approver?: string;
  approvedAt?: Date | string;
  feedback?: string;

  // timeline
  timeline: TimelineEntry[];

  // specs
  /** New shape from API */
  specs: QAPSpecsBundle;
  /**
   * Legacy/compat: some older code still flattens specs into a single array.
   * When present, it’s simply mqp+visual flattened.
   */
  qaps?: AnyQAPSpec[];

  // analytics / bookkeeping
  createdAt?: Date | string;
  lastModifiedAt?: Date | string;
  levelStartTimes?: { [level: number]: Date | string };
  levelEndTimes?: { [level: number]: Date | string };

  // optional embedded SR payload for the BOM/summary tabs
  salesRequest?: SalesRequestSummary;
}

// ---- Misc small types -------------------------------------------------------

export interface DropdownOption {
  value: string;
  label: string;
}

export interface TurnaroundAnalytics {
  plant: string;
  level: number;
  user: string;
  averageTime: number; // ms
  count: number;
  role: string;
}
