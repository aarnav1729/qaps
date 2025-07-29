import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { QAPFormData } from "@/types/qap";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, Search, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Level4ReviewPageProps {
  qapData: QAPFormData[];
  onNext: (id: string, responses: { [itemIndex: number]: string }) => void;
}

const Level4ReviewPage: React.FC<Level4ReviewPageProps> = ({
  qapData,
  onNext,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQAP, setSelectedQAP] = useState<QAPFormData | null>(null);
  const [comments, setComments] = useState<{ [itemIndex: number]: string }>({});
  const [acknowledged, setAcknowledged] = useState<{
    [itemIndex: number]: boolean;
  }>({});
  const [showGreenSpecs, setShowGreenSpecs] = useState(false);

  const filteredQAPs = useMemo(() => {
    return qapData.filter((qap) => {
      if (qap.status !== "level-4") return false;

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          qap.customerName.toLowerCase().includes(searchLower) ||
          qap.projectName.toLowerCase().includes(searchLower) ||
          qap.submittedBy?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [qapData, searchTerm]);

  const handleQAPSelect = (qap: QAPFormData) => {
    setSelectedQAP(qap);
    setComments({});
    setAcknowledged({});
  };

  const handleCommentChange = (itemIndex: number, comment: string) => {
    setComments((prev) => ({
      ...prev,
      [itemIndex]: comment,
    }));
  };

  const handleAcknowledge = (itemIndex: number) => {
    setAcknowledged((prev) => ({
      ...prev,
      [itemIndex]: !prev[itemIndex],
    }));
  };

  const handleNext = () => {
    if (!selectedQAP) return;
    onNext(selectedQAP.id, comments);
    setSelectedQAP(null);
    setComments({});
    setAcknowledged({});
  };

  const getUnmatchedItems = () => {
    if (!selectedQAP) return [];
    return selectedQAP.qaps.filter((item) => item.match === "no");
  };

  const getMatchedItems = () => {
    if (!selectedQAP) return [];
    return selectedQAP.qaps.filter((item) => item.match === "yes");
  };

  const canProceed = () => {
    const unmatchedItems = getUnmatchedItems();
    return unmatchedItems.every((_, index) => acknowledged[index]);
  };

  if (selectedQAP) {
    const unmatchedItems = getUnmatchedItems();
    const matchedItems = getMatchedItems();

    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Technical Head Review - Level 4
          </h1>
          <p className="text-gray-600">
            Review specifications with all previous comments
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>QAP Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Customer
                </label>
                <p className="font-semibold">{selectedQAP.customerName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Project
                </label>
                <p className="font-semibold">{selectedQAP.projectName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Plant
                </label>
                <Badge>{selectedQAP.plant.toUpperCase()}</Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Status
                </label>
                <Badge variant="secondary">{selectedQAP.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unmatched Items as Table with Level 2 & Level 3 Comments */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-red-600">
              Unmatched Specifications ({unmatchedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2">S.No</th>
                    <th className="border border-gray-300 p-2">Criteria</th>
                    <th className="border border-gray-300 p-2">Premier Spec</th>
                    <th className="border border-gray-300 p-2">
                      Customer Spec
                    </th>

                    {/* Level 2 comment columns */}
                    {Object.keys(selectedQAP.levelResponses[2] || {}).map(
                      (role) => (
                        <th
                          key={`l2-${role}`}
                          className="border border-gray-300 p-2 capitalize"
                        >
                          {role} (L2)
                        </th>
                      )
                    )}

                    {/* Level 3 comment columns */}
                    {Object.keys(selectedQAP.levelResponses[3] || {}).map(
                      (role) => (
                        <th
                          key={`l3-${role}`}
                          className="border border-gray-300 p-2 capitalize"
                        >
                          {role} (L3)
                        </th>
                      )
                    )}

                    <th className="border border-gray-300 p-2">Your Comment</th>
                    <th className="border border-gray-300 p-2">Acknowledge</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedItems.map((item, idx) => (
                    <tr key={item.sno} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center">
                        {item.sno}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {item.criteria}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {item.specification || item.criteriaLimits}
                      </td>
                      <td className="border border-gray-300 p-2 text-red-700 font-medium">
                        {item.customerSpecification}
                      </td>

                      {/* Show each Level 2 comment */}
                      {Object.entries(selectedQAP.levelResponses[2] || {}).map(
                        ([role, resp]) => (
                          <td
                            key={`l2-${role}-${item.sno}`}
                            className="border border-gray-300 p-2"
                          >
                            {resp.comments[idx] || "–"}
                          </td>
                        )
                      )}

                      {/* Show each Level 3 comment */}
                      {Object.entries(selectedQAP.levelResponses[3] || {}).map(
                        ([role, resp]) => (
                          <td
                            key={`l3-${role}-${item.sno}`}
                            className="border border-gray-300 p-2"
                          >
                            {resp.comments[idx] || "–"}
                          </td>
                        )
                      )}

                      {/* Technical Head comment input */}
                      <td className="border border-gray-300 p-2">
                        <Textarea
                          value={comments[idx] || ""}
                          onChange={(e) =>
                            handleCommentChange(idx, e.target.value)
                          }
                          placeholder="Add your comment…"
                          className="min-h-[60px] w-full"
                        />
                      </td>

                      {/* Acknowledge checkbox */}
                      <td className="border border-gray-300 p-2 text-center">
                        <input
                          type="checkbox"
                          checked={acknowledged[idx] || false}
                          onChange={() => handleAcknowledge(idx)}
                          className="rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Matched Items (Collapsible) */}
        <Collapsible open={showGreenSpecs} onOpenChange={setShowGreenSpecs}>
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-green-600">
                    Matched Specifications ({matchedItems.length})
                  </CardTitle>
                  {showGreenSpecs ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </CardHeader>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-3">
                  {matchedItems.map((item) => (
                    <div
                      key={item.sno}
                      className="border border-green-200 rounded-lg p-3 bg-green-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="default">S.No: {item.sno}</Badge>
                        <Badge variant="outline">{item.criteria}</Badge>
                      </div>
                      <h4 className="font-medium">{item.subCriteria}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Specification:{" "}
                        {item.specification || item.criteriaLimits}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <Button onClick={() => setSelectedQAP(null)} variant="outline">
            Back to List
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Send to Requestor for Final Comments
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Technical Head Review - Level 4
        </h1>
        <p className="text-gray-600">
          Review QAPs from Level 3 and provide technical feedback
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>QAPs Pending Review ({filteredQAPs.length})</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search QAPs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredQAPs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No QAPs pending review
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-3 text-left">
                      Customer
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Project
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Plant
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Submitted By
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Status
                    </th>
                    <th className="border border-gray-300 p-3 text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQAPs.map((qap) => (
                    <tr key={qap.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-3">
                        {qap.customerName}
                      </td>
                      <td className="border border-gray-300 p-3">
                        {qap.projectName}
                      </td>
                      <td className="border border-gray-300 p-3">
                        <Badge>{qap.plant.toUpperCase()}</Badge>
                      </td>
                      <td className="border border-gray-300 p-3">
                        {qap.submittedBy}
                      </td>
                      <td className="border border-gray-300 p-3">
                        <Badge variant="secondary">{qap.status}</Badge>
                      </td>
                      <td className="border border-gray-300 p-3 text-center">
                        <Button
                          onClick={() => handleQAPSelect(qap)}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Level4ReviewPage;
