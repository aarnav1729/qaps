import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import EnhancedQAPModal from "../components/EnhancedQAPModal";
import QAPTable from "../components/QAPTable";
import { QAPFormData } from "@/types/qap";
import { useAuth } from "@/contexts/AuthContext";
import { getUserAccessibleQAPs } from "@/utils/workflowUtils";

interface IndexProps {
  qapData: QAPFormData[];
  onSave: (qapData: QAPFormData, status?: string) => void;
  onDelete: (id: string) => void;
}

const Index: React.FC<IndexProps> = ({ qapData, onSave, onDelete }) => {
  const { user } = useAuth();
  const [isQAPModalOpen, setIsQAPModalOpen] = useState(false);
  const [selectedQAP, setSelectedQAP] = useState<QAPFormData | null>(null);
  const [nextSno, setNextSno] = useState(1);

  /* ──────────────────────────────────────── */
  /* helpers                                  */
  /* ──────────────────────────────────────── */
  const isRequestor = user?.role === "requestor";

  // Requestor can edit only when QAP is still in creator's court
  const canEditSelected =
    user?.role === "requestor" &&
    (!selectedQAP || // new QAP
      user?.username === selectedQAP.submittedBy); // I’m the owner of this QAP

  // QAPs current user can see
  const accessibleQAPs = user ? getUserAccessibleQAPs(user, qapData) : [];
  const userQAPs = qapData.filter((q) => q.submittedBy === user?.username);

  /* ──────────────────────────────────────── */
  /* handlers                                 */
  /* ──────────────────────────────────────── */
  const handleCreateNew = () => {
    setSelectedQAP(null);
    setIsQAPModalOpen(true);
  };

  const handleEdit = (q: QAPFormData) => {
    setSelectedQAP(q);
    setIsQAPModalOpen(true);
  };

  // View always works; editing depends on canEditSelected inside modal
  const handleView = (q: QAPFormData) => {
    setSelectedQAP(q);
    setIsQAPModalOpen(true);
  };

  const handleShare = (q: QAPFormData) => {
    console.log("Sharing QAP:", q.id);
  };

  const handleSave = (q: QAPFormData, status?: string) => {
    // prevent accidental save attempts from non‑editable views
    if (!canEditSelected) {
      return;
    }
    onSave(q, status);
    setIsQAPModalOpen(false);
  };

  const handleDelete = (q: QAPFormData) => onDelete(q.id);

  /* ──────────────────────────────────────── */
  /* dashboard stats                          */
  /* ──────────────────────────────────────── */
  const stats = {
    total: accessibleQAPs.length,
    draft: accessibleQAPs.filter((q) => q.status === "draft").length,
    submitted: accessibleQAPs.filter(
      (q) => !["draft", "approved"].includes(q.status)
    ).length,
    approved: accessibleQAPs.filter((q) => q.status === "approved").length,
    inReview: accessibleQAPs.filter((q) =>
      ["level-2", "level-3", "level-4", "level-5"].includes(q.status)
    ).length,
    myQAPs: userQAPs.length,
  };

  const getDashboardTitle = () => {
    switch (user?.role) {
      case "admin":
        return "Admin Dashboard - All QAPs";
      case "plant-head":
        return "Plant Head Dashboard - All QAPs";
      case "technical-head":
        return "Technical Head Dashboard - All QAPs";
      case "head":
        return "Head Dashboard - Plant QAPs";
      case "production":
      case "quality":
      case "technical":
        return "Review Dashboard - Plant QAPs";
      default:
        return "QAP Management Dashboard";
    }
  };

  /* ──────────────────────────────────────── */
  /* render                                   */
  /* ──────────────────────────────────────── */
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* ─── title & subtitle ─── */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {getDashboardTitle()}
        </h1>
        <p className="text-gray-600">
          {isRequestor
            ? "Create and manage Quality Assurance Plans"
            : "Review and approve Quality Assurance Plans"}
        </p>
      </div>

      {/* ─── stats cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Draft</p>
                <p className="text-2xl font-bold">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">In Review</p>
                <p className="text-2xl font-bold">{stats.inReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-2xl font-bold">{stats.submitted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isRequestor && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">My QAPs</p>
                  <p className="text-2xl font-bold">{stats.myQAPs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── create new ─── */}
      {isRequestor && (
        <div className="mb-6">
          <Button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New QAP
          </Button>
        </div>
      )}

      {/* ─── QAP table ─── */}
      <Card>
        <CardHeader>
          <CardTitle>{isRequestor ? "Your QAPs" : "QAPs for Review"}</CardTitle>
        </CardHeader>
        <CardContent>
          <QAPTable
            qapData={accessibleQAPs}
            onEdit={handleEdit}
            onView={handleView}
            onShare={handleShare}
            onDelete={handleDelete}
            showActions={isRequestor}
          />
        </CardContent>
      </Card>

      {/* ─── modal (edit / view) ─── */}
      <EnhancedQAPModal
        isOpen={isQAPModalOpen}
        onClose={() => setIsQAPModalOpen(false)}
        editingQAP={selectedQAP}
        onSave={handleSave}
        nextSno={nextSno}
        /** 👉 The modal will hide “Save Draft / Next / Send for Review”
         *  whenever canEdit === false  */
        canEdit={canEditSelected}
        allowAssignL2={true}
      />
    </div>
  );
};

export default Index;
