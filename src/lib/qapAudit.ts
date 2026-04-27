import { QAPFormData, ROLE_LABELS, UserRole } from "@/types/qap";

export type WorkflowStageKey =
  | "level-1"
  | "level-2"
  | "level-3"
  | "level-4"
  | "final-comments"
  | "level-5";

export type AuditEventKind =
  | "submission"
  | "transition"
  | "response"
  | "edit"
  | "comment"
  | "final-comments"
  | "approval"
  | "rejection";

export interface QapCommentEvent {
  id: string;
  qapId: string;
  level?: number;
  role?: string;
  stage: string;
  actor: string;
  timestamp: string | Date | null;
  timeMs: number;
  comment: string;
  commentLines: string[];
  source: "level-response" | "final-comments" | "approval-feedback" | "timeline";
}

export interface QapAuditEvent {
  id: string;
  qapId: string;
  kind: AuditEventKind;
  level?: number;
  role?: string;
  stage: string;
  actor: string;
  timestamp: string | Date | null;
  timeMs: number;
  title: string;
  detail: string;
}

export interface WorkflowStageStart {
  id: string;
  qapId: string;
  stageKey: WorkflowStageKey;
  stageLabel: string;
  timestamp: string | Date | null;
  timeMs: number;
  round: number;
  source: string;
}

type ReviewThreadEntry = {
  by?: string;
  at?: string | Date | null;
  responses?: Record<string, unknown>;
};

type EditDelta = { field?: string; before?: unknown; after?: unknown };
type EditRowChange = { sno?: number; deltas?: EditDelta[] };
type BomDiff = {
  changed?: Array<{ component: string }>;
  added?: Array<{ component: string }>;
  removed?: Array<{ component: string }>;
};
type EditEvent = {
  by?: string;
  at?: string | Date | null;
  header?: EditDelta[];
  mqp?: EditRowChange[];
  visual?: EditRowChange[];
  bom?: BomDiff;
  scope?: string;
  comment?: string;
  summary?: string;
};

const STAGE_LABELS: Record<WorkflowStageKey, string> = {
  "level-1": "Level 1 Review",
  "level-2": "Level 2 Review",
  "level-3": "Level 3 Review",
  "level-4": "Level 4 Review",
  "final-comments": "Final Comments",
  "level-5": "Level 5 Approval",
};

const titleCase = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/\w\S*/g, (token) =>
      token[0].toUpperCase() + token.slice(1).toLowerCase()
    );

const safeText = (value: unknown, fallback = "-") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    const json = JSON.stringify(value);
    return json && json !== "{}" && json !== "[]" ? json : fallback;
  } catch {
    return fallback;
  }
};

export const getTimestampMs = (value?: string | Date | null) => {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

export const formatDurationMs = (milliseconds?: number | null) => {
  if (!milliseconds || milliseconds <= 0) return "0m";

  const totalMinutes = Math.round(milliseconds / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || !parts.length) parts.push(`${minutes}m`);
  return parts.join(" ");
};

export const humanizeRole = (role?: string | null) => {
  const normalized = String(role || "")
    .trim()
    .replace(/-2$/, "") as UserRole;
  return ROLE_LABELS[normalized] || titleCase(normalized || "Unknown");
};

export const getStageLabel = (level?: number, role?: string | null) => {
  if (role) {
    return level ? `Level ${level} / ${humanizeRole(role)}` : humanizeRole(role);
  }

  if (level === 5) return STAGE_LABELS["level-5"];
  if (level === 4) return STAGE_LABELS["level-4"];
  if (level === 3) return STAGE_LABELS["level-3"];
  if (level === 2) return STAGE_LABELS["level-2"];
  if (level === 1) return STAGE_LABELS["level-1"];
  return "Workflow";
};

const parseJsonArray = <T = unknown>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const isThreadEntry = (value: unknown): value is ReviewThreadEntry =>
  !!value && typeof value === "object" && ("responses" in value || "at" in value);

const valueToCommentText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const known = value as Record<string, unknown>;
    const candidate =
      known.text ?? known.comment ?? known.message ?? known.value ?? null;
    if (typeof candidate === "string") return candidate.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
};

export const responseMapToLines = (
  responses?: Record<string, unknown> | null
): string[] => {
  return Object.entries(responses || {})
    .map(([key, rawValue]) => {
      const text = valueToCommentText(rawValue);
      if (!text) return "";
      const label = /^\d+$/.test(key) ? `Spec ${key}` : titleCase(key);
      return `${label}: ${text}`;
    })
    .filter(Boolean);
};

