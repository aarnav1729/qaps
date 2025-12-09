import { QAPFormData } from "@/types/qap";

// ----------------------------- Helpers -----------------------------

const safe = (v: any, fallback = "-") =>
  v === null || v === undefined || v === "" ? fallback : v;

const escapeHtml = (input: any) => {
  const s = String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatPremierDate = (d?: string | Date | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(+dt)) return "-";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(dt.getDate()).padStart(2, "0")} ${
    months[dt.getMonth()]
  } ${dt.getFullYear()}`;
};

const formatPremierDateTime = (d?: string | Date | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(+dt)) return "-";
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const titleCase = (s: string) =>
  s
    ? s
        .replace(/[-_]/g, " ")
        .replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase())
    : s;

// Slightly smarter asArray:
// - Accepts arrays
// - Accepts { items: [] } shapes (common in reducers/serializers)
function asArray<T = any>(v: any): T[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as T[];

  // ✅ NEW: allow JSON string arrays
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {}
  }

  if (typeof v === "object" && Array.isArray((v as any).items)) {
    return (v as any).items as T[];
  }
  return [];
}

// Return the first non-empty array among candidates
const firstNonEmptyArray = <T = any>(...cands: any[]): T[] => {
  for (const c of cands) {
    const arr = asArray<T>(c);
    if (arr.length) return arr;
  }
  return [];
};

// =======================
// PDF_EDIT_AND_APPROVAL_HELPERS
// =======================

type EditDelta = { field?: string; before?: any; after?: any };
type EditRowChange = { sno?: number; deltas?: EditDelta[] };

type BomDiff = {
  changed?: Array<{ component: string; before?: any; after?: any }>;
  added?: Array<{ component: string; after?: any }>;
  removed?: Array<{ component: string; before?: any }>;
};

type EditEvent = {
  by?: string;
  at?: string;
  header?: EditDelta[];
  mqp?: EditRowChange[];
  visual?: EditRowChange[];
  bom?: BomDiff;
  scope?: string;
  comment?: string;
  summary?: string;
};

type ApprovalEntry = {
  level: number;
  role: string;
  by: string;
  at: string;
  action: "approved" | "rejected";
  commentCount?: number;
  feedback?: string | null;
};

// Human-friendly label for the "Event" column in PDF
function humanizeEditEventLabel(evt: EditEvent, index: number) {
  const scope = String(evt.scope || "")
    .toLowerCase()
    .trim();

  if (scope === "reset-level-2" || scope === "reopen-level-2") {
    return "Reopened Level 2";
  }

  // If you later add more scopes, map here
  if (scope && scope !== "none") {
    // turn kebab-case into spaced Title-ish text
    return scope
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // If a summary exists, use a short neutral label
  if (evt.summary && evt.summary.trim()) return "Edit";

  // Safe fallback (avoid "Change 1")
  return "Edit";
}

function safeParseEditChanges(editChangesRaw: any): EditEvent[] {
  try {
    if (!editChangesRaw) return [];
    if (Array.isArray(editChangesRaw)) return editChangesRaw as EditEvent[];
    if (typeof editChangesRaw === "string") {
      const parsed = JSON.parse(editChangesRaw);
      return Array.isArray(parsed) ? (parsed as EditEvent[]) : [];
    }
    return [];
  } catch {
    return [];
  }
}

// Summary builder aligned with server logic
function buildEditSummaryFallback(evt: EditEvent) {
  try {
    const h = Array.isArray(evt.header) ? evt.header.length : 0;
    const m = Array.isArray(evt.mqp) ? evt.mqp.length : 0;
    const v = Array.isArray(evt.visual) ? evt.visual.length : 0;

    const b =
      evt.bom &&
      (Array.isArray(evt.bom.changed) ||
        Array.isArray(evt.bom.added) ||
        Array.isArray(evt.bom.removed))
        ? (evt.bom.changed?.length || 0) +
          (evt.bom.added?.length || 0) +
          (evt.bom.removed?.length || 0)
        : 0;

    const parts: string[] = [];
    const scope = String(evt.scope || "").trim();
    if (scope && scope !== "none") parts.push(`Scope: ${scope}`);
    if (h) parts.push(`Header: ${h}`);
    if (m) parts.push(`MQP: ${m}`);
    if (v) parts.push(`Visual: ${v}`);
    if (b) parts.push(`BOM: ${b}`);

    return parts.join(" • ") || "Edited";
  } catch {
    return "Edited";
  }
}

// Convert edit events into the PDF table rows
export function buildEditLogTableRows(qap: any) {
  const events: EditEvent[] = Array.isArray(qap?.editCommentsParsed)
    ? qap.editCommentsParsed
    : safeParseEditChanges(qap?.editChanges);

  return events.map((evt, i) => {
    const eventLabel = humanizeEditEventLabel(evt, i);
    const user = evt.by || qap?.editedBy || "unknown";
    const ts = evt.at || qap?.editedAt || qap?.lastModifiedAt || "";

    const summary =
      (evt.summary && evt.summary.trim()) || buildEditSummaryFallback(evt);

    return {
      event: eventLabel,
      user,
      timestamp: ts,
      summary,
    };
  });
}

// Prefer server-provided approvalsTrail; else derive from nested levelResponses
export function buildApprovalsTableRows(qap: any): ApprovalEntry[] {
  if (Array.isArray(qap?.approvalsTrail) && qap.approvalsTrail.length) {
    return qap.approvalsTrail as ApprovalEntry[];
  }

  const out: ApprovalEntry[] = [];
  const lr = qap?.levelResponses || {};

  // levels 2,3,4
  [2, 3, 4].forEach((lvl) => {
    const rolesObj = lr?.[lvl] || {};
    for (const role of Object.keys(rolesObj)) {
      const r = rolesObj[role];
      const ack = r?.acknowledged === true || r?.acknowledged === 1;
      if (!ack) continue;

      const respondedAt = r?.respondedAt || "";
      const username = r?.username || "unknown";
      const commentsArr = Array.isArray(r?.comments) ? r.comments : [];
      out.push({
        level: lvl,
        role,
        by: username,
        at: respondedAt,
        action: "approved",
        commentCount: commentsArr.length,
      });
    }
  });

  // level 5 plant-head outcome stored on master row
  const status = String(qap?.status || "").toLowerCase();
  if (
    (status === "approved" || status === "rejected") &&
    qap?.approver &&
    qap?.approvedAt
  ) {
    out.push({
      level: 5,
      role: "plant-head",
      by: qap.approver,
      at: qap.approvedAt,
      action: status as "approved" | "rejected",
      feedback: qap.feedback || null,
    });
  }

  // ✅ safer date comparator (prevents NaN from breaking order)
  const safeTime = (d: any) => {
    const t = new Date(d || "").getTime();
    return Number.isFinite(t) ? t : 0;
  };

  out.sort((a, b) => safeTime(a.at) - safeTime(b.at));

  return out;
}

// Try to discover “audit trail / approvals / comments / edits”
// across slightly different shapes.
// Try to discover “audit trail / approvals / comments / edits”
// across slightly different shapes AND likely nesting locations.

const getApprovalsTrail = (qap: any) =>
  firstNonEmptyArray(
    // ✅ server-native
    qap?.approvalsTrail,
    qap?.timeline,
    qap?.timelineEntries,

    // top-level
    qap?.approvals,
    qap?.approvalTrail,
    qap?.approvalHistory,
    qap?.approvalsHistory,
    qap?.workflowApprovals,
    qap?.approvalLogs,

    // audit containers
    qap?.auditTrail?.approvals,
    qap?.auditTrail?.approvalTrail,
    qap?.auditTrail?.approvalHistory,
    qap?.audit?.approvals,
    qap?.audit?.approvalHistory,

    // workflow/meta containers
    qap?.workflow?.approvals,
    qap?.workflow?.approvalTrail,
    qap?.meta?.approvals,
    qap?.meta?.approvalHistory,

    // sales request nesting
    qap?.salesRequest?.approvals,
    qap?.salesRequest?.approvalTrail,
    qap?.salesRequest?.approvalHistory,
    qap?.salesRequest?.approvalLogs,
    qap?.salesDetails?.approvals,
    qap?.salesDetails?.approvalTrail,
    qap?.requestDetails?.approvals,
    qap?.requestDetails?.approvalTrail,

    // nested audit inside sales request
    qap?.salesRequest?.auditTrail?.approvals,
    qap?.salesRequest?.auditTrail?.approvalHistory
  );

const getComments = (qap: any) =>
  firstNonEmptyArray(
    // ✅ server-native
    qap?.level2CommentFeed,

    // top-level
    qap?.comments,
    qap?.reviewComments,
    qap?.feedbackLog,
    qap?.commentLogs,
    qap?.notes,

    // audit containers
    qap?.auditTrail?.comments,
    qap?.auditTrail?.reviewComments,
    qap?.audit?.comments,

    // workflow/meta
    qap?.workflow?.comments,
    qap?.meta?.comments,

    // sales nesting
    qap?.salesRequest?.comments,
    qap?.salesRequest?.reviewComments,
    qap?.salesRequest?.feedbackLog,
    qap?.salesDetails?.comments,
    qap?.requestDetails?.comments,

    // nested audit inside sales
    qap?.salesRequest?.auditTrail?.comments
  );

const getEdits = (qap: any) =>
  firstNonEmptyArray(
    // ✅ server-native
    qap?.editCommentsParsed,
    qap?.editChanges, // string array now supported by asArray

    // existing guesses
    qap?.edits,
    qap?.changeLogs,
    qap?.historyLogs,
    qap?.history,
    qap?.auditTrail,
    qap?.activityLogs,

    // audit containers
    qap?.auditTrail?.edits,
    qap?.auditTrail?.changeLogs,
    qap?.auditTrail?.historyLogs,

    qap?.audit?.historyLogs,
    qap?.audit?.activityLogs,

    // workflow/meta
    qap?.workflow?.historyLogs,
    qap?.workflow?.activityLogs,
    qap?.meta?.historyLogs,

    // sales nesting
    qap?.salesRequest?.edits,
    qap?.salesRequest?.changeLogs,
    qap?.salesRequest?.historyLogs,
    qap?.salesRequest?.activityLogs,
    qap?.salesDetails?.historyLogs,
    qap?.requestDetails?.historyLogs,

    // nested audit inside sales
    qap?.salesRequest?.auditTrail?.historyLogs,
    qap?.salesRequest?.auditTrail?.activityLogs
  );

// Sales request block is often embedded differently.
const getSalesRequest = (qap: any) =>
  qap?.salesRequest || qap?.salesDetails || qap?.requestDetails || null;

// BOM selections may be stored under various keys
const getSelectedBom = (qap: any) =>
  qap?.bomSelections || qap?.bom || qap?.selectedBom || qap?.bomData || {};

// ----------------------------- Sales Summary Special Renderers -----------------------------
const pickBinningValue = (x: any) => {
  if (x === null || x === undefined) return "-";

  // Primitive
  if (["string", "number", "boolean"].includes(typeof x)) return x;

  // Common nested object shapes
  if (typeof x === "object") {
    const pct = x?.pct ?? x?.percent ?? x?.percentage;

    if (pct !== undefined && pct !== null && Number.isFinite(Number(pct))) {
      return `${Number(pct)}%`;
    }

    return (
      x?.value ??
      x?.val ??
      x?.percentage ??
      x?.percent ??
      x?.pct ?? // ✅ add this
      x?.share ??
      x?.ratio ??
      x?.qty ??
      x?.count ??
      x?.number ??
      (Object.keys(x).length ? JSON.stringify(x) : "-")
    );
  }

  return String(x);
};

const normalizeBinning = (v: any) => {
  if (!v) return [];

  // Array form
  // Array form
  if (Array.isArray(v)) {
    return v.map((x) => ({
      bin:
        x?.bin ??
        x?.grade ??
        x?.label ??
        x?.name ??
        x?.class ??
        x?.range ??
        x?.wattage ??
        x?.band ??
        "Bin",
      value: pickBinningValue(
        x?.value ??
          x?.val ??
          x?.percentage ??
          x?.percent ??
          x?.pct ?? // ✅ add this
          x?.share ??
          x?.ratio ??
          x?.qty ??
          x?.count ??
          x?.number ??
          x
      ),
    }));
  }

  // Object map form
  // Object map form
  if (typeof v === "object") {
    return Object.entries(v).map(([k, val]) => ({
      bin: k,
      value: pickBinningValue(val),
    }));
  }

  return [];
};

const renderBinningMiniTable = (v: any) => {
  const rows = normalizeBinning(v);
  if (!rows.length) return `<span class="muted">-</span>`;

  const tr = rows
    .slice(0, 80)
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(String(r.bin))}</td>
        <td>${escapeHtml(String(r.value))}</td>
      </tr>
    `
    )
    .join("");

  return `
    <div class="mini-wrap">
      <table class="mini-table">
        <thead>
          <tr><th>Bin</th><th>Value</th></tr>
        </thead>
        <tbody>${tr}</tbody>
      </table>
    </div>
  `;
};

