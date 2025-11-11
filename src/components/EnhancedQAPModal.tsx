import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { QAPSpecification, QAPFormData } from "@/types/qap";
// Keep the static lists only as a fallback, not the primary source:
import {
  mqpSpecifications as FALLBACK_MQP,
  visualElSpecifications as FALLBACK_VISUAL,
} from "@/data/qapSpecifications";
import { useAuth } from "@/contexts/AuthContext";
import { Save, Send, RotateCcw } from "lucide-react";

// ADD: use same BOM option source as SalesRequestPage
import {
  BOM_MASTER,
  getOptionsFor,
  BomComponentName,
  BomComponentOption,
} from "@/data/bomMaster";
import { createPortal } from "react-dom";

const API = window.location.origin;

interface EnhancedQAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (qapData: QAPFormData, status?: string) => void;
  nextSno: number;
  editingQAP?: QAPFormData | null;
  canEdit?: boolean;
  /** Allow toggling Level-2 reviewBy checkboxes even if canEdit=false */
  allowAssignL2?: boolean;
}

// ⬇️ ADD: lightweight Sales Request shape (only fields we read)
//

// ⬇️ ADD/EXPAND: lightweight Sales Request shape (fields we render)
type SalesRequestLite = {
  id: string;
  projectCode: string;
  customerName: string;

  moduleManufacturingPlant: string; // P2|P4|P5|P6
  rfqOrderQtyMW: number;

  // Newer fields reflected in SalesRequestPage.tsx
  productCategory?: string | null;

  // Sub-fields
  moduleCellType?: "M10" | "G12" | "G12R" | null;
  cellTech?: "PERC" | "TOPCon" | null;
  cutCells?: "60" | "66" | "72" | "78" | string | null;

  // Compliance/quality/process
  cellType?: "DCR" | "NDCR";
  certificationRequired?:
    | "BIS"
    | "IEC"
    | "BIS + IEC"
    | "BIS + IEC + 3xIEC"
    | "Not Required";

  wattageBinningDist?: { range: string; pct: number }[];

  premierBiddedOrderQtyMW?: number | null;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  projectLocation: string;
  qapType?: "Customer" | "Premier Energies";
  qapTypeAttachmentUrl?: string | null;
  bomFrom?: "Customer" | "Premier Energies";
  primaryBomAttachmentUrl?: string | null;
  inlineInspection?: "yes" | "no";
  pdi?: "yes" | "no";
  cellProcuredBy?: "Customer" | "Premier Energies" | "Financed By Customer";
  agreedCTM?: number | null;
  factoryAuditTentativeDate?: string | null;
  xPitchMm?: number | null;
  trackerDetails?: number | null;
  priority?: "high" | "low";
  remarks?: string | null;
  otherAttachments?: { title: string; url: string }[];

  createdBy?: string;
  createdAt?: string;

  // BOM payload (header + components)
  bom?: BomPayload | null;

  // legacy / optional
  moduleOrderType?: "m10" | "g12r" | "g12";
};

type BomRow = {
  model: string;
  subVendor?: string | null;
  spec?: string | null;
};

type BomComponent = {
  name: string; // matches BOM_MASTER keys (string)
  rows: BomRow[];
};

type BomPayload = {
  vendorName?: string;
  rfidLocation?: string;
  vendorAddress?: string;
  documentRef?: string;

  // module meta
  moduleDimensionsOption?: string;
  moduleModelNumber?: string;
  wattPeakLabel?: string; // "MIN 560 WP"

  // rows
  components: BomComponent[];
};

// DB row shape (subset of QAPSpecifications)
type DbQapRow = {
  sno: number;
  criteria: string;
  subCriteria: string;
  componentOperation?: string | null;
  characteristics?: string | null;
  class: string;
  typeOfCheck?: string | null;
  sampling?: string | null;
  specification?: string | null;
  defectClass?: string | null;
  description?: string | null;
  criteriaLimits?: string | null;
};

async function fetchQapFromDb(kind: "mqp" | "visual"): Promise<DbQapRow[]> {
  const url = `${API}/api/qap-specifications?criteria=${kind}`;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(`Failed loading ${kind} specs`);
  return (await r.json()) as DbQapRow[];
}

function inflateRows(rows: DbQapRow[], startSno: number): QAPSpecification[] {
  return rows.map((r, idx) => ({
    // 👇 Keep UI serials independent of DB master ‘sno’ to avoid UX changes
    sno: startSno + idx,
    criteria: r.criteria,
    subCriteria: r.subCriteria,
    componentOperation: r.componentOperation || "",
    characteristics: r.characteristics || "",
    class: r.class as any,
    typeOfCheck: r.typeOfCheck || "",
    sampling: r.sampling || "",
    specification: r.specification || "",
    defect: undefined,
    defectClass: r.defectClass || undefined,
    description: r.description || undefined,
    criteriaLimits: r.criteriaLimits || undefined,
    // interaction fields
    match: undefined,
    customerSpecification: undefined,
    selectedForReview: false,
    reviewBy: [],
  }));
}

async function hydrateSalesRequest(
  sr: SalesRequestLite | null
): Promise<SalesRequestLite | null> {
  if (!sr?.id) return sr;
  try {
    const r = await fetch(`${API}/api/sales-requests/${sr.id}`, {
      credentials: "include",
    });
    if (!r.ok) return sr;
    const full = (await r.json()) as SalesRequestLite;
    // Merge so we keep anything already present
    return { ...sr, ...full };
  } catch {
    return sr;
  }
}

// ⬇️ ADD below other helpers, before the component:
const fmtNum = (n?: number | null) =>
  n === null || n === undefined ? "-" : Number(n).toLocaleString();
const fmtDec = (n?: number | null) =>
  n === null || n === undefined
    ? "-"
    : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