export const normalizeCommentThread = (
  raw: unknown,
  fallbackBy?: string | null,
  fallbackAt?: string | Date | null
): ReviewThreadEntry[] => {
  const thread = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? parseJsonArray<ReviewThreadEntry>(raw)
    : isThreadEntry(raw)
    ? [raw]
    : raw && typeof raw === "object"
    ? [
        {
          by: fallbackBy || "unknown",
          at: fallbackAt || null,
          responses: raw as Record<string, unknown>,
        },
      ]
    : [];

  return thread
    .filter(Boolean)
    .map((entry) => ({
      by: safeText(entry.by, fallbackBy || "unknown"),
      at: entry.at || fallbackAt || null,
      responses:
        entry.responses && typeof entry.responses === "object"
          ? entry.responses
          : {},
    }));
};

const humanizeEditScope = (scope: string) =>
  scope
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

const buildEditSummary = (event: EditEvent) => {
  if (typeof event.summary === "string" && event.summary.trim()) {
    return event.summary.trim();
  }

  const headerCount = Array.isArray(event.header) ? event.header.length : 0;
  const mqpCount = Array.isArray(event.mqp) ? event.mqp.length : 0;
  const visualCount = Array.isArray(event.visual) ? event.visual.length : 0;
  const bomCount =
    (event.bom?.changed?.length || 0) +
    (event.bom?.added?.length || 0) +
    (event.bom?.removed?.length || 0);

  const parts: string[] = [];
  if (event.scope && event.scope.trim() && event.scope !== "none") {
    parts.push(humanizeEditScope(event.scope.trim()));
  }
  if (headerCount) parts.push(`Header ${headerCount}`);
  if (mqpCount) parts.push(`MQP ${mqpCount}`);
  if (visualCount) parts.push(`Visual ${visualCount}`);
  if (bomCount) parts.push(`BOM ${bomCount}`);
  if (event.comment && event.comment.trim()) parts.push(event.comment.trim());
  return parts.join(" | ") || "QAP edited";
};

const parseEditEvents = (qap: QAPFormData | Record<string, unknown>) => {
  const source = qap as QAPFormData & {
    editCommentsParsed?: EditEvent[];
    editChanges?: unknown;
  };

  if (Array.isArray(source.editCommentsParsed)) {
    return source.editCommentsParsed;
  }

  return parseJsonArray<EditEvent>(source.editChanges);
};

export const getQapCommentEvents = (qap: QAPFormData): QapCommentEvent[] => {
  const events: QapCommentEvent[] = [];

  Object.entries(qap.levelResponses || {}).forEach(([levelKey, roles]) => {
    const level = Number(levelKey);
    Object.entries(roles || {}).forEach(([role, details]) => {
      const thread = normalizeCommentThread(
        details?.comments,
        details?.username,
        details?.respondedAt || null
      );

      thread.forEach((entry, index) => {
        const lines = responseMapToLines(
          entry.responses as Record<string, unknown>
        );
        if (!lines.length) return;

        events.push({
          id: `${qap.id}-comment-${level}-${role}-${index}`,
          qapId: qap.id,
          level,
          role,
          stage: getStageLabel(level, role),
          actor: safeText(entry.by, details?.username || "unknown"),
          timestamp: entry.at || details?.respondedAt || null,
          timeMs: getTimestampMs(entry.at || details?.respondedAt || null),
          comment: lines.join(" | "),
          commentLines: lines,
          source: "level-response",
        });
      });
    });
  });

  if (qap.finalComments && String(qap.finalComments).trim()) {
    const text = String(qap.finalComments).trim();
    events.push({
      id: `${qap.id}-final-comments`,
      qapId: qap.id,
      level: 4,
      role: "requestor",
      stage: STAGE_LABELS["final-comments"],
      actor: safeText(qap.finalCommentsBy, qap.submittedBy || "Requestor"),
      timestamp: qap.finalCommentsAt || null,
      timeMs: getTimestampMs(qap.finalCommentsAt || null),
      comment: text,
      commentLines: [text],
      source: "final-comments",
    });
  }

  if (qap.feedback && String(qap.feedback).trim()) {
    const text = String(qap.feedback).trim();
    events.push({
      id: `${qap.id}-approval-feedback`,
      qapId: qap.id,
      level: 5,
      role: "plant-head",
      stage: STAGE_LABELS["level-5"],
      actor: safeText(qap.approver, "Plant Head"),
      timestamp: qap.approvedAt || null,
      timeMs: getTimestampMs(qap.approvedAt || null),
      comment: text,
      commentLines: [text],
      source: "approval-feedback",
    });
  }

  (qap.timeline || []).forEach((entry, index) => {
    if (!entry?.comments || !String(entry.comments).trim()) return;
    const text = String(entry.comments).trim();
    events.push({
      id: `${qap.id}-timeline-comment-${index}`,
      qapId: qap.id,
      level: entry.level,
      stage: getStageLabel(entry.level),
      actor: safeText(entry.user, "system"),
      timestamp: entry.timestamp || null,
      timeMs: getTimestampMs(entry.timestamp || null),
      comment: text,
      commentLines: [text],
      source: "timeline",
    });
  });

  return events.sort((a, b) => a.timeMs - b.timeMs);
};

