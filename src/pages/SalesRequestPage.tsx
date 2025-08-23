// src/pages/SalesRequestsPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BOM_MASTER,
  TECHNOLOGIES,
  VENDOR_NAME_LOCKIN,
  RFID_LOCATION_LOCKIN,
  type BomComponentName,
  type BomComponentOption,
  getOptionsFor,
} from "@/data/bomMaster";

type YesNo = "yes" | "no";
type Plant = "p2" | "p4" | "p5" | "p6";
type OrderType = "m10" | "g12r" | "g12";
type CellType = "DCR" | "NDCR";
type QapType = "Customer" | "Premier Energies";
type Priority = "high" | "low";
type Technology = (typeof TECHNOLOGIES)[number];

export interface SalesRequest {
  id: string;
  customerName: string;
  isNewCustomer: YesNo;
  moduleManufacturingPlant: Plant;
  moduleOrderType: OrderType;
  cellType: CellType;
  wattageBinning: number;
  rfqOrderQtyMW: number;
  premierBiddedOrderQtyMW?: number | null;
  deliveryStartDate: string; // YYYY-MM-DD
  deliveryEndDate: string; // YYYY-MM-DD
  projectLocation: string;
  cableLengthRequired: number;
  qapType: QapType;
  qapTypeAttachmentUrl?: string | null;
  primaryBom: YesNo;
  primaryBomAttachmentUrl?: string | null;
  inlineInspection: YesNo;
  cellProcuredBy: "Customer" | "Premier Energies";
  agreedCTM: number;
  factoryAuditTentativeDate?: string | null; // YYYY-MM-DD
  xPitchMm?: number | null;
  trackerDetails?: number | null;
  priority: Priority;
  remarks?: string | null;
  otherAttachments?: { title: string; url: string }[];
  createdBy: string;
  createdAt: string; // ISO