const renderBomMiniSummary = (v: any) => {
  if (!v || typeof v !== "object") {
    return `<span>${escapeHtml(String(safe(v)))}</span>`;
  }

  // If it's the full bom object, show a compact callout
  const vendorName = v?.vendorName ?? v?.vendor ?? v?.vendorLockIn ?? "-";
  const rfid = v?.rfidLocation ?? v?.rfid ?? v?.rfidLockIn ?? "-";
  const tech = v?.technologyProposed ?? v?.technology ?? "";
  const docRef = v?.documentRef ?? v?.docRef ?? "";

  return `
    <div class="mini-callout">
      <div><b>Vendor Lock-in:</b> ${escapeHtml(String(vendorName))}</div>
      <div><b>RFID Location:</b> ${escapeHtml(String(rfid))}</div>
      ${tech ? `<div><b>Technology:</b> ${escapeHtml(String(tech))}</div>` : ""}
      ${
        docRef
          ? `<div><b>Document Ref:</b> ${escapeHtml(String(docRef))}</div>`
          : ""
      }
    </div>
  `;
};

// Render value inside grid with special-case formatting
const renderSalesValue = (key: string, value: any) => {
  const k = String(key || "").toLowerCase();

  // Avoid duplicating a giant BOM object here; you already render a full BOM section later
  if (k === "bom") return `<span class="muted">See BOM Summary section.</span>`;

  if (k.includes("binning")) {
    return renderBinningMiniTable(value);
  }

  if (k.includes("bomsummary") || k.includes("bom summary")) {
    return renderBomMiniSummary(value);
  }

  // Array of primitives -> chips
  if (Array.isArray(value)) {
    const allPrim = value.every(
      (x) =>
        x === null ||
        x === undefined ||
        ["string", "number", "boolean"].includes(typeof x)
    );
    if (allPrim) {
      const chips = value
        .slice(0, 50)
        .map((x) => `<span class="chip">${escapeHtml(String(safe(x)))}</span>`)
        .join("");
      return `<div class="chip-row">${
        chips || `<span class="muted">-</span>`
      }</div>`;
    }
  }

  // Object -> compact JSON-like block (not full pretty JSON to save space)
  if (typeof value === "object" && value !== null) {
    try {
      const json = JSON.stringify(value);
      return `<div class="json-inline">${escapeHtml(json)}</div>`;
    } catch {
      return `<div class="json-inline">${escapeHtml(String(value))}</div>`;
    }
  }

  // Number formatting
  if (typeof value === "number") {
    return escapeHtml(value.toLocaleString());
  }

  return escapeHtml(String(safe(value)));
};

