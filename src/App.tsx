// src/App.tsx
import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Navigation from "./components/Navigation";
import LoginPage from "./components/LoginPage";
import Index from "./pages/Index";
import QAPViewEditPage from "./pages/QAPViewEditPage";
import Level2ReviewPage from "./components/Level2ReviewPage";
import Level3ReviewPage from "./components/Level3ReviewPage";
import Level4ReviewPage from "./components/Level4ReviewPage";
import FinalCommentsPage from "./components/FinalCommentsPage";
import Level5ApprovalPage from "./components/Level5ApprovalPage";
import SpecificationBuilder from "./components/SpecificationBuilder";
import ApprovalsPage from "./components/ApprovalsPage";
import AnalyticsPage from "./components/AnalyticsPage";
import AdminPage from "./components/AdminPage";
import AdminAnalytics from "./components/AdminAnalytics";
import { QAPFormData } from "./types/qap";
import { processWorkflowTransition } from "./utils/workflowUtils";

const API = window.location.origin;
const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  // ─── Fetch all QAPs ─────────────────────────────────────────────────────────
  const {
    data: qapData = [],
    isLoading: qapsLoading,
    refetch: refetchQaps,
  } = useQuery<QAPFormData[]>({
    queryKey: ["qaps"],
    queryFn: () =>
      fetch(`${API}/api/qaps`, { credentials: "include" }).then(
        (r) => {
          if (!r.ok) throw new Error("Failed to fetch QAPs");
          return r.json();
        }
      ),
  });

  // ─── CRUD mutations ─────────────────────────────────────────────────────
  const createQAP = useMutation<QAPFormData, Error, QAPFormData>({
    mutationFn: async (newQap) => {
      const res = await fetch(`${API}/api/qaps`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQap),
      });
      if (!res.ok) throw new Error("Failed to create QAP");
      return res.json();
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  const updateQAP = useMutation<void, Error, QAPFormData>({
    mutationFn: async (updated) => {
      const res = await fetch(`${API}/api/qaps/${updated.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to update QAP");
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  const deleteQAP = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`${API}/api/qaps/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete QAP");
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  // ─── reviewer mutations ──────────────────────────────────────────────────
  const level2Response = useMutation<
    void,
    Error,
    { qapId: string; comments: Record<number, string> }
  >({
    mutationFn: async ({ qapId, comments }) => {
      const res = await fetch(
        `${API}/api/qaps/${qapId}/responses`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: 2, comments }),
        }
      );
      if (!res.ok) throw new Error("Failed to submit level-2 review");
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  const level3Response = useMutation<
    void,
    Error,
    { qapId: string; comments: Record<number, string> }
  >({
    mutationFn: async ({ qapId, comments }) => {
      const res = await fetch(
        `${API}/api/qaps/${qapId}/responses`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: 3, comments }),
        }
      );
      if (!res.ok) throw new Error("Failed to submit level-3 review");
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  const level4Response = useMutation<
    void,
    Error,
    { qapId: string; comments: Record<number, string> }
  >({
    mutationFn: async ({ qapId, comments }) => {
      const res = await fetch(
        `${API}/api/qaps/${qapId}/responses`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: 4, comments }),
        }
      );
      if (!res.ok) throw new Error("Failed to submit level-4 review");
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  // ─── Plant-Head Approve / Reject Mutations ────────────────────────────────
  const approveQAP = useMutation<
    void,
    Error,
    { id: string; feedback?: string }
  >({
    mutationFn: async ({ id, feedback }) => {
      const res = await fetch(`${API}/api/qaps/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) throw new Error("Failed to approve QAP");
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  const rejectQAP = useMutation<void, Error, { id: string; reason: string }>({
    mutationFn: async ({ id, reason }) => {
      const res = await fetch(`${API}/api/qaps/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to reject QAP");
    },
    onSuccess: () => {
      refetchQaps();
    },
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const addTimestampToQAP = (
    qap: QAPFormData,
    action: string,
    level?: number
  ): QAPFormData => {
    const now = new Date();
    const updated: QAPFormData = {
      ...qap,
      lastModifiedAt: now,
      timeline: [
        ...(qap.timeline || []),
        {
          level: level ?? qap.currentLevel,
          action,
          user: user?.username,
          timestamp: now,
        },
      ],
      levelStartTimes: { ...(qap.levelStartTimes || {}) },
      levelEndTimes: { ...(qap.levelEndTimes || {}) },
    };
    if (action.includes("Sent to") && level) {
      updated.levelStartTimes[level] = now;
    } else if (action.includes("Reviewed") || action.includes("Approved")) {
      updated.levelEndTimes[qap.currentLevel] = now;
    }
    return updated;
  };

  // ─── CRUD HANDLERS ─────────────────────────────────────────────────────────
  const handleSaveQAP = (q: QAPFormData) => {
    if (q.id) updateQAP.mutate(q);
    else createQAP.mutate(q);
  };

  const handleDeleteQAP = (id: string) => {
    deleteQAP.mutate(id);
  };

  // ─── REVIEW HANDLERS ───────────────────────────────────────────────────────
  const handleLevel2Next = (
    qapId: string,
    role: string,
    responses: { [itemIndex: number]: string }
  ) => {
    level2Response.mutate({ qapId, comments: responses });
  };

  const handleLevel3Next = (
    qapId: string,
    responses: { [itemIndex: number]: string }
  ) => {
    level3Response.mutate({ qapId, comments: responses });
  };

  const handleLevel4Next = (
    qapId: string,
    responses: { [itemIndex: number]: string }
  ) => {
    level4Response.mutate({ qapId, comments: responses });
  };

  const handleSubmitFinalComments = async (
    qapId: string,
    comments: string,
    attachment?: File
  ) => {
    const form = new FormData();
    form.append("comments", comments);
    if (attachment) form.append("attachment", attachment);

    const res = await fetch(
      `${API}/api/qaps/${qapId}/final-comments`,
      {
        method: "POST",
        credentials: "include",
        body: form,
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to save final comments");
    }
    // once successful, re-load QAPs
    refetchQaps();
  };

  // ─── Plant-Head Handlers ───────────────────────────────────────────────────
  const handleLevel5Approve = (qapId: string, feedback?: string) => {
    approveQAP.mutate({ id: qapId, feedback });
  };

  const handleLevel5Reject = (qapId: string, reason: string) => {
    rejectQAP.mutate({ id: qapId, reason });
  };

  const handleViewQAP = (qap: QAPFormData) => {
    console.log("Viewing QAP:", qap);
  };

  // ─── Admin users remain in local state ──────────────────────────────────────
  const [users, setUsers] = useState<any[]>([]);
  const handleAddUser = (u: any) =>
    setUsers((prev) => [...prev, { ...u, id: u.id || Date.now().toString() }]);
  const handleEditUser = (u: any) =>
    setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
  const handleDeleteUser = (id: string) =>
    setUsers((prev) => prev.filter((x) => x.id !== id));

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!isAuthenticated) return <LoginPage />;
  if (qapsLoading) return <div>Loading QAPs…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="pt-4">
        <Routes>
          <Route
            path="/"
            element={
              <Index
                qapData={qapData}
                onSave={handleSaveQAP}
                onDelete={handleDeleteQAP}
              />
            }
          />

          <Route
            path="/qap/:id"
            element={
              <QAPViewEditPage qapData={qapData} onSave={handleSaveQAP} />
            }
          />

          {(user?.role === "production" ||
            user?.role === "quality" ||
            user?.role === "technical" ||
            user?.role === "admin") && (
            <Route
              path="/level2-review"
              element={
                <Level2ReviewPage qapData={qapData} onNext={handleLevel2Next} />
              }
            />
          )}

          {(user?.role === "head" || user?.role === "admin") && (
            <Route
              path="/level3-review"
              element={
                <Level3ReviewPage qapData={qapData} onNext={handleLevel3Next} />
              }
            />
          )}

          {(user?.role === "technical-head" || user?.role === "admin") && (
            <Route
              path="/level4-review"
              element={
                <Level4ReviewPage qapData={qapData} onNext={handleLevel4Next} />
              }
            />
          )}

          {(user?.role === "requestor" || user?.role === "admin") && (
            <Route
              path="/final-comments"
              element={
                <FinalCommentsPage
                  qapData={qapData}
                  onSubmitFinalComments={handleSubmitFinalComments}
                />
              }
            />
          )}

          {(user?.role === "plant-head" || user?.role === "admin") && (
            <Route
              path="/level5-approval"
              element={
                <Level5ApprovalPage
                  qapData={qapData}
                  onApprove={handleLevel5Approve}
                  onReject={handleLevel5Reject}
                />
              }
            />
          )}

          {(user?.role === "requestor" || user?.role === "admin") && (
            <Route path="/spec-builder" element={<SpecificationBuilder />} />
          )}

          <Route
            path="/analytics"
            element={<AnalyticsPage qapData={qapData} />}
          />

          {user?.role === "admin" && (
            <Route
              path="/admin-analytics"
              element={<AdminAnalytics qapData={qapData} />}
            />
          )}

          {(user?.role === "plant-head" || user?.role === "admin") && (
            <Route
              path="/approvals"
              element={
                <ApprovalsPage
                  qapData={qapData}
                  onApprove={handleLevel5Approve}
                  onReject={handleLevel5Reject}
                  onView={handleViewQAP}
                />
              }
            />
          )}

          {user?.role === "admin" && (
            <Route
              path="/admin"
              element={
                <AdminPage
                  qapData={qapData}
                  users={users}
                  onAddUser={handleAddUser}
                  onEditUser={handleEditUser}
                  onDeleteUser={handleDeleteUser}
                />
              }
            />
          )}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
