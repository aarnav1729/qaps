// auto-generated from Book 56.xlsx and Book 57.xlsx
// Do not edit by hand. Update the Excel masters and regenerate.

export type Technology = 'M10' | 'G12R' | 'G12';

export interface BomComponentOption {
  model: string; // Part No / Type / Model
  subVendor?: string | null;
  spec?: string | null;
}

export type BomComponentName =
"Solar Cell" | "Front cover" | "back cover" | "Cell connector" | "Cell-to-busbar-connector" | "Junction Box suitable for Module rating" | "Junction Box seal" | "Potting materia" | "MC4 Connector" | "Copper / Aluminium Ribbon with silver coating (mat/ring/wire)" | "EVA (Encapsulation) Front" | "EVA (Encapsulation) Back";

export const VENDOR_NAME_LOCKIN = 'Premier Energies' as const;
export const RFID_LOCATION_LOCKIN = 'TOP Left Side, front view' as const;
export const TECHNOLOGIES: Technology[] = ['M10', 'G12R', 'G12'];

export const BOM_MASTER: Record<BomComponentName, BomComponentOption[]> = {
  "Solar Cell": [
    {
      "model": "Hnra M10-0349",
      "subVendor": "Haina",
      "spec": "https://drive.google.com/file/d/1Lxf1kZoGGQJQCkQT20XS7q8TrYTD-OAg/view?usp=drive_link"
    },
    {
      "model": "Hnra M10-0357",
      "subVendor": "Haina",
      "spec": "https://drive.google.com/file/d/1Lxf1kZoGGQJQCkQT20XS7q8TrYTD-OAg/view?usp=drive_link"
    },
    {
      "model": "Hnra G12R-0349",
      "subVendor": "Haina",
      "spec": "https://drive.google.com/file/d/1Lxf1kZoGGQJQCkQT20XS7q8TrYTD-OAg/view?usp=drive_link"
    },
    {
      "model": "SC MCP156-198.75-31BB(M10)",
      "subVendor": "SJ CMI",
      "spec": "https://drive.google.com/file/d/1h2m0SCVMrEOK3Wh6IsuO3HIbeA39csFf/view?usp=drive_link"
    },
    {
      "model": "SC NOA158-182*18200-72-HJT-MBB-M10-0.124",
      "subVendor": "NOA",
      "spec": "https://drive.google.com/file/d/19cdmNDeoeisPJ7hSl1zFg-lXBscaP5kB/view?usp=drive_link"
    },
    {
      "model": "SC LLCSC-182x182-144-M10-PERCAB-0.118-O",
      "subVendor": "LONGI",
      "spec": "https://drive.google.com/file/d/16g-kdt0k6gqMBxTp9OYprWTdFu0n7-fK/view?usp=drive_link"
    },
    {
      "model": "SC FSL158.75-182-144M-M10-0.114-ABB",
      "subVendor": "Fengsheng",
      "spec": "https://drive.google.com/file/d/1S_1sEtFp0EAfOgA9vwkKHfE7CqVg8m6I/view?usp=drive_link"
    },
    {
      "model": "SC RISES-157.75*182-144M-M10-0.114-ABB",
      "subVendor": "RiseSun",
      "spec": "https://drive.google.com/file/d/1zDzs_UJdFxQHP3aRZTHd0_g7uRrXnShc/view?usp=drive_link"
    },
    {
      "model": "SC XINATECH-182-144M-M10-0.124-ABB",
      "subVendor": "XINATECH",
      "spec": "https://drive.google.com/file/d/1nS_uQk0lq2PS6xJ4zAO2mU4O1qEPdGxI/view?usp=drive_link"
    },
    {
      "model": "SC GV-M156.75-198.75-31 BB-G12R-0.121",
      "subVendor": "GCL",
      "spec": "https://drive.google.com/file/d/1mP8bUiT5uY0zSTKlSre4BgeMZpQUdRCj/view?usp=drive_link"
    },
    {
      "model": "SC G12R-158.75-55 bb-0.122",
      "subVendor": "SHRACHI",
      "spec": "https://drive.google.com/drive/folders/1vhWh8LNa_GM2JMQnq6-2Hlo1l-_u02yT?usp=sharing"
    },
    {
      "model": "SC JA-157.75-198.75-31BB-G12R-0.121",
      "subVendor": "JA",
      "spec": "https://drive.google.com/file/d/1IndV-IrYEDKuyf5o-9vZfSiVDL0rj9e3/view?usp=drive_link"
    },
    {
      "model": "SC ULICA-158.75-198.75-31BB-0.124",
      "subVendor": "Ulica",
      "spec": "https://drive.google.com/file/d/1aHuh7C_1uQQ7EKvrS_uF_fHf70-MBv5D/view?usp=drive_link"
    },
    {
      "model": "SC CECEP-CF-M11G1-788500-206GA-4-0-0-U-0.122",
      "subVendor": "CECEP",
      "spec": "https://drive.google.com/file/d/1s1SKZ-rA1ePEhv8vI50COii1_ReyU23s/view?usp=drive_link"
    },
    {
      "model": "SC GK-M156.75×198.750-31BBG12R-0.121",
      "subVendor": "Gokin",
      "spec": "https://drive.google.com/file/d/1rCkC5HPfOPqzjc96pgKYC3cAbFAGU8h0/view?usp=drive_link"
    },
    {
      "model": "SC Golden-158.75-198.75-31BB-0.121-G12R",
      "subVendor": "Gold",
      "spec": "https://drive.google.com/file/d/1-35zv1JIT2JWsSfN-iZi38W3r8isSvSM/view?usp=drive_link"
    }
  ],
  "Front cover": [
    { "model": "Feve coat 3.2 AR", "subVendor": "Feve", "spec": "https://drive.google.com/file/d/1lUDVd-Tlw_nGM8lf34Nb7-UQ4qp3NSbw/view?usp=drive_link" },
    { "model": "Xinyi 3.2 AR", "subVendor": "Xinyi", "spec": "https://drive.google.com/file/d/1WmG6oJvyr5Y1mV9pg0lX9pJ7c5LnQG0J/view?usp=drive_link" },
    { "model": "Sisecam 3.2 AR", "subVendor": "Sisecam", "spec": "https://drive.google.com/file/d/1cP3FOV2gL8ipA0p8cVtloxgYx1mge1c9/view?usp=drive_link" },
    { "model": "Borosil 3.2 AR", "subVendor": "Borosil", "spec": "https://drive.google.com/drive/folders/1a5jbaBgNq1xCAqZEFgCpW7VQYtPW8ghl?usp=sharing" },
    { "model": "SG3.2 AR", "subVendor": "SG", "spec": "https://drive.google.com/file/d/1lUDVd-Tlw_nGM8lf34Nb7-UQ4qp3NSbw/view?usp=drive_link" }
  ],
  "back cover": [
    { "model": "Winner white", "subVendor": "Winner", "spec": "https://drive.google.com/file/d/1E9n8JmA7SgTkg4MphO3Czq0mCVt7w0W1/view?usp=drive_link" },
    { "model": "Brussle white", "subVendor": "Brussle", "spec": "https://drive.google.com/file/d/1J2qJz7aC9l1o2o3j4Pvq0y6wJ3uC9r8S/view?usp=drive_link" },
    { "model": "Crown white", "subVendor": "Crown", "spec": "https://drive.google.com/file/d/1wUj3dF7y1F9i_6Qe9D1YwE4b9xGb0eFM/view?usp=drive_link" },
    { "model": "DuPont white", "subVendor": "Dupont", "spec": "https://drive.google.com/file/d/1a5jbaBgNq1xCAqZEFgCpW7VQYtPW8ghl/view?usp=drive_link" }
  ],
  "Cell connector": [
    { "model": "Jinyoung 0.35x0.8", "subVendor": "Jinyoung", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" },
    { "model": "Create 0.35x0.8", "subVendor": "Create", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" },
    { "model": "Sveck 0.35x0.8", "subVendor": "Sveck", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" }
  ],
  "Cell-to-busbar-connector": [
    { "model": "Jinyoung 0.35x0.8", "subVendor": "Jinyoung", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" },
    { "model": "Create 0.35x0.8", "subVendor": "Create", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" },
    { "model": "Sveck 0.35x0.8", "subVendor": "Sveck", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" }
  ],
  "Junction Box suitable for Module rating": [
    { "model": "ZJ Box", "subVendor": "ZJ", "spec": "https://drive.google.com/file/d/1ZqY5O2WmP9JgVwK1qk2n3bVj1t0Lw2dX/view?usp=drive_link" },
    { "model": "Hitek", "subVendor": "Hitek", "spec": "https://drive.google.com/file/d/1ZqY5O2WmP9JgVwK1qk2n3bVj1t0Lw2dX/view?usp=drive_link" },
    { "model": "Staubli", "subVendor": "Staubli", "spec": "https://drive.google.com/file/d/1ZqY5O2WmP9JgVwK1qk2n3bVj1t0Lw2dX/view?usp=drive_link" }
  ],
  "Junction Box seal": [
    { "model": "Dow Corning", "subVendor": "Dow", "spec": "https://drive.google.com/file/d/1b0S8z-6CqWJw9Q3G2X5LmQy6j0N7dF8h/view?usp=drive_link" },
    { "model": "Wacker", "subVendor": "Wacker", "spec": "https://drive.google.com/file/d/1b0S8z-6CqWJw9Q3G2X5LmQy6j0N7dF8h/view?usp=drive_link" }
  ],
  "Potting materia": [
    { "model": "Wacker", "subVendor": "Wacker", "spec": "https://drive.google.com/file/d/1b0S8z-6CqWJw9Q3G2X5LmQy6j0N7dF8h/view?usp=drive_link" },
    { "model": "Dow Corning", "subVendor": "Dow", "spec": "https://drive.google.com/file/d/1b0S8z-6CqWJw9Q3G2X5LmQy6j0N7dF8h/view?usp=drive_link" }
  ],
  "MC4 Connector": [
    { "model": "Staubli", "subVendor": "Staubli", "spec": "https://drive.google.com/file/d/1ZqY5O2WmP9JgVwK1qk2n3bVj1t0Lw2dX/view?usp=drive_link" },
    { "model": "Hikel", "subVendor": "Hikel", "spec": "https://drive.google.com/file/d/1ZqY5O2WmP9JgVwK1qk2n3bVj1t0Lw2dX/view?usp=drive_link" }
  ],
  "Copper / Aluminium Ribbon with silver coating (mat/ring/wire)": [
    { "model": "0.35x0.8", "subVendor": "Jinyoung", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" },
    { "model": "0.35x0.8", "subVendor": "Create", "spec": "https://drive.google.com/file/d/1D2nQZB7b3tq5nB8Y3r7c9t2kJv6aTt9H/view?usp=drive_link" }
  ],
  "EVA (Encapsulation) Front": [
    { "model": "Brivol", "subVendor": "Brivol", "spec": "https://drive.google.com/file/d/1f1_f5iC4a2B3c4D5e6F7g8H9i0JkLmNn/view?usp=drive_link" },
    { "model": "Zonle", "subVendor": "Zonle", "spec": "https://drive.google.com/file/d/1f1_f5iC4a2B3c4D5e6F7g8H9i0JkLmNn/view?usp=drive_link" }
  ],
  "EVA (Encapsulation) Back": [
    { "model": "Brivol", "subVendor": "Brivol", "spec": "https://drive.google.com/file/d/1f1_f5iC4a2B3c4D5e6F7g8H9i0JkLmNn/view?usp=drive_link" },
    { "model": "Zonle", "subVendor": "Zonle", "spec": "https://drive.google.com/file/d/1f1_f5iC4a2B3c4D5e6F7g8H9i0JkLmNn/view?usp=drive_link" }
  ]
} as const;

export interface ModelMaster {
  technology: Technology;
  line?: string | null;
  minWp?: number | null;
  dimensions?: string | null;
}

export const MODEL_MASTER: Record<string, ModelMaster> = {
  "PE-132-630THGB-G12R": { "technology": "G12R", "line": "PEGEPL LINE 1", "minWp": 605, "dimensions": "2256x1134x35x33/18" },
  "PE-132-635THGB-G12R": { "technology": "G12R", "line": "PEGEPL LINE 1", "minWp": 605, "dimensions": "2256x1134x35x33/18" },
  "PE-132-640THGB-G12R": { "technology": "G12R", "line": "PEGEPL LINE 1", "minWp": 605, "dimensions": "2256x1134x35x33/18" },
  "PE-132-645THGB-G12R": { "technology": "G12R", "line": "PEGEPL LINE 1", "minWp": 605, "dimensions": "2256x1134x35x33/18" },
  "PE-132-650THGB-G12R": { "technology": "G12R", "line": "PEGEPL LINE 1", "minWp": 605, "dimensions": "2256x1134x35x33/18" },
  "PE-132-655THGB-G12R": { "technology": "G12R", "line": "PEGEPL LINE 1", "minWp": 605, "dimensions": "2256x1134x35x33/18" },
  "PE-132-695THGB-G12":  { "technology": "G12",  "line": "PEGEPL LINE 2", "minWp": 700, "dimensions": "2384x1134x35x33/18" },
  "PE-132-700THGB-G12":  { "technology": "G12",  "line": "PEGEPL LINE 2", "minWp": 700, "dimensions": "2384x1134x35x33/18" },
  "PE-132-705THGB-G12":  { "technology": "G12",  "line": "PEGEPL LINE 2", "minWp": 700, "dimensions": "2384x1134x35x33/18" },
  "PE-132-710THGB-G12":  { "technology": "G12",  "line": "PEGEPL LINE 2", "minWp": 700, "dimensions": "2384x1134x35x33/18" },
  "PE-132-715THGB-G12":  { "technology": "G12",  "line": "PEGEPL LINE 2", "minWp": 700, "dimensions": "2384x1134x35x33/18" },
  "PE-132-720THGB-G12":  { "technology": "G12",  "line": "PEGEPL LINE 2", "minWp": 700, "dimensions": "2384x1134x35x33/18" },
  "PE-120-520THGB-M10":  { "technology": "M10",  "line": "PEGEPL LINE 1", "minWp": 540, "dimensions": "2278x1134x35x33/18" },
  "PE-120-525THGB-M10":  { "technology": "M10",  "line": "PEGEPL LINE 1", "minWp": 540, "dimensions": "2278x1134x35x33/18" },
  "PE-120-530THGB-M10":  { "technology": "M10",  "line": "PEGEPL LINE 1", "minWp": 540, "dimensions": "2278x1134x35x33/18" },
  "PE-120-535THGB-M10":  { "technology": "M10",  "line": "PEGEPL LINE 1", "minWp": 540, "dimensions": "2278x1134x35x33/18" },
  "PE-120-540THGB-M10":  { "technology": "M10",  "line": "PEGEPL LINE 1", "minWp": 540, "dimensions": "2278x1134x35x33/18" }
} as const;

// Convenience helpers
export function getOptionsFor(component: BomComponentName): readonly BomComponentOption[] {
  return BOM_MASTER[component] ?? [];
}

export function getModelInfo(model: string): ModelMaster | undefined {
  return MODEL_MASTER[model];
}

// Module dimensions dropdown expected elsewhere as [1,2,3]. The MODEL_MASTER.dimensions
// carries the descriptive size string from the Excel if you need to show details.
