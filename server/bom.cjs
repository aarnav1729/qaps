#!/usr/bin/env node
/**
 * Extracts a BOM "master" mapping from the Excel template.
 * Output: src/data/bomMaster.ts (typed TS module)
 *
 * Usage:
 *   node scripts/extract-bom-master.cjs "<path-to-excel>" "<output-ts-path>"
 * Example:
 *   node scripts/extract-bom-master.cjs "BOM Sheet Template to be filled by Sales.xlsx"
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

function clean(s) {
  if (s == null) return "";
  return String(s).replace(/\s+/g, " ").trim().toLowerCase();
}

function get(sheet, r, c) {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  return cell ? String(cell.v).trim() : "";
}

function findHeader(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  // Scan top 40 rows max for a row containing these headers
  for (let r = 0; r <= Math.min(range.e.r, 40); r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) row.push(get(sheet, r, c));
    const rowClean = row.map(clean);

    const compIdx = rowClean.findIndex((x) => x === "component");
    const modelIdx = rowClean.findIndex(
      (x) => x.includes("part no/type") && x.includes("model")
    );
    const vendorIdx = rowClean.findIndex((x) =>
      x.includes("name of sub-vendor")
    );
    const specIdx = rowClean.findIndex((x) => x === "specification");

    if (compIdx !== -1 && modelIdx !== -1 && vendorIdx !== -1 && specIdx !== -1) {
      return { row: r, cols: { comp: compIdx, model: modelIdx, vendor: vendorIdx, spec: specIdx } };
    }
  }
  throw new Error("Could not locate the BOM header row (Component/Part/Vendor/Specification).");
}

function findMeta(sheet, label) {
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const want = clean(label);
  for (let r = 0; r <= Math.min(range.e.r, 12); r++) {
    for (let c = 0; c <= range.e.c; c++) {
      if (clean(get(sheet, r, c)) === want) {
        // Take the next non-empty cell to the right as the value
        for (let c2 = c + 1; c2 <= range.e.c; c2++) {
          const v = get(sheet, r, c2);
          if (v) return v;
        }
      }
    }
  }
  return "";
}

function main() {
  const inputPath =
    process.argv[2] || path.resolve("BOM Sheet Template to be filled by Sales.xlsx");
  const outPath = process.argv[3] || path.resolve("src/data/bomMaster.ts");

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Excel not found at: ${inputPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(inputPath, { cellDates: true });
  const sheetName = wb.SheetNames.find((n) => /bom/i.test(n)) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  const hdr = findHeader(sheet);
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  const componentsMap = {};
  for (let r = hdr.row + 1; r <= range.e.r; r++) {
    const component = get(sheet, r, hdr.cols.comp);
    const model = get(sheet, r, hdr.cols.model);
    const vendor = get(sheet, r, hdr.cols.vendor);
    const specification = get(sheet, r, hdr.cols.spec);

    const any = component || model || vendor || specification;
    if (!any) continue;

    const key = component || "UNSPECIFIED";
    if (!componentsMap[key]) componentsMap[key] = [];
    componentsMap[key].push({ model, vendor, specification });
  }

  // Optional high-level meta (handy for your page defaults)
  const meta = {
    vendorName: findMeta(sheet, "Solar Module Vendor Name"),
    technologyOptions: (findMeta(sheet, "Technology Proposed") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    vendorAddress: findMeta(sheet, "Solar Module Vendor Address"),
    document: findMeta(sheet, "Document"),
    moduleWattage: findMeta(sheet, "Module Wattage"),
    // Dimensions options are not stored in the sheet; wire in your fixed set (1,2,3) at UI time.
    moduleModelNo: findMeta(sheet, "Module Model No"),
    rfidLocation:
      findMeta(sheet, "Location of RFID in module") || "TOP Left Side, front view",
  };

  const ts = `// AUTO-GENERATED — do not edit by hand.
// Source: ${path.basename(inputPath)} (sheet: "${sheetName}")

export interface BomOption { model: string; vendor: string; specification: string; }
export type BomMaster = Record<string, BomOption[]>;

export const BOM_MASTER: BomMaster = ${JSON.stringify(componentsMap, null, 2)} as const;

export const BOM_META = ${JSON.stringify(meta, null, 2)} as const;
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, ts);
  console.log(
    `✅ Wrote ${outPath} from "${path.basename(inputPath)}" — ` +
      `${Object.keys(componentsMap).length} components`
  );
}

main();
