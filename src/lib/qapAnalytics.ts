import { QAPFormData, UserRole } from "@/types/qap";
import {
  buildQapTimelineEvents,
  findStageStartForTime,
  formatDurationMs,
  getQapCommentEvents,
  getTimestampMs,
  getWorkflowStageStarts,
  humanizeRole,
  normalizeCommentThread,
  responseMapToLines,
  WorkflowStageKey,
} from "@/lib/qapAudit";

export interface AnalyticsFilters {
  plant: string;
  timeframe: string;
  status: string;
}

export interface AnalyticsDatasetRow {
  id: string;
  ref: string;
  customerName: string;
  projectName: string;
  plant: string;
  status: string;
  currentLevel: number;
  submittedBy: string;
  submittedAt: string | Date | null;
  approvedAt: string | Date | null;
  cycleTimeMs: number;
  cycleTimeLabel: string;
  totalSpecs: number;
  matchedSpecs: number;
  agreedSpecs: number;
  mismatchedSpecs: number;
  level1Closed: number;
  commentCount: number;
  eventCount: number;
  reopenedCount: number;
}

export interface PersonTatRecord {
  id: string;
  qapId: string;
  ref: string;
  customerName: string;
  projectName: string;
  plant: string;
  status: string;
  person: string;
  role: string;
  stageKey: WorkflowStageKey | "requestor-final-comments";
  stageLabel: string;
  round: number;
  startedAt: string | Date | null;
  respondedAt: string | Date | null;
  tatMs: number;
  tatLabel: string;
  commentCount: number;
}