// ----------------------------- Renderers -----------------------------

const renderKeyValueGrid = (obj: any) => {
  if (!obj || typeof obj !== "object") return "";

  const entries = Object.entries(obj)
    .filter(([_, v]) => v !== undefined)
    .filter(([k]) => String(k).toLowerCase() !== "audittrail") // avoid noisy nested logs in summary
    .slice(0, 200);

  if (entries.length === 0) return "";

  const rows = entries
    .map(([k, v]) => {
      const key = titleCase(k);

      // Allow rich HTML for special keys; otherwise safe-escaped strings
      const valHtml = renderSalesValue(k, v);

      return `
        <div class="detail-item">
          <div class="detail-label">${escapeHtml(key)}</div>
          <div class="detail-value">${valHtml}</div>
        </div>
      `;
    })
    .join("");

  return `<div class="detail-grid">${rows}</div>`;
};

const normalizeSpecRow = (row: any) => {
  if (!row || typeof row !== "object") {
    return {
      parameter: "Item",
      customerSpec: "-",
      pelSpec: "-",
      remarks: "-",
      match: "-",
      editedAt: null,
      editedBy: null,
    };
  }

  return {
    // Parameter / "what is this row about?"
    parameter:
      row.parameter ||
      row.subCriteria || // ✅ MQP + Visual DB
      row.componentOperation || // ✅ MQP DB
      row.characteristics || // ✅ MQP DB (fallback label)
      row.defect || // ✅ Visual DB
      row.name ||
      row.item ||
      row.spec ||
      row.check ||
      row.label ||
      "Item",

    // Customer side
    customerSpec:
      row.customerSpec ||
      row.customerSpecification || // ✅ MQP + Visual DB
      row.customer ||
      row.customerRequirement ||
      row.req ||
      row.expected ||
      row.value ||
      "-",

    // Premier/internal side
    pelSpec:
      row.pelSpec ||
      row.specification || // ✅ MQP DB
      row.criteriaLimits || // ✅ Visual DB
      row.premierSpec ||
      row.internalSpec ||
      row.actual ||
      row.offered ||
      row.response ||
      "-",

    // Notes
    remarks:
      row.remarks ||
      row.description || // ✅ Visual DB
      row.comment ||
      row.notes ||
      row.reason ||
      "-",

    // Match status
    match: row.match || row.status || row.result || "-",

    // Best-effort "last edit"
    editedAt:
      row.editedAt ||
      row.updatedAt ||
      row.modifiedAt ||
      row.respondedAt ||
      null,

    editedBy:
      row.editedBy ||
      row.updatedBy ||
      row.modifiedBy ||
      row.reviewBy || // ✅ DB has reviewBy
      row.username ||
      null,
  };
};