const parseTransitionStage = (action: string): WorkflowStageKey | null => {
  const normalized = action.toLowerCase();

  if (normalized.includes("reopened level 2")) return "level-2";
  if (normalized.includes("sent to level 2")) return "level-2";
  if (normalized.includes("sent to level 3")) return "level-3";
  if (normalized.includes("sent to level 4")) return "level-4";
  if (
    normalized.includes("sent back to requestor for final comments") ||
    normalized.includes("sent to requestor for final comments")
  ) {
    return "final-comments";
  }
  if (
    normalized.includes("sent to plant head") ||
    normalized.includes("plant head") ||
    normalized.includes("level 5")
  ) {
    return "level-5";
  }
  return null;
};

export const getWorkflowStageStarts = (qap: QAPFormData): WorkflowStageStart[] => {
  const starts: WorkflowStageStart[] = [];
  const roundCounts: Record<WorkflowStageKey, number> = {
    "level-1": 0,
    "level-2": 0,
    "level-3": 0,
    "level-4": 0,
    "final-comments": 0,
    "level-5": 0,
  };

  const submissionAt = qap.submittedAt || qap.createdAt || null;
  if (submissionAt) {
    roundCounts["level-1"] += 1;
    starts.push({
      id: `${qap.id}-stage-level-1-1`,
      qapId: qap.id,
      stageKey: "level-1",
      stageLabel: STAGE_LABELS["level-1"],
      timestamp: submissionAt,
      timeMs: getTimestampMs(submissionAt),
      round: 1,
      source: "submission",
    });
  }

  [...(qap.timeline || [])]
    .sort(
      (a, b) => getTimestampMs(a?.timestamp || null) - getTimestampMs(b?.timestamp || null)
    )
    .forEach((entry, index) => {
      const stageKey = parseTransitionStage(String(entry?.action || ""));
      if (!stageKey) return;
      roundCounts[stageKey] += 1;
      starts.push({
        id: `${qap.id}-stage-${stageKey}-${roundCounts[stageKey]}-${index}`,
        qapId: qap.id,
        stageKey,
        stageLabel: STAGE_LABELS[stageKey],
        timestamp: entry.timestamp || null,
        timeMs: getTimestampMs(entry.timestamp || null),
        round: roundCounts[stageKey],
        source: safeText(entry.action, "timeline"),
      });
    });

  return starts.sort((a, b) => a.timeMs - b.timeMs);
};

export const findStageStartForTime = (
  starts: WorkflowStageStart[],
  stageKey: WorkflowStageKey,
  timeMs: number
) => {
  const matches = starts
    .filter((entry) => entry.stageKey === stageKey && entry.timeMs <= timeMs)
    .sort((a, b) => b.timeMs - a.timeMs);
  return matches[0] || null;
};

