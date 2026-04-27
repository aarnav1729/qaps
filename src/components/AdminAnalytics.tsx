import React from "react";
import { QAPFormData } from "@/types/qap";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

interface AdminAnalyticsProps {
  qapData: QAPFormData[];
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ qapData }) => (
  <AnalyticsDashboard
    qapData={qapData}
    forceAdminInsights
    defaultTab="tat"
    title="Managing Director Analytics"
    description="Executive workflow visibility with drill-down charts, raw dataset visibility, and individual turnaround time across the full approval loop."
  />
);

export default AdminAnalytics;
