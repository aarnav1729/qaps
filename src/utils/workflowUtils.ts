// src/utils/workflowUtils.ts
import { QAPFormData, User } from "@/types/qap";

const normalizeReviewBy = (reviewBy?: string | string[]) => {
  if (Array.isArray(reviewBy)) {
    return reviewBy
      .map((role) => String(role || "").trim().toLowerCase())
      .filter(Boolean);
  }

  return String(reviewBy || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
};

export const qapRequiresLevel2Role = (
  qap: Pick<QAPFormData, "specs">,
  role?: string | null
) => {
  const roleLc = String(role || "")
    .trim()
    .toLowerCase();

  if (!["production", "quality", "technical"].includes(roleLc)) {
    return false;
  }

  return [...(qap.specs?.mqp || []), ...(qap.specs?.visual || [])].some(
    (spec) => normalizeReviewBy(spec.reviewBy).includes(roleLc)
  );
};

export const getNextLevelUsers = (
  qap: QAPFormData,
  currentLevel: number
): string[] => {
  const plant = (qap.plant || "").toLowerCase();
  const hasFinal = !!qap.finalCommentsAt;

  switch (currentLevel) {
    case 1:
      return ["yamini"];

    case 2: {
      // L2 behaves the same for both rounds in terms of "who is next":
      // P4/P5 -> Level 3 (Head)
      // P2/P6 -> Level 4 (Technical Head)
      if (["p4", "p5"].includes(plant)) return ["nrao"]; // head
      if (["p2", "p6"].includes(plant)) return ["jmr", "baskara"]; // technical-head
      return [];
    }

    case 3:
      // Level 3 -> Level 4 (both rounds)
      return ["jmr", "baskara"]; // technical-head

    case 4:
      // Before final comments: L4 -> Requestor final comments
      // After final comments round: L4b -> L5
      if (hasFinal) return ["cmk"]; // plant-head
      // If you ever show "next users" in UI for pre-final L4,
      // it's the requestor (final comments owner).
      return qap.submittedBy ? [qap.submittedBy] : [];

    default:
      return [];
  }
};

export const processWorkflowTransition = (
  qap: QAPFormData,
  nextLevel: number
): QAPFormData => {
  const updatedQAP = { ...qap };
  const plant = (qap.plant || "").toLowerCase();
  const now = new Date();

  switch (nextLevel) {
    case 3: {
      // After Level 2 (initial or post-final L2):
      // P4/P5 -> Level 3
      // P2/P6 -> bypass to Level 4
      if (["p2", "p6"].includes(plant)) {
        updatedQAP.status = updatedQAP.finalCommentsAt ? "level-4b" : "level-4";
        updatedQAP.currentLevel = 4;

        updatedQAP.timeline.push({
          level: 3,
          action: updatedQAP.finalCommentsAt
            ? "Post-final: Auto-bypassed (P2/P6)"
            : "Auto-bypassed (P2/P6)",
          user: "system",
          timestamp: now,
        });
        updatedQAP.timeline.push({
          level: 4,
          action: updatedQAP.finalCommentsAt
            ? "Post-final → Sent to Technical Head (L4b)"
            : "Sent to Technical Head",
          user: "system",
          timestamp: now,
        });
      } else {
        updatedQAP.status = updatedQAP.finalCommentsAt ? "level-3b" : "level-3";
        updatedQAP.currentLevel = 3;

        updatedQAP.timeline.push({
          level: 3,
          action: updatedQAP.finalCommentsAt
            ? "Post-final → Sent to Head (L3b)"
            : "Sent to Head for review",
          user: "system",
          timestamp: now,
        });
      }
      break;
    }

    case 4: {
      // This case is used as:
      // - Pre-final: L4 completion -> send to Requestor final comments
      // - Post-final: not directly used for routing since we label L3b/L4b via case 3 above
      if (!updatedQAP.finalCommentsAt) {
        updatedQAP.status = "final-comments";
        updatedQAP.currentLevel = 4;
        updatedQAP.timeline.push({
          level: 4,
          action: "Sent to Requestor for Final Comments",
          user: "system",
          timestamp: now,
        });
      }
      break;
    }

    case 5: {
      updatedQAP.status = "level-5";
      updatedQAP.currentLevel = 5;
      updatedQAP.timeline.push({
        level: 5,
        action: "Sent to Plant Head for approval",
        user: "system",
        timestamp: now,
      });
      break;
    }
  }

  return updatedQAP;
};

export const canUserAccessQAP = (user: User, qap: QAPFormData): boolean => {
  if (user.role === "admin") return true;

  const userPlants = (user.plant || "")
    .split(",")
    .map((p) => p.trim().toLowerCase());
  const qapPlant = (qap.plant || "").toLowerCase();

  switch (user.role) {
    case "requestor":
      return qap.submittedBy === user.username;

    case "level-1-reviewer":
      return qap.currentLevel === 1 && qap.status === "level-1";

    case "production":
    case "quality":
    case "technical":
      return (
        userPlants.includes(qapPlant) &&
        qap.currentLevel === 2 &&
        String(qap.status || "").toLowerCase() === "level-2" &&
        qapRequiresLevel2Role(qap, user.role)
      );

    case "head":
      // Only P4/P5 use Level 3
      return (
        userPlants.includes(qapPlant) &&
        ["p4", "p5"].includes(qapPlant) &&
        qap.currentLevel === 3
      );

    case "technical-head":
      return qap.currentLevel === 4;

    case "plant-head":
      return qap.currentLevel === 5;

    default:
      return false;
  }
};

export const getUserAccessibleQAPs = (
  user: User,
  allQAPs: QAPFormData[]
): QAPFormData[] => {
  if (user.role === "admin") return allQAPs;

  const userPlants = (user.plant || "")
    .split(",")
    .map((p) => p.trim().toLowerCase());

  return allQAPs.filter((qap) => {
    const qapPlant = (qap.plant || "").toLowerCase();

    switch (user.role) {
      case "requestor":
        return qap.submittedBy === user.username;

      case "level-1-reviewer":
        return qap.currentLevel === 1 && qap.status === "level-1";

      case "production":
      case "quality":
      case "technical":
        return (
          userPlants.includes(qapPlant) &&
          qap.currentLevel === 2 &&
          String(qap.status || "").toLowerCase() === "level-2" &&
          qapRequiresLevel2Role(qap, user.role)
        );

      case "head":
        // Heads see P4/P5 plants they own
        return userPlants.includes(qapPlant) && ["p4", "p5"].includes(qapPlant);

      case "technical-head":
      case "plant-head":
        // Keep broad visibility (UI pages still gate by currentLevel)
        return true;

      default:
        return false;
    }
  });
};
// src/utils/workflowUtils.ts

export const shouldCaptureAdditions = (plant?: string, level?: number) => {
  const p = (plant || "").toLowerCase();
  if (level === 5) return true; // always visible at L5
  if (level === 4) return ["p2", "p4", "p5", "p6"].includes(p);
  if (level === 3) return ["p4", "p5"].includes(p);
  return false;
};

export const canEditAdditions = (userRole: string, level: number) => {
  if (level === 5) return userRole === "plant-head" || userRole === "admin";
  if (level === 4) return userRole === "technical-head" || userRole === "admin";
  if (level === 3) return userRole === "head" || userRole === "admin";
  return false;
};