const renderSpecsTable = (title: string, specs: any[]) => {
  const rows = (specs || []).map((r) => normalizeSpecRow(r));
  if (rows.length === 0) {
    return `
      <div class="section">
        <div class="section-title">${escapeHtml(title)}</div>
        <div class="empty-note">No items recorded.</div>
      </div>
    `;
  }

  const tr = rows
    .map((r) => {
      const matchLower = String(r.match || "").toLowerCase();
      const matchClass =
        matchLower === "yes" || matchLower === "matched" || matchLower === "ok"
          ? "pill pill-green"
          : matchLower === "no" ||
            matchLower === "unmatched" ||
            matchLower === "ng"
          ? "pill pill-red"
          : "pill pill-gray";

      return `
        <tr>
          <td>${escapeHtml(r.parameter)}</td>
          <td>${escapeHtml(r.customerSpec)}</td>
          <td>${escapeHtml(r.pelSpec)}</td>
          <td>${escapeHtml(r.remarks)}</td>
          <td><span class="${matchClass}">${escapeHtml(
        titleCase(String(r.match || "-"))
      )}</span></td>
          <td class="muted">
            ${escapeHtml(safe(r.editedBy, "-"))}
            <br/>
            ${escapeHtml(formatPremierDateTime(r.editedAt))}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="section">
      <div class="section-title">${escapeHtml(title)}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Customer Spec</th>
              <th>Premier Spec</th>
              <th>Remarks / Notes</th>
              <th>Match</th>
              <th>Last Edit</th>
            </tr>
          </thead>
          <tbody>
            ${tr}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const renderBomSection = (qap: any) => {
  // Prefer embedded Sales Request BOM (as used in Level5ApprovalPage)
  const salesRequest =
    qap?.salesRequest || qap?.salesDetails || qap?.requestDetails || null;

  const bom = salesRequest?.bom || qap?.bom || null;

  if (!bom) {
    return `
        <div class="section">
          <div class="section-title">BOM Summary</div>
          <div class="empty-note">No BOM available on this QAP.</div>
        </div>
      `;
  }

  const vendorLockIn = bom.vendorName || "-";
  const rfidLockIn = bom.rfidLocation || "-";

  // Flatten component rows if present
  const components = Array.isArray(bom.components) ? bom.components : [];

  const rows = components
    .flatMap((c: any) => {
      const compName = c?.name || "Component";
      const compRows = Array.isArray(c?.rows) ? c.rows : [];

      if (compRows.length === 0) {
        return [
          `
              <tr>
                <td>${escapeHtml(compName)}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
            `,
        ];
      }

      return compRows.map(
        (r: any) => `
          <tr>
            <td>${escapeHtml(compName)}</td>
            <td>${escapeHtml(safe(r?.model))}</td>
            <td>${escapeHtml(safe(r?.subVendor))}</td>
            <td>${escapeHtml(safe(r?.spec, "—"))}</td>
          </tr>
        `
      );
    })
    .join("");

  return `
      <div class="section">
        <div class="section-title">BOM Summary</div>
  
        <div class="callout">
          <div><b>Vendor Lock-in:</b> ${escapeHtml(vendorLockIn)}</div>
          <div><b>RFID Location Lock-in:</b> ${escapeHtml(rfidLockIn)}</div>
          ${
            bom.technologyProposed
              ? `<div><b>Technology Proposed:</b> ${escapeHtml(
                  bom.technologyProposed
                )}</div>`
              : ""
          }
          ${
            bom.documentRef
              ? `<div><b>Document Ref:</b> ${escapeHtml(bom.documentRef)}</div>`
              : ""
          }
        </div>
  
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Selected Model</th>
                <th>Sub-Vendor</th>
                <th>Spec / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rows || ""}
            </tbody>
          </table>
        </div>
      </div>
    `;
};

const renderApprovals = (qap: any) => {
  // ✅ Canonical, deterministic approvals rows
  const approvalsRows = buildApprovalsTableRows(qap);

  // Fallback to loose discovery ONLY if builder yields nothing
  const approvalsFallback = approvalsRows.length ? [] : getApprovalsTrail(qap);

  // -------------------- Builder-first render --------------------
  if (approvalsRows.length) {
    const rows = approvalsRows
      .map((a, idx) => {
        const levelLabel =
          a.level && a.role
            ? `Level ${a.level} • ${titleCase(String(a.role))}`
            : `Step ${idx + 1}`;

        const by = a.by || "-";
        const action = a.action || "-";

        const comment =
          a.feedback ??
          (typeof a.commentCount === "number"
            ? `${a.commentCount} comment${a.commentCount === 1 ? "" : "s"}`
            : "-");

        const at = a.at || null;

        const actionLower = String(action).toLowerCase();
        const pillClass =
          actionLower.includes("approve") || actionLower === "approved"
            ? "pill pill-green"
            : actionLower.includes("reject") || actionLower === "rejected"
            ? "pill pill-red"
            : "pill pill-gray";

        return `
            <tr>
              <td>${escapeHtml(titleCase(levelLabel))}</td>
              <td>${escapeHtml(String(by))}</td>
              <td><span class="${pillClass}">${escapeHtml(
          titleCase(String(action))
        )}</span></td>
              <td>${escapeHtml(String(comment))}</td>
              <td>${escapeHtml(formatPremierDateTime(at))}</td>
            </tr>
          `;
      })
      .join("");

    return `
        <div class="section">
          <div class="section-title">Approvals Trail</div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Level / Stage</th>
                  <th>Approver</th>
                  <th>Action</th>
                  <th>Comment / Notes</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
  }

  // -------------------- Loose-fallback render --------------------
  if (!approvalsFallback.length) {
    return `
        <div class="section">
          <div class="section-title">Approvals Trail</div>
          <div class="empty-note">No approvals recorded.</div>
        </div>
      `;
  }

  const rows = approvalsFallback
    .map((a: any, idx: number) => {
      const level =
        a.level || a.stage || a.role || a.approvalLevel || `Step ${idx + 1}`;

      const by = a.by || a.name || a.approver || a.approvedBy || a.user || "-";

      const action = a.action || a.status || a.decision || a.event || "-";

      const comment = a.comment || a.feedback || a.remarks || a.note || "-";

      const at =
        a.at || a.timestamp || a.createdAt || a.updatedAt || a.date || null;

      const actionLower = String(action).toLowerCase();
      const pillClass =
        actionLower.includes("approve") || actionLower === "approved"
          ? "pill pill-green"
          : actionLower.includes("reject") || actionLower === "rejected"
          ? "pill pill-red"
          : "pill pill-gray";

      return `
          <tr>
            <td>${escapeHtml(titleCase(String(level)))}</td>
            <td>${escapeHtml(String(by))}</td>
            <td><span class="${pillClass}">${escapeHtml(
        titleCase(String(action))
      )}</span></td>
            <td>${escapeHtml(String(comment))}</td>
            <td>${escapeHtml(formatPremierDateTime(at))}</td>
          </tr>
        `;
    })
    .join("");

  return `
      <div class="section">
        <div class="section-title">Approvals Trail</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Level / Stage</th>
                <th>Approver</th>
                <th>Action</th>
                <th>Comment</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
};

const renderEdits = (qap: any) => {
  // ✅ Canonical edit-event rows aligned with your server logic
  const editRows = buildEditLogTableRows(qap);

  // If canonical rows exist, use them
  if (editRows.length) {
    const rows = editRows
      .map((e, idx) => {
        const event = e.event || `Edit ${idx + 1}`;
        const user = e.user || "-";
        const at = e.timestamp || null;
        const summary = e.summary || "-";

        return `
            <tr>
              <td>${escapeHtml(titleCase(String(event)))}</td>
              <td>${escapeHtml(String(user))}</td>
              <td>${escapeHtml(formatPremierDateTime(at))}</td>
              <td>${escapeHtml(String(summary))}</td>
            </tr>
          `;
      })
      .join("");

    return `
        <div class="section">
          <div class="section-title">Events / Edit Log</div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>User</th>
                  <th>Timestamp</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
  }

  // -------------------- Old loose fallback (kept) --------------------
  const edits = getEdits(qap);
  if (!edits.length) {
    return `
        <div class="section">
          <div class="section-title">Events / Edit Log</div>
          <div class="empty-note">No edits recorded.</div>
        </div>
      `;
  }

  const rows = edits
    .map((e: any, idx: number) => {
      const type =
        e.type || e.action || e.event || e.kind || `Change ${idx + 1}`;
      const by = e.by || e.user || e.actor || e.updatedBy || "-";
      const at =
        e.at || e.timestamp || e.updatedAt || e.createdAt || e.date || null;

      const summary =
        e.summary ||
        e.note ||
        e.description ||
        (e.scope ? `Scope: ${e.scope}` : "") ||
        (e.header || e.mqp || e.visual || e.bom
          ? JSON.stringify({
              header: e.header || [],
              mqp: e.mqp || [],
              visual: e.visual || [],
              bom: e.bom || { changed: [], added: [], removed: [] },
            })
          : "-");

      return `
          <tr>
            <td>${escapeHtml(titleCase(String(type)))}</td>
            <td>${escapeHtml(String(by))}</td>
            <td>${escapeHtml(formatPremierDateTime(at))}</td>
            <td>${escapeHtml(String(summary))}</td>
          </tr>
        `;
    })
    .join("");

  return `
      <div class="section">
        <div class="section-title">Events / Edit Log</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th>Timestamp</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
};

const renderComments = (qap: any) => {
  const comments = getComments(qap);
  if (!comments.length) {
    return `
      <div class="section">
        <div class="section-title">Comments</div>
        <div class="empty-note">No comments recorded.</div>
      </div>
    `;
  }

  const rows = comments
    .map((c: any, idx: number) => {
      const by = c.by || c.user || c.name || c.author || c.role || "-";

      const at =
        c.at || c.timestamp || c.createdAt || c.updatedAt || c.date || null;
      const text =
        c.text ||
        c.comment ||
        c.message ||
        c.feedback ||
        (c.responses && typeof c.responses === "object"
          ? Object.entries(c.responses)
              .map(([sno, msg]) => `#${sno}: ${msg}`)
              .join(" | ")
          : "-");

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(String(by))}</td>
          <td>${escapeHtml(formatPremierDateTime(at))}</td>
          <td>${escapeHtml(String(text))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="section">
      <div class="section-title">Comments</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>By</th>
              <th>Timestamp</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
};

