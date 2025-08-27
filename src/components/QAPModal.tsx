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
import { QAPSpecification, QAPFormData } from "@/types/qap";
import {
  mqpSpecifications,
  visualElSpecifications,
} from "@/data/qapSpecifications";
import { useAuth } from "@/contexts/AuthContext";

const API = window.location.origin; // reuse your base

interface QAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (qapData: QAPFormData) => void;
  nextSno: number;
  editingQAP?: QAPFormData | null;
}

const QAPModal: React.FC<QAPModalProps> = ({
  isOpen,
  onClose,
  onSave,
  nextSno,
  editingQAP,
}) => {
  const { user } = useAuth();

  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [productType, setProductType] = useState("");
  const [plant, setPlant] = useState("");

  const [mqpData, setMqpData] = useState<QAPSpecification[]>([]);
  const [visualElData, setVisualElData] = useState<QAPSpecification[]>([]);

  const productOptions = [
    "Dual Glass M10 Perc",
    "Dual Glass M10 Topcon",
    "Dual Glass G12R Topcon",
    "Dual Glass G12 Topcon",
    "M10 Transparent Perc",
  ];
  const plantOptions = ["p2", "p4", "p5"];

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
    // expected format: customer_rfqMW_projectLocation_YYYYMMDD
    const [customer] = code.split("_");
    const prettyCustomer = customer.replace(/-/g, " "); // we slugged with '-'
    setCustomerName(prettyCustomer);
  }

  useEffect(() => {
    if (isOpen) {
      if (editingQAP) {
        setCustomerName(editingQAP.customerName);
        setProjectName(editingQAP.projectName);
        setOrderQuantity(editingQAP.orderQuantity);
        setProductType(editingQAP.productType);
        setPlant(editingQAP.plant);
        setMqpData(editingQAP.qaps.filter((q) => q.criteria === "MQP"));
        setVisualElData(
          editingQAP.qaps.filter(
            (q) => q.criteria === "Visual" || q.criteria === "EL"
          )
        );
      } else {
        resetForm();
        initializeQAPData();
      }
    }
  }, [isOpen, editingQAP, nextSno]);

  const initializeQAPData = () => {
    setMqpData(
      mqpSpecifications.map((spec, index) => ({
        ...spec,
        sno: nextSno + index,
        match: undefined,
        customerSpecification: undefined,
      }))
    );

    setVisualElData(
      visualElSpecifications.map((spec, index) => ({
        ...spec,
        sno: nextSno + mqpSpecifications.length + index,
        match: undefined,
        customerSpecification: undefined,
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

  const handleSave = (isDraft: boolean = true) => {
    const allData = [...mqpData, ...visualElData];
    const qapData: QAPFormData = {
      id: editingQAP?.id || Date.now().toString(),
      customerName,
      projectCode,
      projectName,
      orderQuantity,
      productType,
      plant,
      status: isDraft ? "draft" : "submitted",
      submittedBy: user?.username,
      submittedAt: isDraft ? undefined : new Date(),
      currentLevel: 1,
      levelResponses: {},
      timeline: isDraft
        ? []
        : [
            {
              level: 1,
              action: "Submitted by requestor",
              user: user?.username,
              timestamp: new Date(),
            },
          ],
      qaps: allData,
    };

    onSave(qapData);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setCustomerName("");
    setProjectName("");
    setOrderQuantity(0);
    setProductType("");
    setPlant("");
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <DialogTitle className="text-2xl font-bold">
            {editingQAP ? "Edit QAP" : "New QAP"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 bg-blue-50 p-4 rounded-lg">
            <div className="space-y-2">
              <Label>Customer Name (auto)</Label>
              <Input value={customerName} readOnly />
            </div>

            <div className="space-y-2">
              <Label>Project Code *</Label>
              <Select value={projectCode} onValueChange={onPickProjectCode}>
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

          {/* Tabs for MQP and Visual/EL */}
          <Tabs defaultValue="mqp" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="mqp">MQP ({mqpData.length})</TabsTrigger>
              <TabsTrigger value="visual-el">
                Visual & EL ({visualElData.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mqp">{renderMQPTable()}</TabsContent>

            <TabsContent value="visual-el">{renderVisualElTable()}</TabsContent>
          </Tabs>
        </div>

        <div className="p-6 pt-0 border-t bg-gray-50">
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={() => handleSave(true)} variant="outline">
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QAPModal;
