// src/utils/workflowUtils.ts
import { QAPFormData, User } from "@/types/qap";

export const getNextLevelUsers = (
  qap: QAPFormData,
  currentLevel: number
): string[] => {
  const plant = (qap.plant || "").toLowerCase();

  switch (currentLevel) {
    case 2: {
      // After Level 2:
      // P4/P5 -> Level 3 (Head)
      // P2/P6 -> bypass to Level 4 (Technical Head)
      if (["p4", "p5"].includes(plant)) return ["nrao"]; // head
      if (["p2", "p6"].includes(plant)) return ["jmr", "baskara"]; // technical-head
      return [];
    }
    case 3:
      // Level 3 -> Level 4
      return ["jmr", "baskara"]; // technical-head
    case 4:
      // Level 4 -> Level 5
      return ["cmk"]; // plant-head
    default:
      return [];
  }
};

// src/utils/workflowUtils.ts
export const processWorkflowTransition = (
  qap: QAPFormData,
  nextLevel: number
): QAPFormData => {
  const updatedQAP = { ...qap };
  const plant = (qap.plant || "").toLowerCase();
  const now = new Date();

  switch (nextLevel) {
    case 3: {
      if (["p2", "p6"].includes(plant)) {
        updatedQAP.status = "level-4";
        updatedQAP.currentLevel = 4;
        updatedQAP.timeline.push({
          level: 3,
          action: "Auto-bypassed (P2/P6)",
          user: "system",
          timestamp: now,
        });
        updatedQAP.timeline.push({
          level: 4,
          action: "Sent to Technical Head",
          user: "system",
          timestamp: now,
        });
      } else {
        updatedQAP.status = "level-3";
        updatedQAP.currentLevel = 3;
        updatedQAP.timeline.push({
          level: 3,
          action: "Sent to Head for review",
          user: "system",
          timestamp: now,
        });
      }
      break;
    }
    case 4: {
      if (updatedQAP.finalCommentsAt) {
        const plant = (qap.plant || "").toLowerCase();
        if (["p2", "p6"].includes(plant)) {
          updatedQAP.status = "level-4b";
          updatedQAP.currentLevel = 4;
          updatedQAP.timeline.push({
            level: 4,
            action: "Post-final → sent to Technical Head (L4b)",
            user: "system",
            timestamp: now,
          });
        } else {
          updatedQAP.status = "level-3b";
          updatedQAP.currentLevel = 3;
          updatedQAP.timeline.push({
            level: 3,
            action: "Post-final → sent to Head (L3b)",
            user: "system",
            timestamp: now,
          });
        }
      } else {
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

    case "production":
    case "quality":
    case "technical":
      // Level 2 reviewers (any plant match)
      return userPlants.includes(qapPlant) && qap.currentLevel === 2;

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

      case "production":
      case "quality":
      case "technical":
        return userPlants.includes(qapPlant);

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