// ⬇️ NORMALIZE: keep reviewBy as string[] in the UI
const normalizeReviewBy = (
  rb: string | string[] | null | undefined
): string[] =>
  Array.isArray(rb)
    ? rb.filter(Boolean)
    : typeof rb === "string"
    ? rb
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const EnhancedQAPModal: React.FC<EnhancedQAPModalProps> = ({
  isOpen,
  onClose,
  onSave,
  nextSno,
  editingQAP,
  canEdit,
  allowAssignL2 = true, // allow editing by default
}) => {
  const { user } = useAuth();
  // NEW: Requestor can always edit, regardless of QAP status
  const hasEditRights = !editingQAP
    ? user?.role === "requestor"
    : user?.role === "requestor" &&
      user?.username &&
      editingQAP?.submittedBy === user.username;

  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [productType, setProductType] = useState("");
  const [plant, setPlant] = useState("");
  const [showReviewSelection, setShowReviewSelection] = useState(false);

  const [mqpData, setMqpData] = useState<QAPSpecification[]>([]);
  const [visualElData, setVisualElData] = useState<QAPSpecification[]>([]);

  const [linkedSR, setLinkedSR] = useState<SalesRequestLite | null>(null);
  const [loadingSR, setLoadingSR] = useState(false);

  // NEW: baselines for local before→after diff
  const [baselineHeader, setBaselineHeader] = useState<any | null>(null);
  const [baselineMqp, setBaselineMqp] = useState<QAPSpecification[] | null>(
    null
  );
  const [baselineVisual, setBaselineVisual] = useState<
    QAPSpecification[] | null
  >(null);
  const [baselineBom, setBaselineBom] = useState<BomPayload | null>(null);

  // When editing, capture baselines once when modal opens
  // When editing, capture baselines once when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (editingQAP) {
      setBaselineHeader({
        customerName: editingQAP.customerName || "",
        projectName: editingQAP.projectName || "",
        projectCode: editingQAP.projectCode || "",
        orderQuantity: editingQAP.orderQuantity || 0,
        productType: editingQAP.productType || "",
        plant: editingQAP.plant || "",
        status: (editingQAP as any).status,
        currentLevel: (editingQAP as any).currentLevel,
      });

      // Pull existing specs (supports legacy `qaps` or new `specs`)
      const m = Array.isArray(editingQAP.qaps)
        ? editingQAP.qaps.filter((q) => q.criteria === "MQP")
        : editingQAP.specs?.mqp || [];
      const v = Array.isArray(editingQAP.qaps)
        ? editingQAP.qaps.filter(
            (q) => q.criteria === "Visual" || q.criteria === "EL"
          )
        : editingQAP.specs?.visual || [];

      // ⬅️ Key change: normalize `reviewBy` to string[] for BASELINES too
      const normalizedM = (m || []).map((r) => ({
        ...r,
        reviewBy: normalizeReviewBy((r as any).reviewBy),
      }));
      const normalizedV = (v || []).map((r) => ({
        ...r,
        reviewBy: normalizeReviewBy((r as any).reviewBy),
      }));

      // Deep clone into baselines so we never mutate them later
      setBaselineMqp(JSON.parse(JSON.stringify(normalizedM)));
      setBaselineVisual(JSON.parse(JSON.stringify(normalizedV)));
    } else {
      setBaselineHeader(null);
      setBaselineMqp(null);
      setBaselineVisual(null);
    }
  }, [isOpen, editingQAP]);

  // Keep a BOM baseline from the linked SR snapshot once it loads
  useEffect(() => {
    if (!linkedSR) {
      setBaselineBom(null);
      return;
    }
    setBaselineBom(
      linkedSR.bom ? JSON.parse(JSON.stringify(linkedSR.bom)) : null
    );
  }, [linkedSR?.id]);

  const customerOptions = [
    "Premier Energies Limited",
    "Shakti  Pumps (India) Limited",
  ];

  const productOptions = [
    "Dual Glass M10 Perc",
    "Dual Glass M10 Topcon",
    "Dual Glass G12R Topcon",
    "Dual Glass G12 Topcon",
    "M10 Transparent Perc",
  ];
  const plantOptions = ["p2", "p5", "p6"];

  const [projectCode, setProjectCode] = useState("");
  const [projectCodeOptions, setProjectCodeOptions] = useState<string[]>([]);
  const [bomDraft, setBomDraft] = useState<BomPayload | null>(null);
  const [bomSaving, setBomSaving] = useState(false);
  const [bomError, setBomError] = useState<string | null>(null);
  const [bomSavedOnce, setBomSavedOnce] = useState(false);

  // ⬇️ add after other BOM state
  const [modelDialog, setModelDialog] = useState<
    { open: false } | { open: true; comp: BomComponentName; idx: number }
  >({ open: false });

  const openModelDialog = (comp: BomComponentName, idx: number) =>
    setModelDialog({ open: true, comp, idx });

  const closeModelDialog = () => setModelDialog({ open: false });

  // after the BOM imports
  const isBomName = (n: string): n is BomComponentName =>
    Object.prototype.hasOwnProperty.call(BOM_MASTER, n);

  // lock unchanged by default in edit mode
  const [lockUnchanged, setLockUnchanged] = useState<boolean>(!!editingQAP);

  // rows that the user explicitly unlocked (e.g., "Edit" clicked)
  const [unlockedRows, setUnlockedRows] = useState<Set<string>>(new Set());
  const unlockRow = (section: "mqp" | "visual", sno: number) => {
    setUnlockedRows((s) => new Set(s).add(`${section}:${sno}`));
  };
  const isUnlocked = (section: "mqp" | "visual", sno: number) =>
    unlockedRows.has(`${section}:${sno}`);

  const liveHeader = useMemo(
    () => ({
      customerName,
      projectName,
      projectCode,
      orderQuantity,
      productType,
      plant,
    }),
    [customerName, projectName, projectCode, orderQuantity, productType, plant]
  );

  const pendingHeader = useMemo(
    () => diffHeaderLocal(baselineHeader, liveHeader),
    [baselineHeader, liveHeader]
  );
  const pendingMqp = useMemo(
    () => diffSpecsLocal(baselineMqp, mqpData),
    [baselineMqp, mqpData]
  );
  const pendingVisual = useMemo(
    () => diffSpecsLocal(baselineVisual, visualElData),
    [baselineVisual, visualElData]
  );
  const pendingBom = useMemo(
    () => diffBomLocal(baselineBom, bomDraft),
    [baselineBom, bomDraft]
  );

  const hasPendingChanges = useMemo(
    () =>
      pendingHeader.length > 0 ||
      pendingMqp.length > 0 ||
      pendingVisual.length > 0 ||
      pendingBom.changed.length +
        pendingBom.added.length +
        pendingBom.removed.length >
        0,
    [pendingHeader, pendingMqp, pendingVisual, pendingBom]
  );

  const willResetOnSave = useMemo(
    () =>
      !!editingQAP &&
      user?.role === "requestor" &&
      hasPendingChanges &&
      ["approved", "rejected", "level-5", "final-comments"].includes(
        String((editingQAP as any).status || "").toLowerCase()
      ),
    [editingQAP, user?.role, hasPendingChanges]
  );

  const editScope: "none" | "qap" | "bom" | "both" = useMemo(() => {
    const qapChanged =
      pendingHeader.length > 0 ||
      pendingMqp.length > 0 ||
      pendingVisual.length > 0;
    const bomChanged =
      pendingBom.changed.length +
        pendingBom.added.length +
        pendingBom.removed.length >
      0;
    if (qapChanged && bomChanged) return "both";
    if (qapChanged) return "qap";
    if (bomChanged) return "bom";
    return "none";
  }, [pendingHeader, pendingMqp, pendingVisual, pendingBom]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const r = await fetch(`${API}/api/project-codes`, {
          credentials: "include",
        });
        const codes = r.ok ? await r.json() : [];
        setProjectCodeOptions(codes);
      } catch {
        setProjectCodeOptions([]);
      }
    })();
  }, [isOpen]);

  function onPickProjectCode(code: string) {
    setProjectCode(code);
    // expected: customer_rfqMW_location_YYYYMMDD
    const [customer] = code.split("_");
    setCustomerName(customer.replace(/-/g, " "));
    // ⬇️ load linked Sales Request and prefill
    loadSalesRequestFor(code);
  }

  // hydrate BOM editor whenever a SR is linked/changes
  useEffect(() => {
    if (!linkedSR) {
      setBomDraft(null);
      return;
    }
    // If we have a saved baseline equal to SR.bom, no need to clobber the current editor
    const srBom = linkedSR.bom
      ? JSON.parse(JSON.stringify(linkedSR.bom))
      : null;
    if (JSON.stringify(srBom) === JSON.stringify(baselineBom)) return;
    setBomDraft(srBom);
  }, [linkedSR, baselineBom]);

  // small row-level helpers
  function addBomRow(compName: string) {
    setBomDraft((prev) => {
      if (!prev) return prev;
      const comps = prev.components?.map((c) =>
        c.name === compName
          ? { ...c, rows: [...(c.rows || []), { model: "" }] }
          : c
      );
      return { ...prev, components: comps || [] };
    });
  }
  function removeBomRow(compName: string, idx: number) {
    setBomDraft((prev) => {
      if (!prev) return prev;
      const comps = prev.components?.map((c) =>
        c.name === compName
          ? { ...c, rows: c.rows.filter((_, i) => i !== idx) }
          : c
      );
      return { ...prev, components: comps || [] };
    });
  }
  function setBomCell(compName: string, idx: number, patch: Partial<BomRow>) {
    setBomDraft((prev) => {
      if (!prev) return prev;
      const comps = prev.components?.map((c) => {
        if (c.name !== compName) return c;
        const rows = [...c.rows];
        rows[idx] = { ...rows[idx], ...patch };
        return { ...c, rows };
      });
      return { ...prev, components: comps || [] };
    });
  }

  function resetBomEditorToSR() {
    setBomError(null);
    setBomSavedOnce(false);
    setBomDraft(
      linkedSR?.bom ? JSON.parse(JSON.stringify(linkedSR.bom)) : null
    );
  }

  // Optional: minimal PUT that only sends `bom`. If BE requires full payload,
  // it will 400—kept small by design.
  async function saveBomToSalesRequest() {
    if (!linkedSR?.id || !bomDraft) return;
    setBomSaving(true);
    setBomError(null);
    try {
      const r = await fetch(`${API}/api/sales-requests/${linkedSR.id}`, {
        // PATCH supports partial update; switch back to PUT only if your API requires full object
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bom: bomDraft,
          updatedBy: user?.username || "unknown",
        }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || "Failed to save BOM");
      }
      const updated = (await r.json()) as SalesRequestLite;
      setLinkedSR(updated);
      setBomSavedOnce(true);
      // 🔑 important: advance the baseline so diffs clear and we don't re-save forever
      setBaselineBom(JSON.parse(JSON.stringify(bomDraft)));
    } catch (e: any) {
      setBomError(String(e?.message || e));
    } finally {
      setBomSaving(false);
    }
  }

  // ⬇️ ADD: derive product type from SR's order type (keeps existing options)
  function deriveProductTypeFromSR(sr: SalesRequestLite): string {
    const map: Record<string, string> = {
      m10: "Dual Glass M10 Topcon",
      g12r: "Dual Glass G12R Topcon",
      g12: "Dual Glass G12 Topcon",
    };
    return map[(sr.moduleOrderType || "").toLowerCase()] || "";
  }

  // ⬇️ ADD: client-side fetch of SR by project code (safe fallbacks)
  async function loadSalesRequestFor(code: string) {
    try {
      setLoadingSR(true);
      // try filtered endpoint if present
      let sr: SalesRequestLite | null = null;
      let r = await fetch(
        `${API}/api/sales-requests?projectCode=${encodeURIComponent(code)}`,
        { credentials: "include" }
      ).catch(() => null as any);

      if (r && r.ok) {
        const data = await r.json();
        sr = Array.isArray(data)
          ? data.find((x: any) => x.projectCode === code) ?? null
          : data && data.projectCode
          ? (data as SalesRequestLite)
          : null;
      }

      // fallback: load all and filter on client
      if (!sr) {
        const r2 = await fetch(`${API}/api/sales-requests`, {
          credentials: "include",
        }).catch(() => null as any);
        if (r2 && r2.ok) {
          const arr = (await r2.json()) as SalesRequestLite[];
          sr = arr.find((x) => x.projectCode === code) || null;
        }
      }

      // If the slim record is missing newer fields, hydrate from /:id
      if (
        sr &&
        (typeof sr.productCategory === "undefined" ||
          typeof sr.bomFrom === "undefined")
      ) {
        sr = await hydrateSalesRequest(sr);
      }
      setLinkedSR(sr || null);

      // Prefill QAP fields (non-destructive; user can still edit)
      if (sr) {
        setPlant((sr.moduleManufacturingPlant || "").toLowerCase());
        setOrderQuantity(Number(sr.rfqOrderQtyMW || 0));
        // If project name empty, use project location as a decent default
        setProjectName((prev) =>
          prev?.trim() ? prev : sr.projectLocation || code
        );
        const inferred = deriveProductTypeFromSR(sr);
        if (inferred) setProductType(inferred);
        if (sr.customerName) setCustomerName(sr.customerName);
      }
    } finally {
      setLoadingSR(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    if (editingQAP) {
      // load existing QAP: support either legacy `qaps` or new `specs`
      setCustomerName(editingQAP.customerName || "");
      setProjectName(editingQAP.projectName || "");
      setOrderQuantity(editingQAP.orderQuantity || 0);
      setProductType(editingQAP.productType || "");
      setPlant(editingQAP.plant || "");

      setProjectCode(editingQAP.projectCode || "");
      const existingMqp = Array.isArray(editingQAP.qaps)
        ? editingQAP.qaps.filter((q) => q.criteria === "MQP")
        : editingQAP.specs?.mqp || [];
      const existingVisual = Array.isArray(editingQAP.qaps)
        ? editingQAP.qaps.filter(
            (q) => q.criteria === "Visual" || q.criteria === "EL"
          )
        : editingQAP.specs?.visual || [];
      setMqpData(
        existingMqp.map((r) => ({
          ...r,
          reviewBy: normalizeReviewBy((r as any).reviewBy),
        }))
      );
      setVisualElData(
        existingVisual.map((r) => ({
          ...r,
          reviewBy: normalizeReviewBy((r as any).reviewBy),
        }))
      );

      // NEW: hydrate Sales Request snapshot for edit mode
      if ((editingQAP as any).salesRequestId) {
        loadSalesRequestById((editingQAP as any).salesRequestId as string);
      } else if (editingQAP.projectCode) {
        loadSalesRequestFor(editingQAP.projectCode);
      }
      return;
    }

    async function loadSalesRequestById(id: string) {
      try {
        setLoadingSR(true);
        const r = await fetch(`${API}/api/sales-requests/${id}`, {
          credentials: "include",
        });
        if (!r.ok) return;
        const sr = (await r.json()) as SalesRequestLite;
        setLinkedSR(sr);

        // Prefill top fields (read-only snapshot still; keeps current form logic intact)
        setPlant((sr.moduleManufacturingPlant || "").toLowerCase());
        setOrderQuantity(Number(sr.rfqOrderQtyMW || 0));
        setProjectName((prev) =>
          prev?.trim() ? prev : sr.projectLocation || ""
        );
        const inferred = deriveProductTypeFromSR(sr);
        if (inferred) setProductType(inferred);
        if (sr.customerName) setCustomerName(sr.customerName);
      } finally {
        setLoadingSR(false);
      }
    }

    // NEW QAP: DB-first hydrate with safe fallback to static lists
    (async () => {
      resetForm();
      try {
        const [mqpRows, visualRows] = await Promise.all([
          fetchQapFromDb("mqp"),
          fetchQapFromDb("visual"),
        ]);
        const mqp = inflateRows(mqpRows, nextSno);
        const visual = inflateRows(visualRows, nextSno + mqp.length);
        setMqpData(mqp);
        setVisualElData(visual);
      } catch {
        // graceful fallback keeps the flow unaffected
        const mqp = (FALLBACK_MQP || []).map((spec, i) => ({
          ...spec,
          sno: nextSno + i,
          match: undefined,
          customerSpecification: undefined,
          selectedForReview: false,
          reviewBy: [],
        }));
        const visual = (FALLBACK_VISUAL || []).map((spec, i) => ({
          ...spec,
          sno: nextSno + mqp.length + i,
          match: undefined,
          customerSpecification: undefined,
          selectedForReview: false,
          reviewBy: [],
        }));
        setMqpData(mqp);
        setVisualElData(visual);
      }
    })();
  }, [isOpen, editingQAP, nextSno]);

  useEffect(() => {
    if (isOpen && projectCode) {
      loadSalesRequestFor(projectCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectCode]);

  const handleMatchChange = (
    section: "mqp" | "visual",
    index: number,
    match: "yes" | "no"
  ) => {
    const updateSection = section === "mqp" ? setMqpData : setVisualElData;
    const currentData = section === "mqp" ? mqpData : visualElData;

    const newData = [...currentData];
    const spec = newData[index];
    const premierSpec = spec.specification || spec.criteriaLimits || "";

    newData[index] = {
      ...spec,
      match,
      customerSpecification: match === "yes" ? premierSpec : "",
      selectedForReview: match === "no",
    };
    updateSection(newData);
  };

  const handleCustomerSpecChange = (
    section: "mqp" | "visual",
    index: number,
    value: string
  ) => {
    const updateSection = section === "mqp" ? setMqpData : setVisualElData;
    const currentData = section === "mqp" ? mqpData : visualElData;

    const newData = [...currentData];
    newData[index] = {
      ...newData[index],
      customerSpecification: value,
    };
    updateSection(newData);
  };

  const handleReviewByChange = (
    section: "mqp" | "visual",
    index: number,
    role: string,
    checked: boolean
  ) => {
    const updateSection = section === "mqp" ? setMqpData : setVisualElData;
    const currentData = section === "mqp" ? mqpData : visualElData;

    const newData = [...currentData];
    const prev = normalizeReviewBy(newData[index].reviewBy);

    newData[index].reviewBy = checked
      ? Array.from(new Set([...prev, role])) // add + de-dupe
      : prev.filter((r) => r !== role); // remove

    updateSection(newData);
  };

  const handleNext = () => {
    setShowReviewSelection(true);
  };

  const editMeta = {
    scope: editScope, // "qap" | "bom" | "both" | "none"
    header: pendingHeader, // [{field,before,after}]
    mqp: pendingMqp, // [{sno,deltas:[{field,before,after}]}]
    visual: pendingVisual, // same shape
    bom: pendingBom, // {changed:[...], added:[...], removed:[...]}
  };

  const terminalStatuses = new Set([
    "approved",
    "rejected",
    "level-5",
    "final-comments",
  ]);
  const mustReset =
    !!editingQAP &&
    user?.role === "requestor" &&
    hasPendingChanges &&
    terminalStatuses.has(
      String((editingQAP as any)?.status || "").toLowerCase()
    );

  // ⬇️ Put near other helpers
  const hasBomChanges =
    (pendingBom.added?.length || 0) +
      (pendingBom.changed?.length || 0) +
      (pendingBom.removed?.length || 0) >
    0;

  const summarizeCounts = () => {
    const header = pendingHeader.length;
    const mqp = pendingMqp.length;
    const visual = pendingVisual.length;
    const bAdd = pendingBom.added?.length || 0;
    const bChg = pendingBom.changed?.length || 0;
    const bRem = pendingBom.removed?.length || 0;
    const parts = [];
    if (header) parts.push(`Header:${header}`);
    if (mqp) parts.push(`MQP:${mqp}`);
    if (visual) parts.push(`Visual:${visual}`);
    if (bAdd + bChg + bRem) parts.push(`BOM:+${bAdd}/Δ${bChg}/−${bRem}`);
    return parts.join(" • ") || "No changes";
  };

  // REPLACE existing handleSave with this
  const handleSave = async () => {
    // 1) If there are BOM changes and an SR is linked, persist them first.
    if (linkedSR?.id && hasBomChanges) {
      try {
        await saveBomToSalesRequest(); // persists to /api/sales-requests/:id
      } catch (e) {
        console.warn("BOM auto-save failed; continuing with QAP snapshot.", e);
        // We still proceed and embed a snapshot in the QAP payload (below).
      }
    }

    const now = new Date().toISOString();
    const summary = summarizeCounts();
    const timeline = [
      ...(editingQAP?.timeline || []),
      {
        level: editingQAP?.currentLevel || 1,
        action: `Saved draft — ${summary}`,
        user: user?.username || "unknown",
        timestamp: now,
      },
    ];

    const toApiSpecs = (arr: QAPSpecification[]) =>
      arr.map((r) => ({
        ...r,
        reviewBy: Array.isArray(r.reviewBy)
          ? r.reviewBy.join(",")
          : r.reviewBy || "",
      }));

    const payload: Partial<QAPFormData> = {
      ...(editingQAP ? { id: editingQAP.id } : {}),
      customerName,
      projectCode,
      projectName,
      orderQuantity,
      productType,
      plant,
      specs: { mqp: toApiSpecs(mqpData), visual: toApiSpecs(visualElData) },
      submittedBy: user?.username,
      salesRequestId: linkedSR?.id,

      // Keep routing behavior
      status: mustReset ? "draft" : (editingQAP as any)?.status || "draft",
      currentLevel: mustReset ? 1 : (editingQAP as any)?.currentLevel || 1,

      // Persist diffs + human timeline
      editMeta,
      timeline,
      lastModifiedAt: now,
    };

    // Lightweight BOM snapshot so reviewers always see what was saved (type-safe escape hatch)
    (payload as any).bomSnapshot = bomDraft;
    (payload as any).bom = bomDraft; // compat: many schemas already persist `bom`

    onSave(payload as QAPFormData, payload.status as string);
    onClose();
    resetForm();
  };

  // REPLACE existing handleSend with this
  const handleSend = async () => {
    // 1) Persist BOM changes before moving level, if any.
    if (linkedSR?.id && hasBomChanges) {
      try {
        await saveBomToSalesRequest();
      } catch (e) {
        console.error("BOM auto-save failed before Send.", e);
        // We still continue but embed a snapshot so history is intact.
      }
    }

    const now = new Date().toISOString();
    const summary = summarizeCounts();
    const timeline = [
      ...(editingQAP?.timeline || []),
      {
        level: 2,
        action: `Submitted to Level-2 — ${summary}`,
        user: user?.username || "unknown",
        timestamp: now,
      },
    ];
    const toApiSpecs = (arr: QAPSpecification[]) =>
      arr.map((r) => ({
        ...r,
        reviewBy: Array.isArray(r.reviewBy)
          ? r.reviewBy.join(",")
          : r.reviewBy || "",
      }));

    const payload: Partial<QAPFormData> = {
      ...(editingQAP ? { id: editingQAP.id } : {}),
      customerName,
      projectCode,
      projectName,
      orderQuantity,
      productType,
      plant,
      status: "level-2",
      currentLevel: 2,
      specs: { mqp: toApiSpecs(mqpData), visual: toApiSpecs(visualElData) },

      submittedBy: user?.username,
      salesRequestId: linkedSR?.id,

      editMeta,
      timeline,
      lastModifiedAt: now,
    };

    (payload as any).bomSnapshot = bomDraft;
    (payload as any).bom = bomDraft; // compat

    onSave(payload as QAPFormData, "level-2");
    onClose();
    resetForm();
    setShowReviewSelection(false);
  };

  const resetForm = () => {
    setCustomerName("");
    setProjectName("");
    setOrderQuantity(0);
    setProductType("");
    setPlant("");
    setShowReviewSelection(false);
    setProjectCode("");
    setLinkedSR(null);
  };

  // only allow progressing once all required fields are set
  const isFormValid = Boolean(
    projectCode &&
      customerName &&
      projectName &&
      orderQuantity > 0 &&
      productType &&
      plant
  );

  const getUnmatchedItems = () => {
    return [...mqpData, ...visualElData].filter((item) => item.match === "no");
  };

  function diffHeaderLocal(before: any, after: any) {
    if (!before) return [];
    const fields = [
      "customerName",
      "projectName",
      "projectCode",
      "orderQuantity",
      "productType",
      "plant",
    ];
    return fields
      .map((f) => ({
        field: f,
        before: before[f] ?? null,
        after: after[f] ?? null,
      }))
      .filter((d) => JSON.stringify(d.before) !== JSON.stringify(d.after));
  }

  function diffSpecsLocal(
    before: QAPSpecification[] | null,
    after: QAPSpecification[]
  ) {
    if (!before) return [];
    const idxB = new Map((before || []).map((r) => [r.sno, r]));
    const idxA = new Map((after || []).map((r) => [r.sno, r]));
    const all = new Set<number>([...idxB.keys(), ...idxA.keys()]);

    const fields: Array<keyof QAPSpecification> = [
      "match",
      "customerSpecification",
      "reviewBy",
    ];

    const rows: Array<{
      sno: number;
      deltas: Array<{ field: string; before: any; after: any }>;
    }> = [];

    for (const sno of all) {
      const b = idxB.get(sno) || ({} as any);
      const a = idxA.get(sno) || ({} as any);

      const deltas = fields
        .map((f) => {
          // ⬅️ Key change: hard-normalize both sides for `reviewBy`
          const bv =
            f === "reviewBy" ? normalizeReviewBy(b.reviewBy) : (b as any)[f];
          const av =
            f === "reviewBy" ? normalizeReviewBy(a.reviewBy) : (a as any)[f];

          return { field: f as string, before: bv, after: av };
        })
        .filter((d) => JSON.stringify(d.before) !== JSON.stringify(d.after));

      if (deltas.length) rows.push({ sno, deltas });
    }
    return rows;
  }

  function diffBomLocal(before: BomPayload | null, after: BomPayload | null) {
    if (!before || !after)
      return {
        changed: [],
        added: [],
        removed: [] as Array<{ comp: string; index: number; row: BomRow }>,
      };
    const bIdx = new Map((before.components || []).map((c) => [c.name, c]));
    const aIdx = new Map((after.components || []).map((c) => [c.name, c]));
    const comps = new Set<string>([...bIdx.keys(), ...aIdx.keys()]);
    const changed: Array<{
      comp: string;
      index: number;
      deltas: Array<{ field: keyof BomRow; before: any; after: any }>;
    }> = [];
    const added: Array<{ comp: string; index: number; row: BomRow }> = [];
    const removed: Array<{ comp: string; index: number; row: BomRow }> = [];
    for (const comp of comps) {
      const bRows = bIdx.get(comp)?.rows || [];
      const aRows = aIdx.get(comp)?.rows || [];
      const max = Math.max(bRows.length, aRows.length);
      for (let i = 0; i < max; i++) {
        const br = bRows[i],
          ar = aRows[i];
        if (br && !ar) removed.push({ comp, index: i, row: br });
        else if (!br && ar) added.push({ comp, index: i, row: ar });
        else if (br && ar) {
          const deltas = (["model", "subVendor", "spec"] as const)
            .map((f) => ({
              field: f,
              before: br[f] ?? null,
              after: ar[f] ?? null,
            }))
            .filter(
              (d) => JSON.stringify(d.before) !== JSON.stringify(d.after)
            );
          if (deltas.length) changed.push({ comp, index: i, deltas });
        }
      }
    }
    return { changed, added, removed };
  }

  const renderReviewSelection = () => {
    const unmatchedItems = getUnmatchedItems();

    // resolve which table an item belongs to and its index by stable key (sno)
    // Prefer reference equality (items in unmatchedItems come from current state arrays),
    // fall back to disambiguated lookup
    const indexFor = (item: QAPSpecification) => {
      const mRef = mqpData.indexOf(item as any);
      if (mRef !== -1) return { section: "mqp" as const, index: mRef };

      const vRef = visualElData.indexOf(item as any);
      if (vRef !== -1) return { section: "visual" as const, index: vRef };

      if (item.criteria === "MQP") {
        return {
          section: "mqp" as const,
          index: mqpData.findIndex(
            (r) =>
              r.sno === item.sno &&
              r.subCriteria === item.subCriteria &&
              (r.specification || r.criteriaLimits) ===
                (item.specification || item.criteriaLimits)
          ),
        };
      }
      return {
        section: "visual" as const,
        index: visualElData.findIndex(
          (r) =>
            r.sno === item.sno &&
            r.subCriteria === item.subCriteria &&
            (r.specification || r.criteriaLimits) ===
              (item.specification || item.criteriaLimits)
        ),
      };
    };

    // require at least one reviewer for each unmatched row (if any)
    const hasUnmatched = unmatchedItems.length > 0;
    const allAssigned = unmatchedItems.every(
      (it) => normalizeReviewBy(it.reviewBy).length > 0
    );

    // only allow sending when: form is valid, user may edit, and reviewer selection (if needed) is complete
    const mayEdit = allowAssignL2
      ? Boolean(hasEditRights || canEdit)
      : Boolean(hasEditRights && canEdit);
    const canSendNow = isFormValid && mayEdit && (!hasUnmatched || allAssigned);

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-red-600">
          Unmatched Items for Review
        </h3>

        {unmatchedItems.length === 0 && (
          <div className="rounded-md border border-gray-200 p-4 bg-gray-50 text-sm">
            No unmatched items. You can still send this QAP for review.
          </div>
        )}

        {unmatchedItems.map((item) => {
          const { section, index } = indexFor(item);
          const isValidIndex = index > -1;

          return (
            <div
              key={`${item.criteria}-${item.sno}-${item.subCriteria}-${
                item.specification || item.criteriaLimits || ""
              }`}
              className="border border-red-200 rounded-lg p-4 bg-red-50"
            >
              <div className="mb-3">
                <Badge variant="destructive" className="mb-2">
                  Unmatched
                </Badge>
                <p className="font-medium">
                  {item.criteria} - {item.subCriteria}
                </p>
                <p className="text-sm text-gray-600">
                  {item.specification || item.criteriaLimits || "—"}
                </p>
                <p className="text-sm font-medium">
                  Customer Specification: {item.customerSpecification || "—"}
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                {["production", "quality", "technical"].map((role) => (
                  <label key={role} className="flex items-center space-x-2">
                    <Checkbox
                      // REPLACE checkbox "checked" prop:
                      checked={normalizeReviewBy(item.reviewBy).includes(role)}
                      onCheckedChange={(checked) => {
                        const { section, index } = indexFor(item);
                        if (index < 0 || !mayEdit) return;
                        handleReviewByChange(
                          section,
                          index,
                          role,
                          Boolean(checked)
                        );
                      }}
                      disabled={!mayEdit}
                    />
                    <span className="capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* helper text if reviewers missing */}
        {hasUnmatched && !allAssigned && (
          <div
            className="text-sm text-red-700"
            role="status"
            aria-live="polite"
          >
            Select at least one reviewer for each unmatched item to continue.
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => setShowReviewSelection(false)}
            variant="outline"
          >
            Back
          </Button>
          <Button
            onClick={handleSend}
            className="bg-green-600 hover:bg-green-700"
            disabled={!canSendNow}
          >
            <Send className="w-4 h-4 mr-2" />
            Send for Review
          </Button>
        </div>
      </div>
    );
  };

  const getRowClassName = (item: QAPSpecification) => {
    if (item.match === "yes") return "bg-green-50 border-green-200";
    if (item.match === "no") return "bg-red-50 border-red-200";
    return "bg-white border-gray-200";
  };

  const renderMQPTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-12">
                S.No
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">
                Criteria
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">
                Sub Criteria
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-32">
                Component & Operation
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-32">
                Characteristics
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">
                Class
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">
                Type of Check
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">
                Sampling
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">
                Specification
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">
                Match?
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">
                Customer Specification
              </th>
            </tr>
          </thead>
          <tbody>
            {mqpData.map((item, index) => (
              <tr
                key={index}
                className={`border-b hover:bg-opacity-70 transition-colors ${getRowClassName(
                  item
                )}`}
              >
                <td className="border border-gray-300 p-2 sm:p-3 font-medium text-gray-600">
                  {item.sno}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-800 border-blue-300 text-xs"
                  >
                    {item.criteria}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words">
                  {item.subCriteria}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-32 break-words">
                  {item.componentOperation}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-32 break-words">
                  {item.characteristics}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge
                    variant={
                      item.class === "Critical"
                        ? "destructive"
                        : item.class === "Major"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {item.class}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words text-xs">
                  {item.typeOfCheck}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words text-xs">
                  {item.sampling}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-48 break-words font-medium text-gray-700 text-xs">
                  {item.specification}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Select
                    value={item.match || ""}
                    onValueChange={(value: "yes" | "no") =>
                      handleMatchChange("mqp", index, value)
                    }
                  >
                    <SelectTrigger className="w-16 sm:w-20 h-8">
                      <SelectValue placeholder="?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Input
                    value={item.customerSpecification || ""}
                    onChange={(e) =>
                      handleCustomerSpecChange("mqp", index, e.target.value)
                    }
                    placeholder={
                      item.match === "no"
                        ? "Enter custom specification..."
                        : "Auto-filled from Premier Spec"
                    }
                    disabled={item.match === "yes"}
                    className={`text-xs ${
                      item.match === "yes"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : item.match === "no"
                        ? "bg-red-50 border-red-300"
                        : "bg-white"
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderVisualElTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-12">
                S.No
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">
                Criteria
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">
                Sub-Criteria
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-32">
                Defect
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">
                Defect Class
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">
                Description
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">
                Criteria Limits
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">
                Match?
              </th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">
                Customer Specification
              </th>
            </tr>
          </thead>
          <tbody>
            {visualElData.map((item, index) => (
              <tr
                key={index}
                className={`border-b hover:bg-opacity-70 transition-colors ${getRowClassName(
                  item
                )}`}
              >
                <td className="border border-gray-300 p-2 sm:p-3 font-medium text-gray-600">
                  {item.sno}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      item.criteria === "Visual"
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : "bg-orange-100 text-orange-800 border-orange-300"
                    }`}
                  >
                    {item.criteria}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words">
                  {item.subCriteria}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-32 break-words">
                  {item.defect}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge
                    variant={
                      item.defectClass === "Critical"
                        ? "destructive"
                        : item.defectClass === "Major"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {item.defectClass}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-48 break-words text-xs">
                  {item.description}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-48 break-words font-medium text-gray-700 text-xs">
                  {item.criteriaLimits}
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Select
                    value={item.match || ""}
                    onValueChange={(value: "yes" | "no") =>
                      handleMatchChange("visual", index, value)
                    }
                  >
                    <SelectTrigger className="w-16 sm:w-20 h-8">
                      <SelectValue placeholder="?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Input
                    value={item.customerSpecification || ""}
                    onChange={(e) =>
                      handleCustomerSpecChange("visual", index, e.target.value)
                    }
                    placeholder={
                      item.match === "no"
                        ? "Enter custom specification..."
                        : "Auto-filled from Criteria Limits"
                    }
                    disabled={item.match === "yes"}
                    className={`text-xs ${
                      item.match === "yes"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : item.match === "no"
                        ? "bg-red-50 border-red-300"
                        : "bg-white"
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // add this helper just above the component's return()
  function renderBomTable(bom?: BomPayload | null) {
    if (!bom || !Array.isArray(bom.components) || !bom.components.length)
      return null;

    return (
      <div className="mt-4">
        <Label className="text-amber-700">BOM</Label>

        {/* Optional BOM header bits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mt-2 mb-2">
          <div>
            <span className="text-amber-700 font-medium">Vendor</span>
            <div className="font-medium">{bom.vendorName || "-"}</div>
          </div>
          <div>
            <span className="text-amber-700 font-medium">RFID Location</span>
            <div className="font-medium">{bom.rfidLocation || "-"}</div>
          </div>
          <div>
            <span className="text-amber-700 font-medium">Document Ref</span>
            <div className="font-medium">{bom.documentRef || "-"}</div>
          </div>
        </div>

        {bom.components.map((comp, idx) => (
          <div key={`${comp.name}-${idx}`} className="mt-3">
            <div className="font-semibold text-amber-900 mb-1">{comp.name}</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-amber-300 text-xs">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="border border-amber-300 p-2 text-left">
                      Model
                    </th>
                    <th className="border border-amber-300 p-2 text-left">
                      Sub-Vendor
                    </th>
                    <th className="border border-amber-300 p-2 text-left">
                      Spec
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(comp.rows || []).map((r, i) => (
                    <tr key={i} className="bg-white">
                      <td className="border border-amber-200 p-2">
                        {r.model || "-"}
                      </td>
                      <td className="border border-amber-200 p-2">
                        {r.subVendor || "-"}
                      </td>
                      <td className="border border-amber-200 p-2">
                        {r.spec || "-"}
                      </td>
                    </tr>
                  ))}
                  {!comp.rows?.length && (
                    <tr>
                      <td className="border border-amber-200 p-2" colSpan={3}>
                        No rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderBomEditor(bom?: BomPayload | null) {
    if (!bom) {
      return (
        <div className="text-sm text-gray-600">
          No BOM available for this Sales Request.
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="bg-red-400 hover:bg-red-100"
            variant="outline"
            onClick={resetBomEditorToSR}
            title="Reset to Snapshot"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Optional BOM header bits (read-only in editor to keep changes minimal) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <Label className="text-gray-600">Vendor</Label>
            <div className="font-medium">{bom.vendorName || "-"}</div>
          </div>
          <div>
            <Label className="text-gray-600">RFID Location</Label>
            <div className="font-medium">{bom.rfidLocation || "-"}</div>
          </div>
          <div>
            <Label className="text-gray-600">Document Ref</Label>
            <div className="font-medium">{bom.documentRef || "-"}</div>
          </div>
          <div>
            <Label className="text-gray-600">Min Watt Peak</Label>
            <div className="font-medium">{bom.wattPeakLabel || "-"}</div>
          </div>
          <div>
            <Label className="text-gray-600">Module Model Number</Label>
            <div className="font-medium">{bom.moduleModelNumber || "-"}</div>
          </div>
          <div>
            <Label className="text-gray-600">Module Dimensions</Label>
            <div className="font-medium">
              {bom.moduleDimensionsOption || "-"}
            </div>
          </div>
        </div>

        {/* Editable components table(s) */}
        {/* Editable components table(s) */}
        {(bom.components || []).map((comp, idx) => (
          <div key={`${comp.name}-${idx}`} className="border rounded-md">
            <div className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-gray-50">
              <div className="font-medium">{comp.name}</div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addBomRow(comp.name)}
                >
                  + Add Row
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 font-medium">Part No / Model</th>
                    <th className="px-3 py-2 font-medium">Sub-vendor</th>
                    <th className="px-3 py-2 font-medium">Specification</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {comp.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-gray-500">
                        No rows yet. Click “Add Row”.
                      </td>
                    </tr>
                  ) : (
                    comp.rows.map((r, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-2 min-w-[28rem]">
                          {(() => {
                            const options = getOptionsFor(
                              comp.name as BomComponentName
                            ) as readonly BomComponentOption[];
                            const model = r.model || "";
                            return (
                              <div className="space-y-2">
                                <input
                                  className="w-full border rounded px-3 py-2 bg-gray-50 font-mono"
                                  value={model}
                                  placeholder="No model chosen"
                                  readOnly
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openModelDialog(
                                        comp.name as BomComponentName,
                                        i
                                      )
                                    }
                                    disabled={options.length === 0}
                                    title={
                                      options.length === 0
                                        ? "No options configured for this component"
                                        : undefined
                                    }
                                  >
                                    {model ? "Change" : "Choose"}
                                  </Button>
                                  {model && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        setBomCell(comp.name, i, {
                                          model: "",
                                          subVendor: null,
                                          spec: null,
                                        })
                                      }
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-3 py-2 min-w-[16rem]">
                          <div className="w-full border rounded px-3 py-2 bg-gray-50">
                            {r.subVendor ?? "—"}
                          </div>
                        </td>

                        <td className="px-3 py-2 min-w-[24rem]">
                          <div className="w-full border rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">
                            {r.spec ?? "—"}
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeBomRow(comp.name, i)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="pt-5 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              onClick={saveBomToSalesRequest}
              disabled={!linkedSR?.id || bomSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {bomSaving ? "Saving…" : "Save to Sales Request"}
            </Button>
            {bomSavedOnce && !bomError && (
              <span className="text-green-700 text-sm">Saved.</span>
            )}
            {bomError && (
              <span className="text-red-600 text-sm">{bomError}</span>
            )}
          </div>

          {/* inline 'Next' so users coming from BOM can proceed without hunting for the footer */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowReviewSelection(true)}
              disabled={!isFormValid}
              title={
                !isFormValid
                  ? "Fill required fields first"
                  : "Proceed to reviewer selection"
              }
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <DialogTitle className="text-2xl font-bold">
            {editingQAP ? "Edit QAP" : "New QAP"}
          </DialogTitle>
          {editingQAP && editScope !== "none" && (
            <div className="mt-2">
              <Badge
                variant="outline"
                className={
                  editScope === "both"
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : editScope === "bom"
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : "bg-indigo-100 text-indigo-900 border-indigo-300"
                }
              >
                Edited: {editScope.toUpperCase()}
              </Badge>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          {/* NEW: Change Summary (before → after), grouped by Header / Specs / BOM */}
          {editingQAP && hasPendingChanges && (
            <div className="mb-4 border rounded-lg p-3 bg-amber-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-amber-900">
                    Pending changes
                  </div>
                  {willResetOnSave && (
                    <div className="text-xs text-red-700 mt-1">
                      Editing an{" "}
                      {String((editingQAP as any).status).toUpperCase()} QAP —
                      it will <b>reset to Draft (Level 1)</b> on save.
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="bg-white">
                  {[
                    pendingHeader.length
                      ? `Header: ${pendingHeader.length}`
                      : null,
                    pendingMqp.length ? `MQP: ${pendingMqp.length}` : null,
                    pendingVisual.length
                      ? `Visual/EL: ${pendingVisual.length}`
                      : null,
                    pendingBom.changed.length +
                    pendingBom.added.length +
                    pendingBom.removed.length
                      ? `BOM: ${
                          pendingBom.changed.length +
                          pendingBom.added.length +
                          pendingBom.removed.length
                        }`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </Badge>
              </div>

              {/* Header diffs */}
              {pendingHeader.length > 0 && (
                <div className="mt-2 text-sm">
                  <div className="font-medium text-amber-800 mb-1">Header</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {pendingHeader.map((d) => (
                      <li key={d.field}>
                        <span className="font-mono">{d.field}</span>:{" "}
                        <span className="line-through text-gray-500">
                          {String(d.before ?? "—")}
                        </span>{" "}
                        →{" "}
                        <span className="font-semibold">
                          {String(d.after ?? "—")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* QAP Specs diffs */}
              {(pendingMqp.length > 0 || pendingVisual.length > 0) && (
                <div className="mt-3 text-sm">
                  <div className="font-medium text-amber-800 mb-1">
                    QAP Specs
                  </div>
                  {pendingMqp.length > 0 && (
                    <div className="mb-2">
                      <div className="text-amber-700 font-medium">MQP</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {pendingMqp.map((r) => (
                          <li key={`m${r.sno}`}>
                            S.No {r.sno}:{" "}
                            {r.deltas.map((d, i) => (
                              <span key={i} className="mr-2">
                                <span className="font-mono">{d.field}</span>{" "}
                                <span className="line-through text-gray-500">
                                  {JSON.stringify(d.before ?? "—")}
                                </span>{" "}
                                →{" "}
                                <span className="font-semibold">
                                  {JSON.stringify(d.after ?? "—")}
                                </span>
                              </span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pendingVisual.length > 0 && (
                    <div>
                      <div className="text-amber-700 font-medium">
                        Visual / EL
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {pendingVisual.map((r) => (
                          <li key={`v${r.sno}`}>
                            S.No {r.sno}:{" "}
                            {r.deltas.map((d, i) => (
                              <span key={i} className="mr-2">
                                <span className="font-mono">{d.field}</span>{" "}
                                <span className="line-through text-gray-500">
                                  {JSON.stringify(d.before ?? "—")}
                                </span>{" "}
                                →{" "}
                                <span className="font-semibold">
                                  {JSON.stringify(d.after ?? "—")}
                                </span>
                              </span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* BOM diffs (separate group) */}
              {pendingBom.changed.length +
                pendingBom.added.length +
                pendingBom.removed.length >
                0 && (
                <div className="mt-3 text-sm">
                  <div className="font-medium text-amber-800 mb-1">
                    BOM (linked Sales Request)
                  </div>
                  {pendingBom.changed.length > 0 && (
                    <div className="mb-2">
                      <div className="text-amber-700 font-medium">
                        Changed rows
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {pendingBom.changed.map((c, idx) => (
                          <li key={`c${idx}`}>
                            [{c.comp}] row {c.index + 1}:{" "}
                            {c.deltas.map((d, i) => (
                              <span key={i} className="mr-2">
                                <span className="font-mono">{d.field}</span>{" "}
                                <span className="line-through text-gray-500">
                                  {String(d.before ?? "—")}
                                </span>{" "}
                                →{" "}
                                <span className="font-semibold">
                                  {String(d.after ?? "—")}
                                </span>
                              </span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pendingBom.added.length > 0 && (
                    <div className="mb-2">
                      <div className="text-amber-700 font-medium">
                        Added rows
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {pendingBom.added.map((a, idx) => (
                          <li key={`a${idx}`}>
                            [{a.comp}] row {a.index + 1}: model=
                            {a.row.model || "—"}, subVendor=
                            {a.row.subVendor || "—"}, spec={a.row.spec || "—"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pendingBom.removed.length > 0 && (
                    <div>
                      <div className="text-amber-700 font-medium">
                        Removed rows
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {pendingBom.removed.map((r, idx) => (
                          <li key={`r${idx}`}>
                            [{r.comp}] row {r.index + 1}: model=
                            {r.row.model || "—"}, subVendor=
                            {r.row.subVendor || "—"}, spec={r.row.spec || "—"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Last persisted edit info (from server), if present */}
              {(editingQAP as any)?.editedAt &&
                (editingQAP as any)?.editedBy && (
                  <div className="mt-3 text-xs text-gray-700">
                    Last saved edit by <b>{(editingQAP as any).editedBy}</b> at{" "}
                    {new Date((editingQAP as any).editedAt).toLocaleString()}
                  </div>
                )}
            </div>
          )}

          {!showReviewSelection ? (
            <>
              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 bg-blue-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Label>Project Code *</Label>

                    <Select
                      value={projectCode || undefined}
                      onValueChange={onPickProjectCode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project code" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="z-[70] max-h-64 overflow-y-auto"
                        // prevent parent modal from stealing the wheel scroll
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {projectCodeOptions.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Sales Request Snapshot (auto when a Project Code is chosen) */}
              {linkedSR && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {/* Top/meta */}
                  <div>
                    <Label className="text-amber-700">Customer Name</Label>
                    <div className="font-medium">
                      {linkedSR.customerName || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Module Manufacturing Plant
                    </Label>
                    <div className="font-medium uppercase">
                      {linkedSR.moduleManufacturingPlant || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Product Category</Label>
                    <div className="font-medium">
                      {linkedSR.productCategory || "-"}
                    </div>
                  </div>

                  {/* Sub-fields (Cell Type/Tech/Cut) */}
                  <div>
                    <Label className="text-amber-700">Cell Type</Label>
                    <div className="font-medium">
                      {linkedSR.moduleCellType || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Cell Tech</Label>
                    <div className="font-medium">
                      {linkedSR.cellTech || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">No. of Cells</Label>
                    <div className="font-medium">
                      {linkedSR.cutCells || "-"}
                    </div>
                  </div>

                  {/* BOM header snapshot (keep; table moved to BOM tab) */}
                  <div>
                    <Label className="text-amber-700">Min Watt Peak</Label>
                    <div className="font-medium">
                      {linkedSR.bom?.wattPeakLabel || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Module Model Number
                    </Label>
                    <div className="font-medium">
                      {linkedSR.bom?.moduleModelNumber || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      RFID Location (lock-in)
                    </Label>
                    <div className="font-medium">
                      {linkedSR.bom?.rfidLocation || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Solar Module Vendor Name (lock-in)
                    </Label>
                    <div className="font-medium">
                      {linkedSR.bom?.vendorName || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Module Dimensions</Label>
                    <div className="font-medium">
                      {linkedSR.bom?.moduleDimensionsOption || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Solar Module Vendor Address
                    </Label>
                    <div className="font-medium">
                      {linkedSR.bom?.vendorAddress || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Document Ref</Label>
                    <div className="font-medium">
                      {linkedSR.bom?.documentRef || "-"}
                    </div>
                  </div>

                  {/* Compliance */}
                  <div>
                    <Label className="text-amber-700">DCR Compliance?</Label>
                    <div className="font-medium">
                      {linkedSR.cellType || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Certification Required?
                    </Label>
                    <div className="font-medium">
                      {linkedSR.certificationRequired || "-"}
                    </div>
                  </div>

                  {/* Wattage distribution */}
                  <div className="md:col-span-3">
                    <Label className="text-amber-700">
                      Tentative Wattage Binning / Distribution
                    </Label>
                    {linkedSR.wattageBinningDist?.length ? (
                      <ul className="list-disc pl-5">
                        {linkedSR.wattageBinningDist.map((b, i) => (
                          <li key={i}>
                            {b.range}: {fmtDec(b.pct)}%
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="font-medium">-</div>
                    )}
                  </div>

                  {/* Quantities / scheduling */}
                  <div>
                    <Label className="text-amber-700">RFQ Qty (MW)</Label>
                    <div className="font-medium">
                      {fmtNum(linkedSR.rfqOrderQtyMW)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Premier Bidded Qty (MW)
                    </Label>
                    <div className="font-medium">
                      {linkedSR.premierBiddedOrderQtyMW ?? "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Delivery Timeline</Label>
                    <div className="font-medium">
                      {(linkedSR.deliveryStartDate || "—") +
                        " → " +
                        (linkedSR.deliveryEndDate || "—")}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Project Location</Label>
                    <div className="font-medium">
                      {linkedSR.projectLocation || "-"}
                    </div>
                  </div>

                  {/* Sources / attachments */}
                  <div>
                    <Label className="text-amber-700">QAP From</Label>
                    <div className="font-medium">{linkedSR.qapType || "-"}</div>
                    {linkedSR.qapTypeAttachmentUrl && (
                      <div>
                        <a
                          className="text-blue-600 underline"
                          href={linkedSR.qapTypeAttachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open QAP file
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-amber-700">BOM From</Label>
                    <div className="font-medium">{linkedSR.bomFrom || "-"}</div>
                    {linkedSR.primaryBomAttachmentUrl && (
                      <div>
                        <a
                          className="text-blue-600 underline"
                          href={linkedSR.primaryBomAttachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open BOM file
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-amber-700">
                      Any Other Attachments
                    </Label>
                    <div className="font-medium">
                      {linkedSR.otherAttachments?.length ? (
                        <span className="flex flex-wrap gap-x-2">
                          {linkedSR.otherAttachments.map((a, i) => (
                            <a
                              key={i}
                              className="text-blue-600 underline"
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {a.title || `Attachment ${i + 1}`}
                            </a>
                          ))}
                        </span>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>

                  {/* Process/ops */}
                  <div>
                    <Label className="text-amber-700">Inline Inspection</Label>
                    <div className="font-medium">
                      {(linkedSR.inlineInspection || "-")?.toUpperCase?.()}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Pre-Dispatch Inspection (PDI)
                    </Label>
                    <div className="font-medium">
                      {linkedSR.pdi ? linkedSR.pdi.toUpperCase() : "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Cell Procured By</Label>
                    <div className="font-medium">
                      {linkedSR.cellProcuredBy || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Agreed CTM</Label>
                    <div className="font-medium">
                      {fmtDec(linkedSR.agreedCTM)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Factory Audit Tentative Date
                    </Label>
                    <div className="font-medium">
                      {linkedSR.factoryAuditTentativeDate || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      JB Cable Length (mm)
                    </Label>
                    <div className="font-medium">
                      {fmtNum((linkedSR as any).cableLengthRequired)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">X Pitch (mm)</Label>
                    <div className="font-medium">
                      {(linkedSR.xPitchMm ?? "-") as any}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">
                      Tracker (790/1400mm)
                    </Label>
                    <div className="font-medium">
                      {(linkedSR.trackerDetails ?? "-") as any}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Priority</Label>
                    <div className="font-medium capitalize">
                      {linkedSR.priority || "-"}
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="md:col-span-3">
                    <Label className="text-amber-700">Remarks</Label>
                    <div className="font-medium">{linkedSR.remarks || "-"}</div>
                  </div>

                  {/* Meta */}
                  <div>
                    <Label className="text-amber-700">Project Code</Label>
                    <div className="font-medium">{linkedSR.projectCode}</div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Created By</Label>
                    <div className="font-medium">
                      {linkedSR.createdBy || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-700">Created At</Label>
                    <div className="font-medium">
                      {linkedSR.createdAt
                        ? new Date(linkedSR.createdAt).toLocaleString()
                        : "-"}
                    </div>
                  </div>

                  {/* ⛔️ NOTE: BOM components table removed from snapshot; see new tab */}
                </div>
              )}

              <div className="mt-4 border-t" />

              {/* Tabs for MQP and Visual/EL - simplified version for this implementation */}
              <Tabs defaultValue="mqp" className="w-full">
                <TabsList className="w-full mb-4 flex flex-nowrap justify-between gap-2 overflow-x-auto">
                  <TabsTrigger className="px-3 py-1 text-sm flex-1" value="mqp">
                    MQP ({mqpData.length})
                  </TabsTrigger>
                  <TabsTrigger
                    className="px-3 py-1 text-sm flex-1"
                    value="visual-el"
                  >
                    Visual &amp; EL ({visualElData.length})
                  </TabsTrigger>
                  <TabsTrigger className="px-3 py-1 text-sm flex-1" value="bom">
                    BOM
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="mqp">{renderMQPTable()}</TabsContent>

                <TabsContent value="visual-el">
                  {renderVisualElTable()}
                </TabsContent>
                <TabsContent value="bom">
                  {renderBomEditor(bomDraft)}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            renderReviewSelection()
          )}
        </div>

        {!showReviewSelection && (
          <div className="p-6 pt-3 border-t bg-gray-50">
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline">
                {hasEditRights ? "Cancel" : "Close"}
              </Button>
              {hasEditRights && (
                <>
                  <Button
                    onClick={handleSave}
                    variant="outline"
                    disabled={!isFormValid}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!isFormValid}
                  >
                    Next
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      <ModelPickerModal
        open={modelDialog.open === true}
        title={
          modelDialog.open
            ? `${modelDialog.comp} – Select model`
            : "Select model"
        }
        options={modelDialog.open ? getOptionsFor(modelDialog.comp) : []}
        onClose={closeModelDialog}
        onPick={(model) => {
          if (modelDialog.open) {
            const opts = getOptionsFor(
              modelDialog.comp
            ) as readonly BomComponentOption[];
            const picked = opts.find((o) => o.model === model);
            setBomCell(modelDialog.comp, modelDialog.idx, {
              model,
              subVendor: picked?.subVendor ?? null,
              spec: picked?.spec ?? null,
            });
          }
          closeModelDialog();
        }}
      />
    </Dialog>
  );
};

export default EnhancedQAPModal;
// ────────────────────────────────────────────────────────────────────────────
// ModelPickerModal: full-screen table selector (matches SalesRequestPage.tsx)
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// ModelPickerModal: full-screen-ish modal for BOM "Model No." selection
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// ModelPickerModal (ported + event-shielded so it works inside Radix Dialogs)
// ────────────────────────────────────────────────────────────────────────────
const ModelPickerModal: React.FC<{
  open: boolean;
  title?: string;
  options: readonly BomComponentOption[];
  onClose: () => void;
  onPick: (model: string) => void;
}> = ({ open, title = "Select model", options, onClose, onPick }) => {
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = q
    ? options.filter(
        (o) =>
          (o.model || "").toLowerCase().includes(q.toLowerCase()) ||
          (o.subVendor || "").toLowerCase().includes(q.toLowerCase()) ||
          (o.spec || "").toLowerCase().includes(q.toLowerCase())
      )
    : options;

  // Stop ALL outside interactions at capture phase so Radix doesn't swallow them
  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      // capture-phase guards (click, pointer, wheel, focus, key)
      onMouseDownCapture={stopAll}
      onPointerDownCapture={stopAll}
      onWheelCapture={stopAll}
      onFocusCapture={stopAll}
      onKeyDownCapture={stopAll}
      // click on backdrop closes
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col pointer-events-auto">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-3 border-b">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to filter by model / sub-vendor / spec"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="overflow-auto" onWheelCapture={stopAll}>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Sub-vendor</th>
                <th className="px-3 py-2 font-medium">Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-gray-500">
                    No matches.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr
                    key={o.model}
                    className="cursor-pointer hover:bg-blue-50"
                    onClick={() => onPick(o.model)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onPick(o.model)}
                  >
                    <td className="px-3 py-2 font-mono">{o.model}</td>
                    <td className="px-3 py-2">{o.subVendor || "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap">
                      {o.spec || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render above the Radix portal/root to avoid stacking-context traps
  return createPortal(overlay, document.body);
};
