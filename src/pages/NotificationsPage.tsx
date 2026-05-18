import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getQapCommentEvents } from "@/lib/qapAudit";
import { formatRoleLabel } from "@/lib/roles";
import type { QAPFormData, UserRole } from "@/types/qap";
import { qapRequiresLevel2Role } from "@/utils/workflowUtils";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageSquare,
} from "lucide-react";

interface NotificationsPageProps {
  qapData: QAPFormData[];
}

type NotificationKind = "action" | "status" | "comment";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  qap: QAPFormData;
  title: string;
  detail: string;
  when?: string | Date | null;
  audience: string;
  route: string;
};

const roleRoute: Partial<Record<UserRole, string>> = {
  "level-1-reviewer": "/level1-review",
  production: "/level2-review",
  quality: "/level2-review",
  technical: "/level2-review",
  head: "/level3-review",
  "technical-head": "/level4-review",
  "plant-head": "/level5-approval",
  requestor: "/final-comments",
};

const dashboardRouteForRole = (role?: UserRole | null) => {
  if (role === "admin") return "/approvals";
  if (role === "sales") return "/customers";
  return "/";
};

const ageLabel = (value?: string | Date | null) => {
  if (!value) return "No timestamp";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "No timestamp";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

const pendingRolesForQap = (qap: QAPFormData): UserRole[] => {
  const status = String(qap.status || "").toLowerCase();
  if (status === "level-1" && qap.currentLevel === 1) return ["level-1-reviewer"];
  if (status === "level-2" && qap.currentLevel === 2) {
    return (["production", "quality", "technical"] as UserRole[]).filter((role) =>
      qapRequiresLevel2Role(qap, role)
    );
  }
  if (["level-3", "level-3b"].includes(status) && qap.currentLevel === 3) {
    return ["head"];
  }
  if (["level-4", "level-4b"].includes(status) && qap.currentLevel === 4) {
    return ["technical-head"];
  }
  if (status === "level-5" && qap.currentLevel === 5) return ["plant-head"];
  if (status === "final-comments") return ["requestor"];
  return [];
};

const NotificationsPage: React.FC<NotificationsPageProps> = ({ qapData }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const username = String(user?.username || "");

  const notifications = useMemo<NotificationItem[]>(() => {
    const qaps = Array.isArray(qapData) ? qapData : [];
    const items: NotificationItem[] = [];

    qaps.forEach((qap) => {
      const pendingRoles = pendingRolesForQap(qap);
      pendingRoles.forEach((role) => {
        if (!isAdmin && role !== user?.role) return;
        if (
          role === "requestor" &&
          !isAdmin &&
          qap.submittedBy !== username
        ) {
          return;
        }
        items.push({
          id: `${qap.id}-pending-${role}`,
          kind: "action",
          qap,
          title: `${formatRoleLabel(role)} action pending`,
          detail: `${qap.customerName || "-"} / ${qap.projectName || "-"} is waiting at ${String(qap.status || "").replace("-", " ")}.`,
          when: qap.lastModifiedAt || qap.submittedAt || qap.createdAt,
          audience: formatRoleLabel(role),
          route: roleRoute[role] || `/qap/${qap.id}`,
        });
      });

      const status = String(qap.status || "").toLowerCase();
      const ownerVisible = isAdmin || qap.submittedBy === username;
      if (ownerVisible && ["approved", "rejected"].includes(status)) {
        items.push({
          id: `${qap.id}-${status}`,
          kind: "status",
          qap,
          title: status === "approved" ? "QAP approved" : "QAP rejected",
          detail: `${qap.customerName || "-"} / ${qap.projectName || "-"} was ${status}.`,
          when: qap.approvedAt || qap.lastModifiedAt,
          audience: qap.submittedBy || "Requestor",
          route: isAdmin ? "/approvals" : dashboardRouteForRole(user?.role),
        });
      }

      getQapCommentEvents(qap).forEach((event) => {
        const visible =
          isAdmin ||
          event.actor === username ||
          qap.submittedBy === username ||
          event.role === user?.role;
        if (!visible) return;
        items.push({
          id: `${event.id}-notification`,
          kind: "comment",
          qap,
          title: `Comment from ${event.actor}`,
          detail: `${event.stage}: ${event.comment}`,
          when: event.timestamp,
          audience: event.role ? formatRoleLabel(event.role) : "Workflow",
          route: dashboardRouteForRole(user?.role),
        });
      });
    });

    return items.sort(
      (a, b) =>
        new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime()
    );
  }, [isAdmin, qapData, user?.role, username]);

  const counts = {
    action: notifications.filter((n) => n.kind === "action").length,
    status: notifications.filter((n) => n.kind === "status").length,
    comment: notifications.filter((n) => n.kind === "comment").length,
  };

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-blue-700">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {isAdmin ? "All Workflow Notifications" : "My Notifications"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Action items, status changes, and comments from the QAP workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryBadge icon={Clock3} label="Actions" value={counts.action} />
          <SummaryBadge icon={CheckCircle2} label="Status" value={counts.status} />
          <SummaryBadge icon={MessageSquare} label="Comments" value={counts.comment} />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            {notifications.length} notification{notifications.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-slate-500">
              No notifications right now.
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex flex-col gap-3 rounded-md border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        notification.kind === "action"
                          ? "bg-amber-100 text-amber-900"
                          : notification.kind === "status"
                          ? "bg-green-100 text-green-900"
                          : "bg-blue-100 text-blue-900"
                      }
                    >
                      {notification.kind}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {ageLabel(notification.when)} · {notification.audience}
                    </span>
                  </div>
                  <div className="mt-2 font-medium text-slate-950">
                    {notification.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {notification.detail}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(notification.route)}
                >
                  Open
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryBadge: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}> = ({ icon: Icon, label, value }) => (
  <div className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
    <Icon className="h-4 w-4 text-blue-700" />
    <span className="text-slate-600">{label}</span>
    <span className="font-semibold text-slate-950">{value}</span>
  </div>
);

export default NotificationsPage;
