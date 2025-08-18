import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type YesNo = "yes" | "no";
type Plant = "p2" | "p4" | "p5" | "p6";
type OrderType = "m10" | "g12r" | "g12";
type CellType = "DCR" | "NDCR";
type QapType = "Customer" | "Premier Energies";
type Priority = "high" | "low";

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
  deliveryEndDate: string;   // YYYY-MM-DD
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
}

const API = window.location.origin;

const SalesRequestsPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // ──────────────────────────────────────────────────────────────
  // Fetch list
  // ──────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────
  // Create mutation (multipart for attachments)
  // ──────────────────────────────────────────────────────────────
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
                      <Td>
                        {row.deliveryStartDate} → {row.deliveryEndDate}
                      </Td>
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Modal                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
const SalesRequestModal: React.FC<{
  onClose: () => void;
  onCreate: (formData: FormData) => void;
  creating: boolean;
  currentUser: string;
}> = ({ onClose, onCreate, creating, currentUser }) => {
  const [state, setState] = useState({
    customerName: "",
    isNewCustomer: "yes" as YesNo,
    moduleManufacturingPlant: "p2" as Plant,
    moduleOrderType: "m10" as OrderType,
    cellType: "DCR" as CellType,
    wattageBinning: "" as any,
    rfqOrderQtyMW: "" as any,
    premierBiddedOrderQtyMW: "" as any,
    deliveryStartDate: "",
    deliveryEndDate: "",
    projectLocation: "",
    cableLengthRequired: "" as any,
    qapType: "Customer" as QapType,
    primaryBom: "no" as YesNo,
    inlineInspection: "no" as YesNo,
    cellProcuredBy: "Customer" as "Customer" | "Premier Energies",
    agreedCTM: "" as any,
    factoryAuditTentativeDate: "",
    xPitchMm: "" as any,
    trackerDetails: "" as any,
    priority: "low" as Priority,
    remarks: "",
  });

  const [qapTypeFile, setQapTypeFile] = useState<File | null>(null);
  const [primaryBomFile, setPrimaryBomFile] = useState<File | null>(null);
  const [otherFiles, setOtherFiles] = useState<{ title: string; file: File | null }[]>([]);

  const canSubmit = useMemo(() => {
    // basic validations
    return (
      state.customerName.trim() &&
      state.deliveryStartDate &&
      state.deliveryEndDate &&
      state.projectLocation.trim() &&
      Number(state.rfqOrderQtyMW) > 0
    );
  }, [state]);

  const addOtherFile = () => setOtherFiles((p) => [...p, { title: "", file: null }]);
  const updateOther = (idx: number, patch: Partial<{ title: string; file: File | null }>) =>
    setOtherFiles((p) => {
      const copy = [...p];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  const removeOther = (idx: number) =>
    setOtherFiles((p) => p.filter((_, i) => i !== idx));

  const submit = () => {
    const fd = new FormData();
    // required + core fields
    fd.append("customerName", state.customerName.trim());
    fd.append("isNewCustomer", state.isNewCustomer);
    fd.append("moduleManufacturingPlant", state.moduleManufacturingPlant);
    fd.append("moduleOrderType", state.moduleOrderType);
    fd.append("cellType", state.cellType);
    fd.append("wattageBinning", String(state.wattageBinning || 0));
    fd.append("rfqOrderQtyMW", String(state.rfqOrderQtyMW || 0));
    if (state.premierBiddedOrderQtyMW !== "") {
      fd.append("premierBiddedOrderQtyMW", String(state.premierBiddedOrderQtyMW));
    }
    fd.append("deliveryStartDate", state.deliveryStartDate);
    fd.append("deliveryEndDate", state.deliveryEndDate);
    fd.append("projectLocation", state.projectLocation.trim());
    fd.append("cableLengthRequired", String(state.cableLengthRequired || 0));
    fd.append("qapType", state.qapType);
    fd.append("primaryBom", state.primaryBom);
    fd.append("inlineInspection", state.inlineInspection);
    fd.append("cellProcuredBy", state.cellProcuredBy);
    fd.append("agreedCTM", String(state.agreedCTM || 0));
    if (state.factoryAuditTentativeDate) {
      fd.append("factoryAuditTentativeDate", state.factoryAuditTentativeDate);
    }
    if (state.xPitchMm !== "") fd.append("xPitchMm", String(state.xPitchMm));
    if (state.trackerDetails !== "") fd.append("trackerDetails", String(state.trackerDetails));
    fd.append("priority", state.priority);
    if (state.remarks.trim()) fd.append("remarks", state.remarks.trim());
    fd.append("createdBy", currentUser);

    // attachments
    if (qapTypeFile) fd.append("qapTypeAttachment", qapTypeFile);
    if (state.primaryBom === "yes" && primaryBomFile) {
      fd.append("primaryBomAttachment", primaryBomFile);
    }
    if (otherFiles.length) {
      // titles as JSON; files as array (order maps to titles)
      fd.append(
        "otherAttachmentTitles",
        JSON.stringify(otherFiles.map((o) => (o.title || "").trim()))
      );
      otherFiles.forEach((o) => {
        if (o.file) fd.append("otherAttachments", o.file);
      });
    }

    onCreate(fd);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-h-[92vh] w-full max-w-5xl overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Sales Request</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left column */}
          <Text label="Customer Name" required value={state.customerName}
            onChange={(v) => setState(s => ({ ...s, customerName: v }))} />

          <Select label="Is this a new customer?" required value={state.isNewCustomer}
            onChange={(v: any) => setState(s => ({ ...s, isNewCustomer: v }))} options={["yes","no"]} />

          <Select label="Module Manufacturing Plant" required value={state.moduleManufacturingPlant}
            onChange={(v: any) => setState(s => ({ ...s, moduleManufacturingPlant: v }))} options={["p2","p4","p5","p6"]} />

          <Select label="Module Order Type" required value={state.moduleOrderType}
            onChange={(v: any) => setState(s => ({ ...s, moduleOrderType: v }))} options={["m10","g12r","g12"]} />

          <Select label="Cell Type" required value={state.cellType}
            onChange={(v: any) => setState(s => ({ ...s, cellType: v }))} options={["DCR","NDCR"]} />

          <Number label="Wattage Binning/Distribution" required
            value={state.wattageBinning} onChange={(n) => setState(s => ({ ...s, wattageBinning: n }))} />

          <Number label="RFQ Order Quantity in MW" required
            value={state.rfqOrderQtyMW} onChange={(n) => setState(s => ({ ...s, rfqOrderQtyMW: n }))} />

          <Number label="Premier Bidded Actual Order Quantity in MW"
            value={state.premierBiddedOrderQtyMW as any} onChange={(n) => setState(s => ({ ...s, premierBiddedOrderQtyMW: n }))} />

          <DateRange
            label="Delivery Timeline"
            start={state.deliveryStartDate}
            end={state.deliveryEndDate}
            onChange={(start, end) => setState(s => ({ ...s, deliveryStartDate: start, deliveryEndDate: end }))}
          />

          <Text label="Project Location" required value={state.projectLocation}
            onChange={(v) => setState(s => ({ ...s, projectLocation: v }))} />

          <Number label="Cable Length Required" required
            value={state.cableLengthRequired} onChange={(n) => setState(s => ({ ...s, cableLengthRequired: n }))} />

          {/* Right column */}
          <Select label="QAP Type" required value={state.qapType}
            onChange={(v: any) => setState(s => ({ ...s, qapType: v }))} options={["Customer","Premier Energies"]} />

          <File label="QAP Type attachment" onChange={setQapTypeFile} />

          <Select label="Primary Technical Document - Primary BOM" required value={state.primaryBom}
            onChange={(v: any) => setState(s => ({ ...s, primaryBom: v }))} options={["yes","no"]} />

          {state.primaryBom === "yes" && (
            <File label="Primary BOM attachment" onChange={setPrimaryBomFile} />
          )}

          <Select label="Inline Inspection" required value={state.inlineInspection}
            onChange={(v: any) => setState(s => ({ ...s, inlineInspection: v }))} options={["yes","no"]} />

          <Select label="Cell Procured By" required value={state.cellProcuredBy}
            onChange={(v: any) => setState(s => ({ ...s, cellProcuredBy: v }))} options={["Customer","Premier Energies"]} />

          <Decimal label="Agreed CTM" required
            value={state.agreedCTM} onChange={(n) => setState(s => ({ ...s, agreedCTM: n }))} />

          <DateSingle label="Factory Audit Tentative Date"
            value={state.factoryAuditTentativeDate}
            onChange={(v) => setState(s => ({ ...s, factoryAuditTentativeDate: v }))} />

          <Number label="X Pitch (in mm) if any special req" value={state.xPitchMm as any}
            onChange={(n) => setState(s => ({ ...s, xPitchMm: n }))} />

          <Number label="Tracker Details @790mm/1400mm" value={state.trackerDetails as any}
            onChange={(n) => setState(s => ({ ...s, trackerDetails: n }))} />

          <Select label="Priority" required value={state.priority}
            onChange={(v: any) => setState(s => ({ ...s, priority: v }))} options={["high","low"]} />

          <Textarea label="Remarks (optional)" value={state.remarks}
            onChange={(v) => setState(s => ({ ...s, remarks: v }))} />

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

        <div className="p-4 border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSubmit || creating} onClick={submit} className="bg-blue-600 hover:bg-blue-700">
            {creating ? "Saving…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Small field components                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const Text: React.FC<{ label:string; value:string; onChange:(v:string)=>void; required?:boolean }> = ({label,value,onChange,required}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}{required && " *"}</label>
    <input className="w-full border rounded px-3 py-2" value={value} onChange={e=>onChange(e.target.value)} />
  </div>
);

const Textarea: React.FC<{ label:string; value:string; onChange:(v:string)=>void }> = ({label,value,onChange}) => (
  <div className="md:col-span-2">
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <textarea className="w-full border rounded px-3 py-2 min-h-[96px]" value={value} onChange={e=>onChange(e.target.value)} />
  </div>
);

const Select: React.FC<{ label:string; value:string; onChange:(v:string)=>void; options:string[]; required?:boolean }> = ({label,value,onChange,options,required}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}{required && " *"}</label>
    <select className="w-full border rounded px-3 py-2" value={value} onChange={e=>onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const Number: React.FC<{ label:string; value:any; onChange:(n:number)=>void; required?:boolean }> = ({label,value,onChange,required}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}{required && " *"}</label>
    <input type="number" className="w-full border rounded px-3 py-2" value={value} onChange={e=>onChange(Number(e.target.value))} />
  </div>
);

const Decimal: React.FC<{ label:string; value:any; onChange:(n:number)=>void; required?:boolean }> = ({label,value,onChange,required}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}{required && " *"}</label>
    <input inputMode="decimal" className="w-full border rounded px-3 py-2" value={value} onChange={e=>onChange(Number(e.target.value))} />
  </div>
);

const DateSingle: React.FC<{ label:string; value:string; onChange:(v:string)=>void }> = ({label,value,onChange}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input type="date" className="w-full border rounded px-3 py-2" value={value} onChange={e=>onChange(e.target.value)} />
  </div>
);

const DateRange: React.FC<{ label:string; start:string; end:string; onChange:(s:string, e:string)=>void }> = ({label,start,end,onChange}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label} *</label>
    <div className="flex items-center gap-2">
      <input type="date" className="w-full border rounded px-3 py-2"
        value={start} onChange={e=>onChange(e.target.value, end)} />
      <span>→</span>
      <input type="date" className="w-full border rounded px-3 py-2"
        value={end} onChange={e=>onChange(start, e.target.value)} />
    </div>
  </div>
);

const File: React.FC<{ label:string; onChange:(f:File|null)=>void }> = ({label,onChange}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input type="file" className="w-full border rounded px-3 py-1.5"
      onChange={(e)=>onChange(e.target.files?.[0] || null)} />
  </div>
);

export default SalesRequestsPage;
