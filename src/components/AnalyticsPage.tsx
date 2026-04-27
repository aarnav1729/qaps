import React from "react";
import { QAPFormData } from "@/types/qap";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

interface AnalyticsPageProps {
  qapData: QAPFormData[];
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ qapData }) => (
  <AnalyticsDashboard
    qapData={qapData}
    title="Analytics Dashboard"
    description="Detailed workflow, quality, and drill-down analytics for the currently visible QAP portfolio."
  />
);

export default AnalyticsPage;