export interface PersonTatSummary {
  person: string;
  roles: string[];
  averageTatMs: number;
  averageTatLabel: string;
  medianTatMs: number;
  medianTatLabel: string;
  maxTatMs: number;
  maxTatLabel: string;
  count: number;
  qapCount: number;
  stageLabels: string[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  "level-1": "Level 1",
  "level-2": "Level 2",
  "level-3": "Level 3",
  "level-3b": "Level 3 Re-review",
  "level-4": "Level 4",
  "level-4b": "Level 4 Re-review",
  "final-comments": "Final Comments",
  "level-5": "Level 5",
  approved: "Approved",
  rejected: "Rejected",
};

const SPEC_FAMILIES = ["MQP", "Visual EL"] as const;
type SpecFamily = (typeof SPEC_FAMILIES)[number];

const stageKeyForLevel = (level: number): WorkflowStageKey =>
  level === 4
    ? "level-4"
    : level === 3
    ? "level-3"
    : level === 2
    ? "level-2"
    : "level-1";

const normalizeStatusLabel = (status?: string | null) =>
  STATUS_LABELS[String(status || "").toLowerCase()] ||
  String(status || "Unknown")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getAllSpecs = (qap: QAPFormData) => {
  const mqp = Array.isArray(qap.specs?.mqp) ? qap.specs.mqp : [];
  const visual = Array.isArray(qap.specs?.visual) ? qap.specs.visual : [];
  return [...mqp, ...visual];
};

const getSpecFamilyRows = (qap: QAPFormData) => [
  ...(qap.specs?.mqp || []).map((row) => ({ family: "MQP" as SpecFamily, row })),
  ...(qap.specs?.visual || []).map((row) => ({
    family: "Visual EL" as SpecFamily,
    row,
  })),
];

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

export const getVisiblePlants = (qapData: QAPFormData[]) =>
  Array.from(
    new Set(
      qapData
        .map((qap) => String(qap.plant || "").toLowerCase())
        .filter(Boolean)
    )
  ).sort();

export const filterQapData = (
  qapData: QAPFormData[],
  filters: AnalyticsFilters,
  user?: { role: UserRole; plant?: string | null } | null
) => {
  const plantFilter = String(filters.plant || "all").toLowerCase();
  const statusFilter = String(filters.status || "all").toLowerCase();
  const timeframeFilter = String(filters.timeframe || "all").toLowerCase();
  const userPlants = String(user?.plant || "")
    .split(",")
    .map((plant) => plant.trim().toLowerCase())
    .filter(Boolean);

  return qapData.filter((qap) => {
    const qapPlant = String(qap.plant || "").toLowerCase();

    if (user?.role !== "admin" && userPlants.length && !userPlants.includes(qapPlant)) {
      return false;
    }

    if (plantFilter !== "all" && qapPlant !== plantFilter) {
      return false;
    }

    if (
      statusFilter !== "all" &&
      String(qap.status || "").toLowerCase() !== statusFilter
    ) {
      return false;
    }

    if (timeframeFilter !== "all") {
      const days =
        timeframeFilter === "7d"
          ? 7
          : timeframeFilter === "30d"
          ? 30
          : timeframeFilter === "90d"
          ? 90
          : 365;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const submittedMs = getTimestampMs(qap.submittedAt || qap.createdAt || null);
      if (!submittedMs || submittedMs < cutoff) return false;
    }

    return true;
  });
};

export const buildDatasetRows = (qapData: QAPFormData[]): AnalyticsDatasetRow[] =>
  qapData.map((qap) => {
    const specs = getAllSpecs(qap);
    const commentCount = getQapCommentEvents(qap).length;
    const timelineEvents = buildQapTimelineEvents(qap);
    const closedByLevel1 = specs.filter(
      (spec: any) =>
        String(spec.initialMatch || "").toLowerCase() === "no" &&
        ["yes", "agreed"].includes(String(spec.match || "").toLowerCase())
    ).length;
    const submittedAt = qap.submittedAt || qap.createdAt || null;
    const submittedMs = getTimestampMs(submittedAt);
    const approvedMs = getTimestampMs(qap.approvedAt || null);
    const lastMs = getTimestampMs(qap.lastModifiedAt || null);
    const cycleTimeMs =
      approvedMs && submittedMs
        ? Math.max(0, approvedMs - submittedMs)
        : submittedMs && lastMs
        ? Math.max(0, lastMs - submittedMs)
        : 0;

    return {
      id: qap.id,
      ref:
        qap.projectCode ||
        qap.salesRequest?.projectCode ||
        qap.id.slice(0, 8).toUpperCase(),
      customerName: qap.customerName,
      projectName: qap.projectName,
      plant: String(qap.plant || "").toUpperCase(),
      status: normalizeStatusLabel(qap.status),
      currentLevel: Number(qap.currentLevel || 0),
      submittedBy: qap.submittedBy || "-",
      submittedAt,
      approvedAt: qap.approvedAt || null,
      cycleTimeMs,
      cycleTimeLabel: formatDurationMs(cycleTimeMs),
      totalSpecs: specs.length,
      matchedSpecs: specs.filter(
        (spec: any) => String(spec.match || "").toLowerCase() === "yes"
      ).length,
      agreedSpecs: specs.filter(
        (spec: any) => String(spec.match || "").toLowerCase() === "agreed"
      ).length,
      mismatchedSpecs: specs.filter(
        (spec: any) => String(spec.match || "").toLowerCase() === "no"
      ).length,
      level1Closed: closedByLevel1,
      commentCount,
      eventCount: timelineEvents.length,
      reopenedCount: timelineEvents.filter((event) =>
        event.title.toLowerCase().includes("reopened level 2")
      ).length,
    };
  });

export const derivePersonTatRecords = (qap: QAPFormData): PersonTatRecord[] => {
  const starts = getWorkflowStageStarts(qap);
  const records: PersonTatRecord[] = [];
  const ref =
    qap.projectCode || qap.salesRequest?.projectCode || qap.id.slice(0, 8);

  Object.entries(qap.levelResponses || {}).forEach(([levelKey, roles]) => {
    const level = Number(levelKey);
    const stageKey = stageKeyForLevel(level);

    Object.entries(roles || {}).forEach(([role, details]) => {
      const thread = normalizeCommentThread(
        details?.comments,
        details?.username,
        details?.respondedAt || null
      );
      const entries =
        thread.length || !details?.respondedAt
          ? thread
          : [
              {
                by: details.username || role,
                at: details.respondedAt || null,
                responses: {},
              },
            ];

      entries.forEach((entry, index) => {
        const respondedAt = entry.at || details?.respondedAt || null;
        const respondedMs = getTimestampMs(respondedAt);
        if (!respondedMs) return;

        const start = findStageStartForTime(starts, stageKey, respondedMs);
        const tatMs = Math.max(0, respondedMs - (start?.timeMs || respondedMs));
        const commentCount = responseMapToLines(
          entry.responses as Record<string, unknown>
        ).length;

        records.push({
          id: `${qap.id}-${level}-${role}-${index}`,
          qapId: qap.id,
          ref,
          customerName: qap.customerName,
          projectName: qap.projectName,
          plant: String(qap.plant || "").toUpperCase(),
          status: normalizeStatusLabel(qap.status),
          person:
            String(entry.by || details?.username || "").trim() ||
            humanizeRole(role),
          role: humanizeRole(role),
          stageKey,
          stageLabel: level === 1 ? "Level 1 Review" : `Level ${level} Review`,
          round: start?.round || 1,
          startedAt: start?.timestamp || qap.submittedAt || qap.createdAt || null,
          respondedAt,
          tatMs,
          tatLabel: formatDurationMs(tatMs),
          commentCount,
        });
      });
    });
  });

  if (qap.finalCommentsAt && qap.finalCommentsBy) {
    const respondedMs = getTimestampMs(qap.finalCommentsAt);
    const start = findStageStartForTime(starts, "final-comments", respondedMs);
    const tatMs = Math.max(0, respondedMs - (start?.timeMs || respondedMs));
    records.push({
      id: `${qap.id}-final-comments`,
      qapId: qap.id,
      ref,
      customerName: qap.customerName,
      projectName: qap.projectName,
      plant: String(qap.plant || "").toUpperCase(),
      status: normalizeStatusLabel(qap.status),
      person: String(qap.finalCommentsBy),
      role: "Requestor",
      stageKey: "requestor-final-comments",
      stageLabel: "Final Comments",
      round: start?.round || 1,
      startedAt: start?.timestamp || null,
      respondedAt: qap.finalCommentsAt,
      tatMs,
      tatLabel: formatDurationMs(tatMs),
      commentCount: qap.finalComments ? 1 : 0,
    });
  }

  if (qap.approvedAt && qap.approver) {
    const respondedMs = getTimestampMs(qap.approvedAt);
    const start = findStageStartForTime(starts, "level-5", respondedMs);
    const tatMs = Math.max(0, respondedMs - (start?.timeMs || respondedMs));
    records.push({
      id: `${qap.id}-level-5`,
      qapId: qap.id,
      ref,
      customerName: qap.customerName,
      projectName: qap.projectName,
      plant: String(qap.plant || "").toUpperCase(),
      status: normalizeStatusLabel(qap.status),
      person: String(qap.approver),
      role: "Plant Head",
      stageKey: "level-5",
      stageLabel: "Level 5 Approval",
      round: start?.round || 1,
      startedAt: start?.timestamp || null,
      respondedAt: qap.approvedAt,
      tatMs,
      tatLabel: formatDurationMs(tatMs),
      commentCount: qap.feedback ? 1 : 0,
    });
  }

  return records.sort(
    (a, b) =>
      getTimestampMs(a.respondedAt || null) - getTimestampMs(b.respondedAt || null)
  );
};

export const buildPersonTatSummary = (records: PersonTatRecord[]) => {
  const grouped = new Map<string, PersonTatRecord[]>();

  records.forEach((record) => {
    const key = `${record.person}||${record.role}`;
    const current = grouped.get(key) || [];
    current.push(record);
    grouped.set(key, current);
  });

  const summaries: PersonTatSummary[] = Array.from(grouped.entries()).map(
    ([key, rows]) => {
      const [person, role] = key.split("||");
      const tatValues = rows.map((row) => row.tatMs).filter(Boolean);
      const averageTatMs = tatValues.length
        ? Math.round(
            tatValues.reduce((sum, value) => sum + value, 0) / tatValues.length
          )
        : 0;
      const medianTatMs = median(tatValues);
      const maxTatMs = tatValues.length ? Math.max(...tatValues) : 0;

      return {
        person,
        roles: Array.from(new Set([role, ...rows.map((row) => row.role)])).filter(
          Boolean
        ),
        averageTatMs,
        averageTatLabel: formatDurationMs(averageTatMs),
        medianTatMs,
        medianTatLabel: formatDurationMs(medianTatMs),
        maxTatMs,
        maxTatLabel: formatDurationMs(maxTatMs),
        count: rows.length,
        qapCount: new Set(rows.map((row) => row.qapId)).size,
        stageLabels: Array.from(new Set(rows.map((row) => row.stageLabel))),
      };
    }
  );

  return summaries.sort((a, b) => b.averageTatMs - a.averageTatMs);
};

export const buildAnalyticsSnapshot = (qapData: QAPFormData[]) => {
  const datasetRows = buildDatasetRows(qapData);
  const commentFeed = qapData.flatMap(getQapCommentEvents);
  const tatRecords = qapData.flatMap(derivePersonTatRecords);
  const tatSummary = buildPersonTatSummary(tatRecords);

  const totalSpecs = qapData.flatMap(getAllSpecs);
  const totalSpecsCount = totalSpecs.length;
  const matchedSpecs = totalSpecs.filter(
    (spec: any) => String(spec.match || "").toLowerCase() === "yes"
  ).length;
  const agreedSpecs = totalSpecs.filter(
    (spec: any) => String(spec.match || "").toLowerCase() === "agreed"
  ).length;
  const mismatchedSpecs = totalSpecs.filter(
    (spec: any) => String(spec.match || "").toLowerCase() === "no"
  ).length;

  const approvedCount = qapData.filter(
    (qap) => String(qap.status || "").toLowerCase() === "approved"
  ).length;
  const rejectedCount = qapData.filter(
    (qap) => String(qap.status || "").toLowerCase() === "rejected"
  ).length;
  const openCount = qapData.filter(
    (qap) =>
      !["approved", "rejected"].includes(String(qap.status || "").toLowerCase())
  ).length;
  const approvalRate = qapData.length
    ? Math.round((approvedCount / qapData.length) * 100)
    : 0;
  const reopenedCount = datasetRows.reduce(
    (sum, row) => sum + row.reopenedCount,
    0
  );
  const cycleTimeValues = datasetRows
    .map((row) => row.cycleTimeMs)
    .filter((value) => value > 0);
  const averageCycleTimeMs = cycleTimeValues.length
    ? Math.round(
        cycleTimeValues.reduce((sum, value) => sum + value, 0) /
          cycleTimeValues.length
      )
    : 0;

  const statusData = Object.entries(
    qapData.reduce<Record<string, number>>((acc, qap) => {
      const key = String(qap.status || "unknown").toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({
    key: status,
    label: normalizeStatusLabel(status),
    count,
  }));

  const plantData = Object.entries(
    qapData.reduce<Record<string, Record<string, number>>>((acc, qap) => {
      const plant = String(qap.plant || "").toUpperCase();
      const status = String(qap.status || "").toLowerCase();
      if (!acc[plant]) {
        acc[plant] = { approved: 0, rejected: 0, open: 0 };
      }
      if (status === "approved") acc[plant].approved += 1;
      else if (status === "rejected") acc[plant].rejected += 1;
      else acc[plant].open += 1;
      return acc;
    }, {})
  ).map(([plant, totals]) => ({
    plant,
    ...totals,
    total: totals.approved + totals.rejected + totals.open,
  }));

  const trendWindow = 14;
  const trendData = Array.from({ length: trendWindow }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (trendWindow - 1 - index));
    const key = date.toISOString().slice(0, 10);
    const dayRows = qapData.filter(
      (qap) =>
        String(qap.submittedAt || qap.createdAt || "").slice(0, 10) === key
    );
    const approvals = qapData.filter(
      (qap) => String(qap.approvedAt || "").slice(0, 10) === key
    ).length;
    const reopens = qapData
      .flatMap(buildQapTimelineEvents)
      .filter(
        (event) =>
          event.title.toLowerCase().includes("reopened level 2") &&
          String(event.timestamp || "").slice(0, 10) === key
      ).length;

    return {
      date: key,
      submitted: dayRows.length,
      approved: approvals,
      reopened: reopens,
    };
  });

  const specHealthData = SPEC_FAMILIES.map((family) => {
    const familyRows = qapData.flatMap((qap) =>
      getSpecFamilyRows(qap).filter((entry) => entry.family === family)
    );
    return {
      family,
      matched: familyRows.filter(
        ({ row }: any) => String(row.match || "").toLowerCase() === "yes"
      ).length,
      agreed: familyRows.filter(
        ({ row }: any) => String(row.match || "").toLowerCase() === "agreed"
      ).length,
      mismatched: familyRows.filter(
        ({ row }: any) => String(row.match || "").toLowerCase() === "no"
      ).length,
    };
  });

  const level1ResolutionData = (() => {
    let matched = 0;
    let agreed = 0;
    let pending = 0;

    qapData.forEach((qap) => {
      getAllSpecs(qap).forEach((spec: any) => {
        const initialNo = String(spec.initialMatch || "").toLowerCase() === "no";
        if (!initialNo) return;
        const current = String(spec.match || "").toLowerCase();
        if (current === "yes") matched += 1;
        else if (current === "agreed") agreed += 1;
        else pending += 1;
      });
    });

    return [
      { key: "matched", label: "Turned Green", count: matched },
      { key: "agreed", label: "Turned Yellow", count: agreed },
      { key: "pending", label: "Still Red", count: pending },
    ];
  })();

  const stageTatData = Object.entries(
    tatRecords.reduce<Record<string, number[]>>((acc, record) => {
      acc[record.stageLabel] = acc[record.stageLabel] || [];
      acc[record.stageLabel].push(record.tatMs);
      return acc;
    }, {})
  ).map(([stageLabel, values]) => {
    const averageTatMs = values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;
    return {
      stageLabel,
      averageTatMs,
      averageTatHours: Math.round((averageTatMs / (1000 * 60 * 60)) * 10) / 10,
      samples: values.length,
      label: formatDurationMs(averageTatMs),
    };
  });

  const datasetVisibility = {
    qaps: qapData.length,
    specs: totalSpecsCount,
    comments: commentFeed.length,
    events: qapData.flatMap(buildQapTimelineEvents).length,
    tatSamples: tatRecords.length,
  };

  return {
    datasetRows,
    commentFeed,
    tatRecords,
    tatSummary,
    statusData,
    plantData,
    trendData,
    specHealthData,
    level1ResolutionData,
    stageTatData,
    datasetVisibility,
    totals: {
      qaps: qapData.length,
      approved: approvedCount,
      rejected: rejectedCount,
      open: openCount,
      approvalRate,
      reopenedCount,
      totalSpecs: totalSpecsCount,
      matchedSpecs,
      agreedSpecs,
      mismatchedSpecs,
      averageCycleTimeMs,
      averageCycleTimeLabel: formatDurationMs(averageCycleTimeMs),
    },
  };
};