  // Optional: if backend echoes BOM back later
  bom?: BomPayload;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  BOM types                                                                */
/* ────────────────────────────────────────────────────────────────────────── */
type BomRow = {
  model: string;
  subVendor?: string | null;
  spec?: string | null;
};
type BomComponent = {
  name: BomComponentName;
  rows: BomRow[];
};

type BomPayload = {
  vendorName: string; // lock-in
  rfidLocation: string; // lock-in
  technologyProposed: Technology;
  vendorAddress: string;
  documentRef: string; // auto
  moduleWattageWp: number;
  moduleDimensionsOption: "1" | "2" | "3";
  moduleModelNumber: string;
  components: BomComponent[];
};

const API = window.location.origin;

const SalesRequestsPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: list = [], isLoading } = useQuery<SalesRequest[]>({
    queryKey: ["sales-requests"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sales-requests`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load sales requests");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const r = await fetch(`${API}/api/sales-requests`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || "Failed to create sales request");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-requests"] });
      setOpen(false);
    },
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sales Requests</CardTitle>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            + Create New
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading…</div>
          ) : list.length === 0 ? (
            <div className="text-gray-600">No sales requests yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <Th>Customer Name</Th>
                    <Th>New Customer?</Th>
                    <Th>Plant</Th>
                    <Th>Order Type</Th>
                    <Th>Cell Type</Th>
                    <Th>Wattage Binning</Th>
                    <Th>RFQ Qty (MW)</Th>
                    <Th>Premier Bidded Qty (MW)</Th>
                    <Th>Delivery Timeline</Th>
                    <Th>Project Location</Th>
                    <Th>Cable Length</Th>
                    <Th>QAP Type</Th>
                    <Th>Primary BOM?</Th>
                    <Th>Inline Inspection?</Th>
                    <Th>Cell Procured By</Th>
                    <Th>Agreed CTM</Th>
                    <Th>Audit Date</Th>
                    <Th>X Pitch (mm)</Th>
                    <Th>Tracker @790/1400</Th>
                    <Th>Priority</Th>
                    <Th>Remarks</Th>
                    <Th>Attachments</Th>
                    <Th>Created By</Th>
                    <Th>Created At</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((row) => (
                    <tr key={row.id} className="align-top">
                      <Td>{row.customerName}</Td>
                      <Td className="capitalize">{row.isNewCustomer}</Td>
                      <Td className="uppercase">{row.moduleManufacturingPlant}</Td>
                      <Td className="uppercase">{row.moduleOrderType}</Td>
                      <Td>{row.cellType}</Td>
                      <Td>{fmtNum(row.wattageBinning)}</Td>
                      <Td>{fmtNum(row.rfqOrderQtyMW)}</Td>
                      <Td>{row.premierBiddedOrderQtyMW ?? "-"}</Td>
                      <Td>{row.deliveryStartDate} → {row.deliveryEndDate}</Td>
                      <Td>{row.projectLocation}</Td>
                      <Td>{fmtNum(row.cableLengthRequired)}</Td>
                      <Td>
                        {row.qapType}
                        {row.qapTypeAttachmentUrl && (
                          <>
                            <br />
                            <a
                              href={row.qapTypeAttachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              View QAP Type file
                            </a>
                          </>
                        )}
                      </Td>
                      <Td>
                        {row.primaryBom}
                        {row.primaryBomAttachmentUrl && (
                          <>
                            <br />
                            <a
                              href={row.primaryBomAttachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              View BOM file
                            </a>
                          </>
                        )}
                      </Td>
                      <Td className="capitalize">{row.inlineInspection}</Td>
                      <Td>{row.cellProcuredBy}</Td>
                      <Td>{fmtDec(row.agreedCTM)}</Td>
                      <Td>{row.factoryAuditTentativeDate || "-"}</Td>
                      <Td>{row.xPitchMm ?? "-"}</Td>
                      <Td>{row.trackerDetails ?? "-"}</Td>
                      <Td className="capitalize">{row.priority}</Td>
                      <Td className="max-w-[18rem] truncate" title={row.remarks || ""}>
                        {row.remarks || "-"}
                      </Td>
                      <Td>
                        {row.otherAttachments?.length ? (
                          <ul className="list-disc pl-5 space-y-1">
                            {row.otherAttachments.map((a, i) => (
                              <li key={i}>
                                <a
                                  href={a.url}
                                  className="text-blue-600 underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {a.title || `Attachment ${i + 1}`}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>{row.createdBy}</Td>
                      <Td>{new Date(row.createdAt).toLocaleString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {open && (
        <SalesRequestModal
          onClose={() => setOpen(false)}
          onCreate={(form) => createMutation.mutate(form)}
          creating={createMutation.isPending}
          currentUser={user?.username || "sales"}
        />
      )}
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{children}</th>
);
const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <td className={`px-3 py-2 whitespace-nowrap ${className || ""}`}>{children}</td>
);

function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return "-";
  return Number(n).toLocaleString();
}
function fmtDec(n?: number | null) {
  if (n === null || n === undefined) return "-";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function displayInt(s: any) {
  if (s === "" || s === null || s === undefined) return "-";
  const n = Number(s);
  return Number.isFinite(n) ? fmtNum(n) : "-";
}
function displayFloat(s: any) {
  if (s === "" || s === null || s === undefined) return "-";
  const n = Number(s);
  return Number.isFinite(n) ? fmtDec(n) : "-";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Modal                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
const SalesRequestModal: React.FC<{
  onClose: () => void;
  onCreate: (formData: FormData) => void;
  creating: boolean;
  currentUser: string;
}> = ({ onClose, onCreate, creating, currentUser }) => {
  // Core request fields (store numbers as strings for smooth typing)
  const [state, setState] = useState({
    customerName: "",
    isNewCustomer: "yes" as YesNo,
    moduleManufacturingPlant: "p2" as Plant,
    moduleOrderType: "m10" as OrderType,
    cellType: "DCR" as CellType,
    wattageBinning: "" as string,
    rfqOrderQtyMW: "" as string,
    premierBiddedOrderQtyMW: "" as string,
    deliveryStartDate: "",
    deliveryEndDate: "",
    projectLocation: "",
    cableLengthRequired: "" as string,
    qapType: "Customer" as QapType,
    primaryBom: "no" as YesNo,
    inlineInspection: "no" as YesNo,
    cellProcuredBy: "Customer" as "Customer" | "Premier Energies",
    agreedCTM: "" as string, // decimal string
    factoryAuditTentativeDate: "",
    xPitchMm: "" as string,
    trackerDetails: "" as string,
    priority: "low" as Priority,
    remarks: "",
  });

  // Attachments
  const [qapTypeFile, setQapTypeFile] = useState<File | null>(null);
  const [primaryBomFile, setPrimaryBomFile] = useState<File | null>(null);
  const [otherFiles, setOtherFiles] = useState<{ title: string; file: File | null }[]>([]);

  // BOM editor state
  const [tech, setTech] = useState<Technology>("M10");
  const [vendorAddress, setVendorAddress] = useState("");
  const [moduleWattageWp, setModuleWattageWp] = useState<string>(""); // integer string
  const [moduleDimensionsOption, setModuleDimensionsOption] = useState<"1" | "2" | "3">("1");
  const [moduleModelNumber, setModuleModelNumber] = useState("");
  const [components, setComponents] = useState<BomComponent[]>([]);
  const [docRef, setDocRef] = useState("");

  // Preview toggle
  const [showPreview, setShowPreview] = useState(false);

  // Auto-generate Document Ref when customer/tech/date change
  useEffect(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;
    const cus3 = (state.customerName || "CUS").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CUS";
    const seq = "0001"; // FE placeholder; BE can override
    const ref = `BOM_${cus3}_${tech} Rev.0, ${dateStr}: BOM-${cus3}-${seq}-${yyyy}${mm}${dd}`;
    setDocRef(ref);
  }, [state.customerName, tech]);

  // Sync technology with Order Type
  useEffect(() => {
    const map: Record<OrderType, Technology> = { m10: "M10", g12r: "G12R", g12: "G12" };
    setTech(map[state.moduleOrderType]);
  }, [state.moduleOrderType]);

  const canSubmit = useMemo(() => {
    const basicsOk =
      state.customerName.trim() &&
      state.deliveryStartDate &&
      state.deliveryEndDate &&
      state.projectLocation.trim() &&
      Number(state.rfqOrderQtyMW) > 0;

    const wattOk = moduleWattageWp !== "" && Number(moduleWattageWp) > 0;

    const bomOk =
      !!moduleModelNumber.trim() &&
      wattOk &&
      components.length > 0 &&
      components.every((c) => c.rows.length > 0 && c.rows.every((r) => !!r.model));

    return !!(basicsOk && bomOk);
  }, [
    state.customerName,
    state.deliveryStartDate,
    state.deliveryEndDate,
    state.projectLocation,
    state.rfqOrderQtyMW,
    moduleModelNumber,
    moduleWattageWp,
    components,
  ]);

  const addOtherFile = () => setOtherFiles((p) => [...p, { title: "", file: null }]);
  const updateOther = (idx: number, patch: Partial<{ title: string; file: File | null }>) =>
    setOtherFiles((p) => {
      const copy = [...p];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  const removeOther = (idx: number) => setOtherFiles((p) => p.filter((_, i) => i !== idx));

  // BOM handlers
  const availableComponents = Object.keys(BOM_MASTER) as BomComponentName[];
  const addComponent = (name: BomComponentName) => {
    setComponents((prev) => (prev.find((c) => c.name === name) ? prev : [...prev, { name, rows: [] }]));
  };
  const removeComponent = (name: BomComponentName) => {
    setComponents((prev) => prev.filter((c) => c.name !== name));
  };
  const addRow = (name: BomComponentName) => {
    setComponents((prev) => prev.map((c) => (c.name === name ? { ...c, rows: [...c.rows, { model: "" }] } : c)));
  };
  const removeRow = (name: BomComponentName, idx: number) => {
    setComponents((prev) =>
      prev.map((c) => (c.name === name ? { ...c, rows: c.rows.filter((_, i) => i !== idx) } : c))
    );
  };
  const setRowModel = (name: BomComponentName, idx: number, model: string) => {
    const options = getOptionsFor(name) as readonly BomComponentOption[];
    const picked = options.find((o) => o.model === model);
    setComponents((prev) =>
      prev.map((c) => {
        if (c.name !== name) return c;
        const rows = [...c.rows];
        rows[idx] = { model, subVendor: picked?.subVendor ?? null, spec: picked?.spec ?? null };
        return { ...c, rows };
      })
    );
  };

  // Assemble BOM payload
  const bomPayload: BomPayload = useMemo(
    () => ({
      vendorName: VENDOR_NAME_LOCKIN,
      rfidLocation: RFID_LOCATION_LOCKIN,
      technologyProposed: tech,
      vendorAddress,
      documentRef: docRef,
      moduleWattageWp: Number(moduleWattageWp || 0),
      moduleDimensionsOption,
      moduleModelNumber: moduleModelNumber.trim(),
      components,
    }),
    [tech, vendorAddress, docRef, moduleWattageWp, moduleDimensionsOption, moduleModelNumber, components]
  );

  const submit = () => {
    const fd = new FormData();
    // core fields
    fd.append("customerName", state.customerName.trim());
    fd.append("isNewCustomer", state.isNewCustomer);
    fd.append("moduleManufacturingPlant", state.moduleManufacturingPlant);
    fd.append("moduleOrderType", state.moduleOrderType);
    fd.append("cellType", state.cellType);
    fd.append("wattageBinning", String(Number(state.wattageBinning || 0)));
    fd.append("rfqOrderQtyMW", String(Number(state.rfqOrderQtyMW || 0)));
    if (state.premierBiddedOrderQtyMW !== "") {
      fd.append("premierBiddedOrderQtyMW", String(Number(state.premierBiddedOrderQtyMW || 0)));
    }
    fd.append("deliveryStartDate", state.deliveryStartDate);
    fd.append("deliveryEndDate", state.deliveryEndDate);
    fd.append("projectLocation", state.projectLocation.trim());
    fd.append("cableLengthRequired", String(Number(state.cableLengthRequired || 0)));
    fd.append("qapType", state.qapType);
    fd.append("primaryBom", state.primaryBom);
    fd.append("inlineInspection", state.inlineInspection);
    fd.append("cellProcuredBy", state.cellProcuredBy);
    fd.append("agreedCTM", String(Number(state.agreedCTM || 0)));
    if (state.factoryAuditTentativeDate) fd.append("factoryAuditTentativeDate", state.factoryAuditTentativeDate);
    if (state.xPitchMm !== "") fd.append("xPitchMm", String(Number(state.xPitchMm || 0)));
    if (state.trackerDetails !== "") fd.append("trackerDetails", String(Number(state.trackerDetails || 0)));
    fd.append("priority", state.priority);
    if (state.remarks.trim()) fd.append("remarks", state.remarks.trim());
    fd.append("createdBy", currentUser);

    // BOM JSON payload
    fd.append("bom", JSON.stringify(bomPayload));

    // attachments
    if (qapTypeFile) fd.append("qapTypeAttachment", qapTypeFile);
    if (state.primaryBom === "yes" && primaryBomFile) fd.append("primaryBomAttachment", primaryBomFile);
    if (otherFiles.length) {
      fd.append("otherAttachmentTitles", JSON.stringify(otherFiles.map((o) => (o.title || "").trim())));
      otherFiles.forEach((o) => {
        if (o.file) fd.append("otherAttachments", o.file);
      });
    }

    onCreate(fd);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-h-[92vh] w-full max-w-6xl overflow-auto">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Create Sales Request</h2>
          <div className="flex items-center gap-2">
            <Button variant={showPreview ? "secondary" : "outline"} onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? "Back to Edit" : "Preview"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {!showPreview ? (
          <>
            {/* Core form */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Text
                label="Customer Name"
                required
                value={state.customerName}
                onChange={(v) => setState((s) => ({ ...s, customerName: v }))}
              />

              <Select
                label="Is this a new customer?"
                required
                value={state.isNewCustomer}
                onChange={(v: any) => setState((s) => ({ ...s, isNewCustomer: v }))}
                options={["yes", "no"]}
              />

              <Select
                label="Module Manufacturing Plant"
                required
                value={state.moduleManufacturingPlant}
                onChange={(v: any) => setState((s) => ({ ...s, moduleManufacturingPlant: v }))}
                options={["p2", "p4", "p5", "p6"]}
              />

              <Select
                label="Module Order Type"
                required
                value={state.moduleOrderType}
                onChange={(v: any) => setState((s) => ({ ...s, moduleOrderType: v }))}
                options={["m10", "g12r", "g12"]}
              />

              <Select
                label="Cell Type"
                required
                value={state.cellType}
                onChange={(v: any) => setState((s) => ({ ...s, cellType: v }))}
                options={["DCR", "NDCR"]}
              />

              <IntField
                label="Wattage Binning/Distribution"
                required
                value={state.wattageBinning}
                onChange={(v) => setState((s) => ({ ...s, wattageBinning: v }))}
                placeholder="e.g., 540"
              />

              <IntField
                label="RFQ Order Quantity in MW"
                required
                value={state.rfqOrderQtyMW}
                onChange={(v) => setState((s) => ({ ...s, rfqOrderQtyMW: v }))}
                placeholder="e.g., 20"
              />

              <IntField
                label="Premier Bidded Actual Order Quantity in MW"
                value={state.premierBiddedOrderQtyMW}
                onChange={(v) => setState((s) => ({ ...s, premierBiddedOrderQtyMW: v }))}
                placeholder="optional"
              />

              <DateRange
                label="Delivery Timeline"
                start={state.deliveryStartDate}
                end={state.deliveryEndDate}
                onChange={(start, end) =>
                  setState((s) => ({ ...s, deliveryStartDate: start, deliveryEndDate: end }))
                }
              />

              <Text
                label="Project Location"
                required
                value={state.projectLocation}
                onChange={(v) => setState((s) => ({ ...s, projectLocation: v }))}
              />

              <IntField
                label="Cable Length Required"
                required
                value={state.cableLengthRequired}
                onChange={(v) => setState((s) => ({ ...s, cableLengthRequired: v }))}
                placeholder="in meters"
              />

              {/* Right column */}
              <Select
                label="QAP Type"
                required
                value={state.qapType}
                onChange={(v: any) => setState((s) => ({ ...s, qapType: v }))}
                options={["Customer", "Premier Energies"]}
              />

              <File label="QAP Type attachment" onChange={setQapTypeFile} />

              <Select
                label="Primary Technical Document - Primary BOM"
                required
                value={state.primaryBom}
                onChange={(v: any) => setState((s) => ({ ...s, primaryBom: v }))}
                options={["yes", "no"]}
              />

              {state.primaryBom === "yes" && <File label="Primary BOM attachment" onChange={setPrimaryBomFile} />}

              <Select
                label="Inline Inspection"
                required
                value={state.inlineInspection}
                onChange={(v: any) => setState((s) => ({ ...s, inlineInspection: v }))}
                options={["yes", "no"]}
              />

              <Select
                label="Cell Procured By"
                required
                value={state.cellProcuredBy}
                onChange={(v: any) => setState((s) => ({ ...s, cellProcuredBy: v }))}
                options={["Customer", "Premier Energies"]}
              />

              <FloatField
                label="Agreed CTM"
                required
                value={state.agreedCTM}
                onChange={(v) => setState((s) => ({ ...s, agreedCTM: v }))}
                placeholder="e.g., 0.9925"
              />

              <DateSingle
                label="Factory Audit Tentative Date"
                value={state.factoryAuditTentativeDate}
                onChange={(v) => setState((s) => ({ ...s, factoryAuditTentativeDate: v }))}
              />

              <IntField
                label="X Pitch (in mm) if any special req"
                value={state.xPitchMm}
                onChange={(v) => setState((s) => ({ ...s, xPitchMm: v }))}
                placeholder="optional"
              />

              <IntField
                label="Tracker Details @790mm/1400mm"
                value={state.trackerDetails}
                onChange={(v) => setState((s) => ({ ...s, trackerDetails: v }))}
                placeholder="optional"
              />

              <Select
                label="Priority"
                required
                value={state.priority}
                onChange={(v: any) => setState((s) => ({ ...s, priority: v }))}
                options={["high", "low"]}
              />

              <Textarea
                label="Remarks (optional)"
                value={state.remarks}
                onChange={(v) => setState((s) => ({ ...s, remarks: v }))}
              />

              {/* Multi file attachments with titles */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium">Any Other Attachments</label>
                  <Button type="button" variant="outline" onClick={addOtherFile}>+ Add</Button>
                </div>
                {otherFiles.length === 0 ? (
                  <div className="text-sm text-gray-500">None added.</div>
                ) : (
                  <div className="space-y-3">
                    {otherFiles.map((o, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="text-sm text-gray-700">Title</label>
                          <input
                            className="w-full border rounded px-3 py-2"
                            value={o.title}
                            onChange={(e) => updateOther(idx, { title: e.target.value })}
                            placeholder={`Attachment ${idx + 1} title`}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-700">File</label>
                          <input
                            type="file"
                            className="w-full border rounded px-3 py-1.5"
                            onChange={(e) => updateOther(idx, { file: e.target.files?.[0] || null })}
                          />
                        </div>
                        <div className="flex md:justify-end">
                          <Button type="button" variant="destructive" onClick={() => removeOther(idx)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BOM section */}
            <div className="px-4 pb-4">
              <Card>
                <CardHeader>
                  <CardTitle>BOM (Bill of Materials)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Lock-ins & Header fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ReadOnly label="Solar Module Vendor Name (lock-in)" value={VENDOR_NAME_LOCKIN} />
                    <ReadOnly label="Location of RFID in module (lock-in)" value={RFID_LOCATION_LOCKIN} />
                    <Select
                      label="Technology Proposed"
                      value={tech}
                      onChange={(v: any) => setTech(v as Technology)}
                      options={TECHNOLOGIES}
                      required
                    />
                    <Text label="Solar Module Vendor Address" value={vendorAddress} onChange={setVendorAddress} />
                    <ReadOnly label="Document Ref (auto)" value={docRef} />

                    <IntField
                      label="Module Wattage (WP)"
                      value={moduleWattageWp}
                      onChange={setModuleWattageWp}
                      required
                      placeholder="e.g., 540"
                    />

                    <Select
                      label="Module Dimensions"
                      value={moduleDimensionsOption}
                      onChange={(v: any) => setModuleDimensionsOption(v as "1" | "2" | "3")}
                      options={["1", "2", "3"]}
                      required
                    />
                    <Text label="Module Model Number" value={moduleModelNumber} onChange={setModuleModelNumber} required />
                  </div>

                  {/* Add component */}
                  <div className="flex flex-col md:flex-row gap-2 md:items-end">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 mb-1">Add Component</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value as BomComponentName;
                          if (v) addComponent(v);
                          e.currentTarget.selectedIndex = 0;
                        }}
                      >
                        <option value="" disabled>Select component…</option>
                        {availableComponents.map((c) => (
                          <option key={c} value={c} disabled={!!components.find((x) => x.name === c)}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    {components.length > 0 && (
                      <div className="text-sm text-gray-600 md:ml-auto">
                        Tip: Use “+ Add Row” inside each component to add multiple entries (e.g., two cell types).
                      </div>
                    )}
                  </div>

                  {/* Component tables */}
                  <div className="space-y-6">
                    {components.map((c) => (
                      <div key={c.name} className="border rounded-md">
                        <div className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-gray-50">
                          <div className="font-medium">{c.name}</div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => addRow(c.name)}>
                              + Add Row
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => removeComponent(c.name)}>
                              Remove Component
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-left">
                                <Th>Part No / Type / Model</Th>
                                <Th>Name of Sub-vendor / Manufacturer</Th>
                                <Th>Specification</Th>
                                <Th>Action</Th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {c.rows.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-3 py-3 text-gray-500">
                                    No rows yet. Click “Add Row”.
                                  </td>
                                </tr>
                              ) : (
                                c.rows.map((r, idx) => {
                                  const opts = getOptionsFor(c.name);
                                  return (
                                    <tr key={idx} className="align-top">
                                      <td className="px-3 py-2 min-w-[18rem]">
                                        <select
                                          className="w-full border rounded px-3 py-2"
                                          value={r.model}
                                          onChange={(e) => setRowModel(c.name, idx, e.target.value)}
                                        >
                                          <option value="" disabled>Select model…</option>
                                          {opts.map((o) => (
                                            <option key={o.model} value={o.model}>
                                              {o.model}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2 min-w-[16rem]">
                                        <input className="w-full border rounded px-3 py-2 bg-gray-50" value={r.subVendor ?? ""} readOnly />
                                      </td>
                                      <td className="px-3 py-2 min-w-[24rem]">
                                        <div className="border rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">
                                          {r.spec || "—"}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <Button size="sm" variant="destructive" onClick={() => removeRow(c.name, idx)}>
                                          Remove
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!canSubmit || creating} onClick={submit} className="bg-blue-600 hover:bg-blue-700">
                {creating ? "Saving…" : "Create"}
              </Button>
            </div>
          </>
        ) : (
          // Preview
          <div className="p-4 space-y-6">
            <Card>
              <CardHeader><CardTitle>Request Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <PreviewRow label="Customer Name" value={state.customerName} />
                  <PreviewRow label="New Customer?" value={state.isNewCustomer} />
                  <PreviewRow label="Manufacturing Plant" value={state.moduleManufacturingPlant.toUpperCase()} />
                  <PreviewRow label="Order Type" value={state.moduleOrderType.toUpperCase()} />
                  <PreviewRow label="Cell Type" value={state.cellType} />
                  <PreviewRow label="Wattage Binning" value={displayInt(state.wattageBinning)} />
                  <PreviewRow label="RFQ Qty (MW)" value={displayInt(state.rfqOrderQtyMW)} />
                  <PreviewRow
                    label="Premier Bidded Qty (MW)"
                    value={state.premierBiddedOrderQtyMW !== "" ? displayInt(state.premierBiddedOrderQtyMW) : "-"}
                  />
                  <PreviewRow
                    label="Delivery Timeline"
                    value={`${state.deliveryStartDate || "—"} → ${state.deliveryEndDate || "—"}`}
                  />
                  <PreviewRow label="Project Location" value={state.projectLocation} />
                  <PreviewRow label="Cable Length" value={displayInt(state.cableLengthRequired)} />
                  <PreviewRow label="QAP Type" value={state.qapType} />
                  <PreviewRow label="Primary BOM?" value={state.primaryBom.toUpperCase()} />
                  <PreviewRow label="Inline Inspection?" value={state.inlineInspection.toUpperCase()} />
                  <PreviewRow label="Cell Procured By" value={state.cellProcuredBy} />
                  <PreviewRow label="Agreed CTM" value={displayFloat(state.agreedCTM)} />
                  <PreviewRow label="Factory Audit Date" value={state.factoryAuditTentativeDate || "-"} />
                  <PreviewRow label="X Pitch (mm)" value={state.xPitchMm !== "" ? state.xPitchMm : "-"} />
                  <PreviewRow label="Tracker @790/1400" value={state.trackerDetails !== "" ? state.trackerDetails : "-"} />
                  <PreviewRow label="Priority" value={state.priority} />
                  <div className="md:col-span-3">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Remarks:</span> {state.remarks || "-"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>BOM Preview</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <PreviewRow label="Vendor (lock-in)" value={VENDOR_NAME_LOCKIN} />
                  <PreviewRow label="RFID Location (lock-in)" value={RFID_LOCATION_LOCKIN} />
                  <PreviewRow label="Technology Proposed" value={tech} />
                  <PreviewRow label="Vendor Address" value={vendorAddress || "-"} />
                  <PreviewRow label="Document Ref" value={docRef} />
                  <PreviewRow label="Module Wattage (WP)" value={moduleWattageWp ? displayInt(moduleWattageWp) : "-"} />
                  <PreviewRow label="Module Dimensions" value={moduleDimensionsOption} />
                  <PreviewRow label="Module Model Number" value={moduleModelNumber} />
                </div>

                {components.length === 0 ? (
                  <div className="text-gray-500 text-sm">No components added.</div>
                ) : (
                  <div className="space-y-6">
                    {components.map((c) => (
                      <div key={c.name} className="overflow-auto">
                        <div className="font-medium mb-2">{c.name}</div>
                        <table className="min-w-full text-sm border">
                          <thead className="bg-gray-50 text-left">
                            <tr>
                              <Th>Part No / Type / Model</Th>
                              <Th>Sub-vendor / Manufacturer</Th>
                              <Th>Specification</Th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {c.rows.map((r, idx) => (
                              <tr key={idx} className="align-top">
                                <Td>{r.model || "-"}</Td>
                                <Td>{r.subVendor || "-"}</Td>
                                <Td><div className="whitespace-pre-wrap">{r.spec || "—"}</div></Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="border-t pt-4 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPreview(false)}>Back to Edit</Button>
              <Button disabled={!canSubmit || creating} onClick={submit} className="bg-blue-600 hover:bg-blue-700">
                {creating ? "Saving…" : "Create"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Small field + preview components                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const Text: React.FC<{ label: string; value: string; onChange: (v: string) => void; required?: boolean }> = ({
  label,
  value,
  onChange,
  required,
}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">
      {label}
      {required && " *"}
    </label>
    <input className="w-full border rounded px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const ReadOnly: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input className="w-full border rounded px-3 py-2 bg-gray-50" value={value} readOnly />
  </div>
);

const Textarea: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="md:col-span-2">
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <textarea className="w-full border rounded px-3 py-2 min-h-[96px]" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean }> = ({
  label,
  value,
  onChange,
  options,
  required,
}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">
      {label}
      {required && " *"}
    </label>
    <select className="w-full border rounded px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

/** Integer input (string-based) that allows free typing and clearing. */
const IntField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, required, placeholder }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">
      {label}
      {required && " *"}
    </label>
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className="w-full border rounded px-3 py-2"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || /^[0-9]+$/.test(v)) onChange(v);
      }}
      placeholder={placeholder}
    />
  </div>
);

/** Decimal input (string-based) that allows digits and a single dot. */
const FloatField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, required, placeholder }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">
      {label}
      {required && " *"}
    </label>
    <input
      type="text"
      inputMode="decimal"
      className="w-full border rounded px-3 py-2"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || /^([0-9]+(\.[0-9]*)?)$/.test(v)) onChange(v);
      }}
      placeholder={placeholder}
    />
  </div>
);

const DateSingle: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input type="date" className="w-full border rounded px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const DateRange: React.FC<{ label: string; start: string; end: string; onChange: (s: string, e: string) => void }> = ({
  label,
  start,
  end,
  onChange,
}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label} *</label>
    <div className="flex items-center gap-2">
      <input type="date" className="w-full border rounded px-3 py-2" value={start} onChange={(e) => onChange(e.target.value, end)} />
      <span>→</span>
      <input type="date" className="w-full border rounded px-3 py-2" value={end} onChange={(e) => onChange(start, e.target.value)} />
    </div>
  </div>
);

const File: React.FC<{ label: string; onChange: (f: File | null) => void }> = ({ label, onChange }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input type="file" className="w-full border rounded px-3 py-1.5" onChange={(e) => onChange(e.target.files?.[0] || null)} />
  </div>
);

const PreviewRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value}</span>
  </div>
);

export default SalesRequestsPage;