export const buildQapTimelineEvents = (qap: QAPFormData): QapAuditEvent[] => {
  const events: QapAuditEvent[] = [];

  const submittedAt = qap.submittedAt || qap.createdAt || null;
  if (submittedAt) {
    events.push({
      id: `${qap.id}-submission`,
      qapId: qap.id,
      kind: "submission",
      level: 1,
      role: "requestor",
      stage: STAGE_LABELS["level-1"],
      actor: safeText(qap.submittedBy, "Requestor"),
      timestamp: submittedAt,
      timeMs: getTimestampMs(submittedAt),
      title: "QAP submitted",
      detail: `${safeText(qap.customerName)} / ${safeText(qap.projectName)}`,
    });
  }

  Object.entries(qap.levelResponses || {}).forEach(([levelKey, roles]) => {
    const level = Number(levelKey);
    Object.entries(roles || {}).forEach(([role, details]) => {
      const thread = normalizeCommentThread(
        details?.comments,
        details?.username,
        details?.respondedAt || null
      );

      if (!thread.length && details?.acknowledged) {
        events.push({
          id: `${qap.id}-response-${level}-${role}-ack`,
          qapId: qap.id,
          kind: "response",
          level,
          role,
          stage: getStageLabel(level, role),
          actor: safeText(details?.username, "unknown"),
          timestamp: details?.respondedAt || null,
          timeMs: getTimestampMs(details?.respondedAt || null),
          title: level === 1 ? "Level 1 review submitted" : "Response submitted",
          detail: "Acknowledged without row-level comment",
        });
      }

      thread.forEach((entry, index) => {
        const lines = responseMapToLines(
          entry.responses as Record<string, unknown>
        );
        events.push({
          id: `${qap.id}-response-${level}-${role}-${index}`,
          qapId: qap.id,
          kind: "response",
          level,
          role,
          stage: getStageLabel(level, role),
          actor: safeText(entry.by, details?.username || "unknown"),
          timestamp: entry.at || details?.respondedAt || null,
          timeMs: getTimestampMs(entry.at || details?.respondedAt || null),
          title:
            level === 1 ? "Level 1 review submitted" : "Response submitted",
          detail: lines.join(" | ") || "Acknowledged without row-level comment",
        });
      });
    });
  });

  parseEditEvents(qap).forEach((event, index) => {
    events.push({
      id: `${qap.id}-edit-${index}`,
      qapId: qap.id,
      kind: "edit",
      stage: "Requestor Edit",
      actor: safeText(event.by, qap.submittedBy || "Requestor"),
      timestamp: event.at || qap.lastModifiedAt || null,
      timeMs: getTimestampMs(event.at || qap.lastModifiedAt || null),
      title: "QAP edited",
      detail: buildEditSummary(event),
    });
  });

  (qap.timeline || []).forEach((entry, index) => {
    events.push({
      id: `${qap.id}-timeline-${index}`,
      qapId: qap.id,
      kind: "transition",
      level: entry.level,
      stage: getStageLabel(entry.level),
      actor: safeText(entry.user, "system"),
      timestamp: entry.timestamp || null,
      timeMs: getTimestampMs(entry.timestamp || null),
      title: safeText(entry.action, "Workflow transition"),
      detail: entry.comments ? String(entry.comments) : "",
    });
  });

  if (qap.finalComments && String(qap.finalComments).trim()) {
    events.push({
      id: `${qap.id}-final-comments`,
      qapId: qap.id,
      kind: "final-comments",
      level: 4,
      role: "requestor",
      stage: STAGE_LABELS["final-comments"],
      actor: safeText(qap.finalCommentsBy, qap.submittedBy || "Requestor"),
      timestamp: qap.finalCommentsAt || null,
      timeMs: getTimestampMs(qap.finalCommentsAt || null),
      title: "Final comments submitted",
      detail: String(qap.finalComments).trim(),
    });
  }

  if (qap.approvedAt && qap.approver) {
    const approved = String(qap.status || "").toLowerCase() === "approved";
    events.push({
      id: `${qap.id}-${approved ? "approval" : "rejection"}`,
      qapId: qap.id,
      kind: approved ? "approval" : "rejection",
      level: 5,
      role: "plant-head",
      stage: STAGE_LABELS["level-5"],
      actor: safeText(qap.approver, "Plant Head"),
      timestamp: qap.approvedAt,
      timeMs: getTimestampMs(qap.approvedAt),
      title: approved ? "QAP approved" : "QAP rejected",
      detail: qap.feedback ? String(qap.feedback) : "",
    });
  }

  const deduped = new Map<string, QapAuditEvent>();
  events
    .sort((a, b) => a.timeMs - b.timeMs)
    .forEach((event) => {
      const key = [
        event.kind,
        event.level || "-",
        event.role || "-",
        event.actor,
        event.timeMs,
        event.title,
        event.detail,
      ].join("|");
      if (!deduped.has(key)) {
        deduped.set(key, event);
      }
    });

  return Array.from(deduped.values()).sort((a, b) => a.timeMs - b.timeMs);
};
