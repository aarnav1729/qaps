import type { AnyQAPSpec, QAPFormData, QAPMatchStatus } from "@/types/qap";

export type ReviewerRowFilter =
  | "all"
  | "matched"
  | "unmatched"
  | "agreed"
  | "edited";

const matchValue = (match?: string | null): QAPMatchStatus | "" => {
  const safe = String(match || "").trim().toLowerCase();
  if (safe === "yes" || safe === "no" || safe === "agreed") {
    return safe;
  }
  return "";
};

export const isMatched = (match?: string | null) => matchValue(match) === "yes";
export const isUnmatched = (match?: string | null) =>
  matchValue(match) === "no";
export const isAgreed = (match?: string | null) => matchValue(match) === "agreed";

export const matchesReviewerMatchFilter = (
  filter: Exclude<ReviewerRowFilter, "edited">,
  match?: string | null
) => {
  if (filter === "all") return true;
  if (filter === "matched") return isMatched(match);
  if (filter === "unmatched") return isUnmatched(match);
  if (filter === "agreed") return isAgreed(match);
  return true;
};

export const getMatchLabel = (match?: string | null) => {
  if (isMatched(match)) return "Match";
  if (isAgreed(match)) return "Agreed";
  if (isUnmatched(match)) return "Mismatch";
  return "Pending";
};

export const getMatchBadgeClasses = (match?: string | null) => {
  if (isMatched(match)) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (isAgreed(match)) {
    return "bg-amber-100 text-amber-900 border-amber-300";
  }
  if (isUnmatched(match)) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  return "bg-gray-100 text-gray-700 border-gray-200";
};

export const getSpecCriteriaLabel = (
  spec: Partial<AnyQAPSpec> & { criteria?: string | null },
  fallback?: string
) => {
  const explicit = String(spec.criteria || "").trim();
  if (explicit) return explicit;
  if (fallback) return fallback;
  if (
    spec.defect !== undefined ||
    spec.defectClass !== undefined ||
    spec.description !== undefined ||
    spec.criteriaLimits !== undefined
  ) {
    return "Visual EL";
  }
  return "MQP";
};

export const getSpecRowClassName = (spec: Partial<AnyQAPSpec>) => {
  if (isMatched(spec.match)) return "bg-green-50";
  if (isAgreed(spec.match)) return "bg-amber-50";
  if (isUnmatched(spec.match)) return "bg-red-50";
  return "";
};

export const getInitialSpecValue = (spec: Partial<AnyQAPSpec>) =>
  spec.initialCustomerSpecification ||
  (spec.initialMatch === "no" ? spec.customerSpecification || "" : "");

export const getLevel1OutcomeText = (spec: Partial<AnyQAPSpec>) => {
  if (!spec.level1Closed && !spec.level1Resolution) return "";
  const by = spec.level1ResolvedBy ? ` by ${spec.level1ResolvedBy}` : "";
  if (spec.level1Resolution === "matched") {
    const before = getInitialSpecValue(spec);
    return before
      ? `Level 1 marked this mismatch as a match${by}. Requestor spec: ${before}`
      : `Level 1 marked this mismatch as a match${by}.`;
  }
  if (spec.level1Resolution === "agreed") {
    const agreedValue =
      spec.level1ResolutionText || spec.customerSpecification || "";
    const before = getInitialSpecValue(spec);
    const parts = [`Level 1 agreed measure${by}`];
    if (agreedValue) parts.push(`Agreed: ${agreedValue}`);
    if (before) parts.push(`Requestor: ${before}`);
    return parts.join(" • ");
  }
  return "";
};

export const getLevel1Summary = (
  input: Pick<QAPFormData, "level1Summary" | "specs"> | AnyQAPSpec[]
) => {
  if (!Array.isArray(input) && input?.level1Summary) {
    return input.level1Summary;
  }

  const specs = Array.isArray(input)
    ? input
    : [...(input?.specs?.mqp || []), ...(input?.specs?.visual || [])];

  const target = specs.filter(
    (spec) => spec.initialMatch === "no" || spec.level1Closed || spec.level1Resolution
  );
  const matched = target.filter(
    (spec) =>
      spec.level1Resolution === "matched" || (spec.level1Closed && isMatched(spec.match))
  ).length;
  const agreed = target.filter(
    (spec) =>
      spec.level1Resolution === "agreed" || (spec.level1Closed && isAgreed(spec.match))
  ).length;
  const closed = matched + agreed;

  return {
    totalReviewed: target.length,
    matched,
    agreed,
    closed,
    pending: Math.max(target.length - closed, 0),
    reviewedBy:
      target.find((spec) => spec.level1ResolvedBy)?.level1ResolvedBy || null,
    reviewedAt:
      target.find((spec) => spec.level1ResolvedAt)?.level1ResolvedAt || null,
  };
};