// ----------------------------- Main Template -----------------------------

export const generateQapApprovalPdfHtml = (qap: QAPFormData): string => {
  const anyQap = qap as any;

  const mqp = asArray(
    anyQap?.specs?.mqp ??
      anyQap?.mqp ??
      anyQap?.mqpSpecs ??
      anyQap?.MQPSpecs ??
      []
  );

  const visual = asArray(
    anyQap?.specs?.visual ??
      anyQap?.visual ??
      anyQap?.visualSpecs ??
      anyQap?.VisualSpecs ??
      []
  );

  const sales = getSalesRequest(anyQap);

  // use your public logo path (same style as warranty)
  // ensure pel.png exists in /public or your configured static path
  const LOGO_URL = "/pel.png";

  const submittedAt =
    anyQap.submittedAt || anyQap.createdAt || anyQap.requestedAt || null;

  // ✅ You want "Approved At" to be current system time during PDF generation
  const approvedAtDisplay = new Date();

  const docRef =
    anyQap.qapRefNumber || anyQap.referenceNumber || `QAP-${Date.now()}`;

  const certificateHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QAP Approval Summary</title>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 12mm; }
    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0; padding: 0;
      width: auto; max-width: 100%;
      font-family: 'Hanken Grotesk', Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    img { max-width: 100%; height: auto; display: block; }

    .doc {
      width: 100%;
      max-width: 100%;
      padding: 26px;
      position: relative;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding-bottom: 14px;
      border-bottom: 3px solid #1e88e5;
      margin-bottom: 18px;
    }

    .badge {
      background: linear-gradient(135deg, #1e88e5, #4caf50);
      color: #fff;
      padding: 8px 18px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .logo {
      max-width: 170px;
      flex: 0 1 170px;
    }

    .title {
      text-align: center;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 1px;
      margin: 12px 0 6px;
      text-transform: uppercase;
    }

    .subtitle {
      text-align: center;
      font-size: 12px;
      color: #475569;
      margin-bottom: 14px;
    }

    .ref-box {
      background: #f8fafc;
      border-left: 4px solid #1e88e5;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 12px;
      color: #334155;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
      margin-bottom: 16px;
    }

    .ref-item b { color: #0f172a; }

    .section {
      margin: 18px 0 22px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #1e88e5;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: .6px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: minmax(0,1fr) minmax(0,1fr);
      gap: 10px;
    }

    .detail-item {
      background: #fafafa;
      border-left: 3px solid #1e88e5;
      padding: 8px 10px;
      border-radius: 5px;
    }

    .detail-label {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: .4px;
      margin-bottom: 3px;
    }

    .detail-value {
      font-size: 12.5px;
      font-weight: 500;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: #0f172a;
    }

    .callout {
      background: #ecfeff;
      border: 1px solid #bae6fd;
      border-left: 4px solid #0ea5e9;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      color: #0f172a;
      margin-bottom: 10px;
    }

    .table-wrap {
      overflow: hidden;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .data-table thead th {
      background: #f1f5f9;
      text-align: left;
      padding: 8px 8px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1px solid #e5e7eb;
    }

    .data-table tbody td {
      padding: 7px 8px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    .data-table tbody tr:nth-child(even) td {
      background: #fcfcfd;
    }

    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .3px;
      text-transform: uppercase;
    }
    .pill-green { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .pill-red   { background: #fee2e2; color: #7f1d1d; border: 1px solid #fecaca; }
    .pill-gray  { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }

    .muted { color: #64748b; font-size: 10px; }

    .empty-note {
      font-size: 12px;
      color: #64748b;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      padding: 10px;
      border-radius: 6px;
    }

    .footer {
      margin-top: 26px;
      border-top: 3px solid #1e88e5;
      padding-top: 14px;
      text-align: center;
      page-break-inside: avoid;
    }

    .footer-logo {
      width: 190px;
      margin: 10px auto 6px;
    }

    .footer-address {
      font-size: 10.5px;
      color: #64748b;
      line-height: 1.35;
    }

    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.05;
      width: 240px;
      pointer-events: none;
      z-index: 0;
    }

    /* ---- New: Sales Summary micro-formatting ---- */

    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #0f172a;
      white-space: nowrap;
    }

    .json-inline {
      font-size: 10.5px;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      border-radius: 6px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .mini-callout {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #1e88e5;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11px;
    }

    .mini-wrap {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      overflow: hidden;
      background: #fff;
    }

    table.mini-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }

    .mini-table thead th {
      background: #f1f5f9;
      text-align: left;
      padding: 6px 6px;
      font-weight: 800;
      border-bottom: 1px solid #e5e7eb;
    }

    .mini-table tbody td {
      padding: 5px 6px;
      border-bottom: 1px solid #f1f5f9;
    }

    .mini-table tbody tr:nth-child(even) td {
      background: #fcfcfd;
    }

    @media print {
      .doc { padding: 18px; }
      .section, .table-wrap { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="doc">
    <img class="watermark" src="${LOGO_URL}" alt="Premier Watermark" />

    <div class="header">
      <div class="badge">QAP Approval Summary</div>
      <img src="${LOGO_URL}" class="logo" alt="Premier Energies Logo" />
    </div>

    <div class="title">Quality Assurance Plan</div>
    <div class="subtitle">Approved Technical & Commercial Configuration Summary</div>

    <div class="ref-box">
      <div class="ref-item"><b>Document Ref:</b> ${escapeHtml(docRef)}</div>
      <div class="ref-item"><b>QAP ID:</b> ${escapeHtml(safe(anyQap.id))}</div>
      <div class="ref-item"><b>Submitted At:</b> ${escapeHtml(
        formatPremierDateTime(submittedAt)
      )}</div>
      <div class="ref-item"><b>Approved At:</b> ${escapeHtml(
        formatPremierDateTime(approvedAtDisplay)
      )}</div>
    </div>

    <div class="section">
      <div class="section-title">Sales Request Summary</div>
      ${
        sales
          ? renderKeyValueGrid(sales)
          : `
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-label">Customer Name</div>
                <div class="detail-value">${escapeHtml(
                  safe(anyQap.customerName)
                )}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Project Name</div>
                <div class="detail-value">${escapeHtml(
                  safe(anyQap.projectName)
                )}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Plant</div>
                <div class="detail-value">${escapeHtml(
                  safe(anyQap.plant)
                )}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Product Type</div>
                <div class="detail-value">${escapeHtml(
                  safe(anyQap.productType)
                )}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Order Quantity</div>
                <div class="detail-value">${escapeHtml(
                  safe(
                    anyQap.orderQuantity?.toLocaleString?.() ??
                      anyQap.orderQuantity
                  )
                )}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Submitted By</div>
                <div class="detail-value">${escapeHtml(
                  safe(anyQap.submittedBy)
                )}</div>
              </div>
            </div>
          `
      }
    </div>

    ${renderSpecsTable("MQP Specifications", mqp)}
    ${renderSpecsTable("Visual / EL Specifications", visual)}
    ${renderBomSection(anyQap)}
    ${renderEdits(anyQap)}
    ${renderApprovals(anyQap)}
    ${renderComments(anyQap)}

    <div class="footer">
      <img src="${LOGO_URL}" alt="Premier Energies" class="footer-logo" />
      <div class="footer-address">
        8th Floor, Orbit Tower 1, Sy.No. 83/1, Hyderabad Knowledge City<br/>
        TSIIC, Raidurgam, Hyderabad – 500081, Telangana, India<br/>
        T: +91 40 27744415/16 | W: www.premierenergies.com
      </div>
      <div class="muted" style="margin-top:6px;">
        This is a computer-generated approval summary intended for internal and customer reference.
      </div>
    </div>
  </div>
</body>
</html>
`;

  return certificateHTML;
};

export const downloadQapApprovalPdf = (qap: QAPFormData) => {
  const html = generateQapApprovalPdfHtml(qap);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();

  // Ensure fonts/images load before print
  printWindow.onload = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.error("QAP PDF print failed:", e);
    }
  };
};

// Backward/Unified name used by Level5ApprovalPage
export const downloadQapAsPDF = (
  qap: QAPFormData,
  _meta?: {
    approvedLevel?: number;
    approvedBy?: string;
    approvalNote?: string;
    approvedAt?: string;
  }
) => {
  // Meta currently optional/non-blocking for build safety.
  // You can embed meta into HTML later if desired.
  return downloadQapApprovalPdf(qap);
};
