import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QAPFormData } from "@/types/qap";
import { Eye, Edit, Trash2, Share, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel1Summary, isAgreed } from "@/lib/qapLevel1";
import { qapRequiresLevel2Role } from "@/utils/workflowUtils";

const API = window.location.origin;

// Minimal shape we need from Sales Requests
type SalesRequestLite = {
  id: string;
  projectCode?: string | null;
  productCategory?: string | null;
  moduleCellType?: string | null;
  cellTech?: string | null;
  cutCells?: string | null;
};

interface QAPTableProps {
  qapData: QAPFormData[];
  onView?: (qap: QAPFormData) => void;
  onEdit?: (qap: QAPFormData) => void;
  onDelete: (qap: QAPFormData) => void;
  onShare: (qap: QAPFormData) => void;
  showActions?: boolean;
}

const QAPTable: React.FC<QAPTableProps> = ({
  qapData = [] as QAPFormData[],
  onView,
  onEdit,
  onDelete,
  onShare,
  showActions = true,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ---- SAFETY: normalize incoming data so render never crashes ----
  const safeQapData: QAPFormData[] = Array.isArray(qapData) ? qapData : [];

  const toStr = (v: any) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    // handle { label, value } style objects safely
    if (typeof v === "object") {
      if (typeof (v as any).label === "string") return (v as any).label;
      if (typeof (v as any).value === "string") return (v as any).value;
      try {
        return String(v);
      } catch {
        return "";
      }
    }
    return String(v);
  };

  // ---------------------------------------------------------------------------
  // Fetch Sales Requests for resolving Product Category when QAP doesn't carry it
  // ---------------------------------------------------------------------------
  const { data: salesReqList = [] } = useQuery<SalesRequestLite[]>({
    queryKey: ["sales-requests-lite-for-qap-table"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sales-requests`, {
        credentials: "include",
      });
      if (!r.ok) {
        // Soft-fail: table should still render even if SR API doesn't exist here
        return [];
      }
      const json = await r.json();
      if (!Array.isArray(json)) return [];
      return json.map((x: any) => ({
        id: toStr(x?.id),
        projectCode: toStr(x?.projectCode) || null,
        productCategory:
          toStr(x?.productCategory ?? x?.product_category) || null,
        moduleCellType: toStr(x?.moduleCellType) || null,
        cellTech: toStr(x?.cellTech) || null,
        cutCells: toStr(x?.cutCells) || null,
      }));
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const salesReqById = useMemo(() => {
    const m = new Map<string, SalesRequestLite>();
    for (const sr of salesReqList) {
      if (sr?.id) m.set(sr.id, sr);
    }
    return m;
  }, [salesReqList]);

  const salesReqByProjectCode = useMemo(() => {
    const m = new Map<string, SalesRequestLite>();
    for (const sr of salesReqList) {
      const pc = toStr(sr?.projectCode).trim();
      if (pc) m.set(pc, sr);
    }
    return m;
  }, [salesReqList]);

  const buildCompositeProductLabel = (obj: any) => {
    const cellTech = toStr(obj?.cellTech).trim();
    const moduleCellType = toStr(obj?.moduleCellType).trim();
    const cutCells = toStr(obj?.cutCells).trim();

    const parts = [cellTech, moduleCellType, cutCells && `${cutCells} cells`]
      .filter(Boolean)
      .join(" · ");

    return parts || "";
  };

  /**
   * Product Type must be taken from Product Category.
   * Strategy:
   * 1) Try to find productCategory directly on QAP in many plausible shapes.
   * 2) If missing, try linked Sales Request by salesRequestId / projectCode.
   * 3) If still missing, show composite from moduleCellType/cellTech/cutCells.
   * 4) Finally fallback to legacy productType.
   */
  const resolveProductType = (qap: QAPFormData) => {
    const anyQ = qap as any;

    const categoryCandidate =
      // most likely
      anyQ.productCategory ??
      anyQ.product_category ??
      anyQ.productCategoryLabel ??
      anyQ?.salesRequest?.productCategory ??
      anyQ?.salesRequest?.product_category ??
      anyQ?.salesRequestData?.productCategory ??
      anyQ?.salesRequestData?.product_category ??
      anyQ?.salesRequestSnapshot?.productCategory ??
      anyQ?.salesRequestSnapshot?.product_category ??
      anyQ?.request?.productCategory ??
      anyQ?.specs?.productCategory ??
      anyQ?.specs?.product_category ??
      // sometimes stored inside "bom" or "meta"
      anyQ?.bom?.productCategory ??
      anyQ?.meta?.productCategory;

    const category = toStr(categoryCandidate).trim();
    if (category) return category;

    // Try to resolve from Sales Request if QAP references it
    const srId = toStr(
      anyQ.salesRequestId ??
        anyQ.sales_request_id ??
        anyQ.salesRequestID ??
        anyQ?.salesRequest?.id ??
        anyQ?.requestId
    ).trim();

    const projectCode = toStr(anyQ.projectCode ?? anyQ.project_code).trim();

    const sr =
      (srId && salesReqById.get(srId)) ||
      (projectCode && salesReqByProjectCode.get(projectCode));

    const srCategory = toStr(sr?.productCategory).trim();
    if (srCategory) return srCategory;

    // Try composite fallback from QAP itself or Sales Request
    const composite =
      buildCompositeProductLabel(anyQ) || buildCompositeProductLabel(sr);
    if (composite) return composite;

    // Legacy fallback
    const legacy = toStr(anyQ.productType ?? anyQ.product_type).trim();
    if (legacy) return legacy;

    return "-";
  };

  if (safeQapData.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="p-12 text-center">
          <div className="text-gray-500 text-lg">
            {user?.role === "requestor"
              ? 'No QAPs found. Click "+ New QAP" to get started!'
              : "No QAPs available for review at this time."}
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleView = (qap: QAPFormData) => {
    if (onView) onView(qap);
    else navigate(`/qap/${qap.id}`);
  };

  const handleEdit = (qap: QAPFormData) => {
    if (onEdit) onEdit(qap);
    else navigate(`/qap/${qap.id}`);
  };

  const handleDelete = (qap: QAPFormData) => {
    onDelete(qap);
  };

  // Requestor can edit their own QAP at all times (regardless of status)
  const canEdit = (qap: QAPFormData) =>
    user?.role === "requestor" && user?.username === qap.submittedBy;

  const canDelete = (qap: QAPFormData) =>
    user?.username === qap.submittedBy && qap.status === "draft";

  const getActionButton = (qap: QAPFormData) => {
    const plantRaw = user?.plant || "";
    const userPlants = plantRaw
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    const qapPlant = String((qap as any)?.plant ?? "")
      .trim()
      .toLowerCase();

    const allowedPlant = plantRaw === "" || userPlants.includes(qapPlant);

    switch (user?.role) {
      case "level-1-reviewer":
        if (qap.currentLevel === 1 && qap.status === "level-1") {
          return (
            <Button
              onClick={() => navigate("/level1-review")}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Review
            </Button>
          );
        }
        break;

      case "production":
      case "quality":
      case "technical":
        if (
          qap.currentLevel === 2 &&
          String(qap.status || "").toLowerCase() === "level-2" &&
          allowedPlant &&
          qapRequiresLevel2Role(qap, user?.role)
        ) {
          return (
            <Button
              onClick={() => navigate("/level2-review")}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Review
            </Button>
          );
        }
        break;

      case "head":
        if (qap.currentLevel === 3 && allowedPlant) {
          return (
            <Button
              onClick={() => navigate("/level3-review")}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Review
            </Button>
          );
        }
        break;

      case "technical-head":
        if (qap.currentLevel === 4 && allowedPlant) {
          return (
            <Button
              onClick={() => navigate("/level4-review")}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Review
            </Button>
          );
        }
        break;

      case "plant-head":
        if (qap.status === "level-5" && allowedPlant) {
          return (
            <Button
              onClick={() => navigate("/level5-approval")}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Approve
            </Button>
          );
        }
        break;

      case "requestor":
        if (
          qap.status === "final-comments" &&
          qap.submittedBy === user.username
        ) {
          return (
            <Button
              onClick={() => navigate("/final-comments")}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Add Comments
            </Button>
          );
        }
        break;
    }

    return null;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      submitted: "bg-yellow-100 text-yellow-800",
      "level-1": "bg-amber-100 text-amber-900",
      "level-2": "bg-orange-100 text-orange-800",
      "level-3": "bg-purple-100 text-purple-800",
      "level-4": "bg-indigo-100 text-indigo-800",
      "final-comments": "bg-blue-100 text-blue-800",
      "level-5": "bg-green-100 text-green-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      "edit-requested": "bg-orange-100 text-orange-800",
    } as const;

    const safe = String(status || "");

    return (
      <Badge
        className={`${
          colors[safe as keyof typeof colors] || "bg-gray-100 text-gray-800"
        } capitalize`}
      >
        {safe.replace("-", " ")}
      </Badge>
    );
  };

  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          QAPs ({safeQapData.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Customer
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Project
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Plant
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Product Type
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Quantity
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Items
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Status
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">
                  Submitted
                </th>
                <th className="p-3 text-center text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {safeQapData.map((qap) => {
                const anyQ = qap as any;

                const mqp = anyQ?.specs?.mqp ?? [];
                const visual = anyQ?.specs?.visual ?? [];
                const legacy = Array.isArray(anyQ?.qaps) ? anyQ.qaps : [];
                const items = legacy.length ? legacy : [...mqp, ...visual];

                const matchedItems = items.filter(
                  (i: any) => i.match === "yes"
                ).length;
                const agreedItems = items.filter((i: any) =>
                  isAgreed(i.match)
                ).length;
                const unmatchedItems = items.filter(
                  (i: any) => i.match === "no"
                ).length;
                const level1Summary = getLevel1Summary(
                  qap as Pick<QAPFormData, "level1Summary" | "specs">
                );

                const productTypeLabel = resolveProductType(qap);

                return (
                  <tr
                    key={qap.id}
                    className="border-b hover:bg-gray-50 transition-colors duration-200"
                  >
                    <td className="p-3 text-sm border-r border-gray-200 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                          {String(qap.customerName || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        {qap.customerName || "-"}
                      </div>
                    </td>

                    <td className="p-3 text-sm border-r border-gray-200">
                      {qap.projectName || "-"}
                    </td>

                    <td className="p-3 text-sm border-r border-gray-200">
                      <Badge
                        variant="outline"
                        className="bg-purple-50 text-purple-700"
                      >
                        {String((qap as any)?.plant || "-").toUpperCase()}
                      </Badge>
                    </td>

                    <td className="p-3 text-sm border-r border-gray-200">
                      <Badge
                        variant="outline"
                        className="bg-indigo-50 text-indigo-700"
                        title={productTypeLabel}
                      >
                        {productTypeLabel}
                      </Badge>
                    </td>

                    <td className="p-3 text-sm border-r border-gray-200">
                      {Number(
                        (qap as any)?.orderQuantity ?? 0
                      ).toLocaleString()}
                    </td>

                    <td className="p-3 text-sm border-r border-gray-200">
                      <div className="flex flex-col text-xs">
                        <span className="text-green-600">
                          ✓ {matchedItems} matched
                        </span>
                        {agreedItems > 0 && (
                          <span className="text-amber-700">
                            ≈ {agreedItems} agreed
                          </span>
                        )}
                        <span className="text-red-600">
                          ✗ {unmatchedItems} unmatched
                        </span>
                        {level1Summary.totalReviewed > 0 && (
                          <span className="text-amber-700">
                            L1 closed: {level1Summary.closed}/
                            {level1Summary.totalReviewed}
                          </span>
                        )}
                        <span className="text-gray-500">
                          Total: {items.length}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 text-sm border-r border-gray-200">
                      {getStatusBadge(qap.status)}
                    </td>

                    <td className="p-3 text-sm border-r border-gray-200 text-gray-600">
                      {qap.submittedAt
                        ? new Date(qap.submittedAt).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getActionButton(qap)}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(qap)}
                          className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                          title="View QAP"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {canEdit(qap) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(qap)}
                            className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
                            title="Edit QAP"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}

                        {showActions && canDelete(qap) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                                title="Delete QAP"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete QAP</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this QAP for “
                                  {qap.customerName} - {qap.projectName}”? This
                                  action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(qap)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        {showActions &&
                          qap.status !== "draft" &&
                          qap.submittedBy === user?.username && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onShare(qap)}
                              className="h-8 w-8 p-0 hover:bg-purple-100 hover:text-purple-600"
                              title="Share QAP"
                            >
                              <Share className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default QAPTable;
