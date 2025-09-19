export const BOM_COMPONENTS = [
  // Make this list match SalesRequestPage.tsx exactly (source of truth)
  "Solar Cell",
  "Front Cover",
  "Back Cover",
  "Cell Connector",
  "String Connector",
  "Frame",
  "Junction Box",
  "MC4 Compatible Connector",
  "Sealant (Adhesives)",
  "Potting Material",
  "EVA (Encapsulation) Front",
  "EVA (Encapsulation) Back",
  "Bypass Diode",
  "Solar Cable",
  "Fluxing Agent",
  "Additional Material (Fixing Tape and Insulation Tape)",
  "RFID Tag",
] as const;

export type BomComponentName = (typeof BOM_COMPONENTS)[number];