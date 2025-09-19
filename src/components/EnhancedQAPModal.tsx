import React, { useState, useEffect } from "react";
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
import { Save, Send } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { set } from "date-fns";

const API = window.location.origin;

interface EnhancedQAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (qapData: QAPFormData, status?: string) => void;
  nextSno: number;
  editingQAP?: QAPFormData | null;
  canEdit?: boolean;
}

// ⬇️ ADD: lightweight Sales Request shape (only fields we read)
type SalesRequestLite = {
  id: string;
  projectCode: string;
  customerName: string;
  moduleManufacturingPlant: string; // 'p2' | 'p5' | 'p6'
  moduleOrderType: "m10" | "g12r" | "g12";
  rfqOrderQtyMW: number;
  projectLocation: string;
  cellType?: "DCR" | "NDCR";
  qapType?: "Customer" | "Premier Energies";
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  priority?: "high" | "low";
  remarks?: string | null;
  createdBy?: string;
  createdAt?: string; // ISO
  bom?: BomPayload | null;
};

type BomRow = {
  model: string;
  subVendor?: string | null;
  spec?: string | null;
};

type BomComponent = {
  name: string; // keep it simple; matches your BOM_MASTER keys as strings
  rows: BomRow[];
};

type BomPayload = {
  vendorName: string;
  rfidLocation: string;
  technologyProposed: string; // 'M10' | 'G12R' | 'G12' in practice
  vendorAddress?: string;
  documentRef?: string;
  moduleWattageWp?: number;
  moduleDimensionsOption?: string;
  moduleModelNumber?: string;
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

const EnhancedQAPModal: React.FC<EnhancedQAPModalProps> = ({
  isOpen,
  onClose,
  onSave,
  nextSno,
  editingQAP,
  canEdit = true, // allow editing by default
}) => {
  const { user } = useAuth();

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
      const existingMqp = Array.isArray(editingQAP.qaps)
        ? editingQAP.qaps.filter((q) => q.criteria === "MQP")
        : editingQAP.specs?.mqp || [];
      const existingVisual = Array.isArray(editingQAP.qaps)
        ? editingQAP.qaps.filter(
            (q) => q.criteria === "Visual" || q.criteria === "EL"
          )
        : editingQAP.specs?.visual || [];
      setMqpData(existingMqp);
      setVisualElData(existingVisual);
      return;
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

  const initializeQAPData = () => {
    setMqpData(
      mqpSpecifications.map((spec, index) => ({
        ...spec,
        sno: nextSno + index,
        match: undefined,
        customerSpecification: undefined,
        selectedForReview: false,
        reviewBy: [],
      }))
    );

    setVisualElData(
      visualElSpecifications.map((spec, index) => ({
        ...spec,
        sno: nextSno + mqpSpecifications.length + index,
        match: undefined,
        customerSpecification: undefined,
        selectedForReview: false,
        reviewBy: [],
      }))
    );
  };

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
    const reviewBy = newData[index].reviewBy || [];

    if (checked) {
      newData[index].reviewBy = [...reviewBy, role];
    } else {
      newData[index].reviewBy = reviewBy.filter((r) => r !== role);
    }
    updateSection(newData);
  };

  const handleNext = () => {
    setShowReviewSelection(true);
  };

  const handleSend = () => {
    // build only the payload our API needs:
    const payload: Partial<QAPFormData> = {
      // only include id if we're editing; for new QAPs, omit it
      ...(editingQAP ? { id: editingQAP.id } : {}),
      customerName,
      projectCode,
      projectName,
      orderQuantity,
      productType,
      plant,
      status: "level-2",
      currentLevel: 2,
      specs: { mqp: mqpData, visual: visualElData },
      submittedBy: user?.username,
      salesRequestId: linkedSR?.id,
    };
    onSave(payload as QAPFormData, "level-2");
    onClose();
    resetForm();
    setShowReviewSelection(false);
  };

  const handleSave = () => {
    const payload: Partial<QAPFormData> = {
      // only include id if we're editing; for new QAPs, omit it
      ...(editingQAP ? { id: editingQAP.id } : {}),
      customerName,
      projectCode,
      projectName,
      orderQuantity,
      productType,
      plant,
      status: "draft",
      currentLevel: 1,
      specs: { mqp: mqpData, visual: visualElData },
      submittedBy: user?.username,
      salesRequestId: linkedSR?.id,
    };
    onSave(payload as QAPFormData, "draft");
    onClose();
    resetForm();
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

  const renderReviewSelection = () => {
    const unmatchedItems = getUnmatchedItems();

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-red-600">
          Unmatched Items for Review
        </h3>
        {unmatchedItems.map((item, index) => (
          <div
            key={item.sno}
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
                {item.specification || item.criteriaLimits}
              </p>
              <p className="text-sm font-medium">
                Customer Specification: {item.customerSpecification}
              </p>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={item.reviewBy?.includes("production") || false}
                  onCheckedChange={(checked) =>
                    handleReviewByChange(
                      item.criteria === "MQP" ? "mqp" : "visual",
                      mqpData.includes(item)
                        ? mqpData.indexOf(item)
                        : visualElData.indexOf(item),
                      "production",
                      checked as boolean
                    )
                  }
                />
                <span>Production</span>
              </label>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={item.reviewBy?.includes("quality") || false}
                  onCheckedChange={(checked) =>
                    handleReviewByChange(
                      item.criteria === "MQP" ? "mqp" : "visual",
                      mqpData.includes(item)
                        ? mqpData.indexOf(item)
                        : visualElData.indexOf(item),
                      "quality",
                      checked as boolean
                    )
                  }
                />
                <span>Quality</span>
              </label>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={item.reviewBy?.includes("technical") || false}
                  onCheckedChange={(checked) =>
                    handleReviewByChange(
                      item.criteria === "MQP" ? "mqp" : "visual",
                      mqpData.includes(item)
                        ? mqpData.indexOf(item)
                        : visualElData.indexOf(item),
                      "technical",
                      checked as boolean
                    )
                  }
                />
                <span>Technical</span>
              </label>
            </div>
          </div>
        ))}
        {canEdit && (
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
            >
              <Send className="w-4 h-4 mr-2" />
              Send for Review
            </Button>
          </div>
        )}
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <DialogTitle className="text-2xl font-bold">
            {editingQAP ? "Edit QAP" : "New QAP"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          {!showReviewSelection ? (
            <>
              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 bg-blue-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <Label>Customer Name (auto)</Label>
                  <Input value={customerName} readOnly />

                  <div className="space-y-2">
                    <Label>Project Code *</Label>
                    <Select
                      value={projectCode}
                      onValueChange={onPickProjectCode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project code" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectCodeOptions.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Project Name *</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quantity in MW *</Label>
                  <Input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Number(e.target.value))}
                    placeholder="Enter quantity in MW"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Product Type *</Label>
                  <Select value={productType} onValueChange={setProductType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product type" />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Plant *</Label>
                  <Select value={plant} onValueChange={setPlant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plant" />
                    </SelectTrigger>
                    <SelectContent>
                      {plantOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sales Request Snapshot (auto when a Project Code is chosen) */}
              {projectCode && (
                <div className="mb-6 border rounded-lg p-4 bg-amber-50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-amber-900">
                      Sales Request Snapshot
                    </h3>
                    {loadingSR && (
                      <span className="text-sm text-amber-700">Loading…</span>
                    )}
                  </div>

                  {!loadingSR && !linkedSR && (
                    <div className="text-sm text-amber-800">
                      No Sales Request found for <b>{projectCode}</b>. You can
                      still fill the fields manually.
                    </div>
                  )}

                  {linkedSR && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <Label className="text-amber-700">Project Code</Label>
                        <div className="font-medium">
                          {linkedSR.projectCode}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">Customer</Label>
                        <div className="font-medium">
                          {linkedSR.customerName}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">Plant</Label>
                        <div className="font-medium uppercase">
                          {linkedSR.moduleManufacturingPlant}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">Order Type</Label>
                        <div className="font-medium uppercase">
                          {linkedSR.moduleOrderType}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">Cell Type</Label>
                        <div className="font-medium">
                          {linkedSR.cellType || "-"}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">RFQ Qty (MW)</Label>
                        <div className="font-medium">
                          {linkedSR.rfqOrderQtyMW?.toLocaleString?.() ?? "-"}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">
                          Delivery Timeline
                        </Label>
                        <div className="font-medium">
                          {(linkedSR.deliveryStartDate || "—") +
                            " → " +
                            (linkedSR.deliveryEndDate || "—")}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">Location</Label>
                        <div className="font-medium">
                          {linkedSR.projectLocation || "-"}
                        </div>
                      </div>
                      <div>
                        <Label className="text-amber-700">Priority</Label>
                        <div className="font-medium capitalize">
                          {linkedSR.priority || "-"}
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-amber-700">Remarks</Label>
                        <div className="font-medium">
                          {linkedSR.remarks || "-"}
                        </div>
                      </div>

                      {/* Optional BOM highlights when present */}
                      {linkedSR.bom && (
                        <>
                          <div>
                            <Label className="text-amber-700">Tech (BOM)</Label>
                            <div className="font-medium">
                              {linkedSR.bom.technologyProposed || "-"}
                            </div>
                          </div>
                          <div>
                            <Label className="text-amber-700">
                              Module Wattage (WP)
                            </Label>
                            <div className="font-medium">
                              {linkedSR.bom.moduleWattageWp ?? "-"}
                            </div>
                          </div>
                          <div>
                            <Label className="text-amber-700">
                              Model Number
                            </Label>
                            <div className="font-medium">
                              {linkedSR.bom.moduleModelNumber || "-"}
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <Label className="text-amber-700">Dimensions</Label>
                            <div className="font-medium">
                              {linkedSR.bom.moduleDimensionsOption || "-"}
                            </div>
                          </div>
                        </>
                      )}
                      {renderBomTable(linkedSR.bom)}
                    </div>
                  )}
                </div>
              )}

              {/* Tabs for MQP and Visual/EL - simplified version for this implementation */}
              <Tabs defaultValue="mqp" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="mqp">MQP ({mqpData.length})</TabsTrigger>
                  <TabsTrigger value="visual-el">
                    Visual & EL ({visualElData.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="mqp">{renderMQPTable()}</TabsContent>

                <TabsContent value="visual-el">
                  {renderVisualElTable()}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            renderReviewSelection()
          )}
        </div>

        {!showReviewSelection && (
          <div className="p-6 pt-0 border-t bg-gray-50">
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline">
                {canEdit ? "Cancel" : "Close"}
              </Button>
              {canEdit && (
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
    </Dialog>
  );
};

export default EnhancedQAPModal;
