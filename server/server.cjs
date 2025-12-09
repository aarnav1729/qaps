// required modules
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const sql = require("mssql");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const {
  body,
  param,
  validationResult,
  body: vBody,
  param: vParam,
} = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const https = require("https");
const app = express();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// server.cjs
const qapSpecsRouter = require("./routes/qapSpecifications.cjs");
app.use("/api", qapSpecsRouter);

// middleware
app.use(
  cors({
    origin: true, // reflect request origin, no patterns / regex
    credentials: true, // let browsers send & receive cookies
  })
);

app.use(express.json({ limit: "50mb", strict: true }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cookieParser());
app.use(compression());

// db connection config
const mssqlConfig = {
  user: process.env.MSSQL_USER || "SPOT_USER",
  password: process.env.MSSQL_PASSWORD || "Marvik#72@",
  server: process.env.MSSQL_SERVER || "10.0.40.10",
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || "QAP",
  options: {
    trustServerCertificate: true,
    encrypt: false,
    connectionTimeout: 60000,
  },
};

let mssqlPool;

// ---- File paths (adjust if your structure differs) ----
const PROJECT_ROOT = path.join(__dirname, ".."); // server/.. = project root
const DATA_DIR = path.join(PROJECT_ROOT, "data"); // JSON store folder (create if absent)
const SRC_DATA_DIR = path.join(PROJECT_ROOT, "src", "data"); // TypeScript data folder

const SPEC_STORE_JSON = path.join(DATA_DIR, "specs.store.json");
const BOM_STORE_JSON = path.join(DATA_DIR, "bom.store.json");

const SPEC_TS = path.join(SRC_DATA_DIR, "qapSpecifications.ts");
const BOM_TS = path.join(SRC_DATA_DIR, "bomMaster.ts");

// Ensure directories exist
for (const d of [DATA_DIR, SRC_DATA_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ---- Types (JS doc to keep it clear) ----
/**
 * @typedef {"MQP"|"Visual"} CriteriaType
 * @typedef {"Critical"|"Major"|"Minor"} SpecClass
 * @typedef {Object} SpecItem
 * @property {string} id
 * @property {CriteriaType} criteria
 * @property {string} subCriteria
 * @property {string} specification
 * @property {SpecClass} class
 * @property {string=} description
 * @property {string=} sampling
 * @property {string=} typeOfCheck
 */

/**
 * @typedef {"M10"|"G12R"|"G12"} Technology
 * @typedef {"Solar Cell"|"Front Cover"|"Back Cover"|"Encapsulation (EVA)"|"Back Sheet (Tedlar)"|"Frame"|"Junction Box"|"Bypass Diodes"|"Interconnect Ribbons"|"Bus Bar"|"Sealants"|"Label"|"Carton Box"} BomComponentName
 * @typedef {{model:string, subVendor?:string|null, spec?:string|null}} BomOption
 * @typedef {{id:string, name:BomComponentName, technology:Technology, options:BomOption[]}} BomItem
 */

// ---- Stores in memory ----
/** @type {SpecItem[]} */
let SPEC_STORE = [];
/** @type {BomItem[]} */
let BOM_STORE = [];

// ---- Load/Save JSON store ----
function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const txt = fs.readFileSync(file, "utf-8");
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}
function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf-8");
}

// ---- Generators to TypeScript files ----
function escapeTs(s) {
  return String(s).replace(/`/g, "\\`");
}

// project schema
async function initMssql() {
  try {
    mssqlPool = await sql.connect(mssqlConfig);
    console.log(`✅ MSSQL connected → ${mssqlConfig.database}`);

    await mssqlPool.request().batch(`
      ------------------------------------------------
      -- 1) Users
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
      CREATE TABLE Users (
        id           UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        username     NVARCHAR(50)    UNIQUE NOT NULL,
        passwordHash NVARCHAR(200)   NOT NULL,
        role         NVARCHAR(20)    NOT NULL,
        plant        NVARCHAR(100)   NULL
      );

      ------------------------------------------------
      -- 2) QAPs
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'QAPs')
      CREATE TABLE QAPs (
        id                  UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        customerName        NVARCHAR(100)   NOT NULL,
        projectName         NVARCHAR(100)   NOT NULL,
        orderQuantity       INT             NOT NULL,
        productType         NVARCHAR(50)    NOT NULL,
        plant               NVARCHAR(10)    NOT NULL,
        status              NVARCHAR(20)    NOT NULL,
        submittedBy         NVARCHAR(50)    NULL,
        submittedAt         DATETIME2       NULL,
        currentLevel        INT             NOT NULL,
        finalComments       NVARCHAR(MAX)   NULL,
        finalCommentsBy     NVARCHAR(50)    NULL,
        finalCommentsAt     DATETIME2       NULL,
        finalAttachmentName NVARCHAR(200)   NULL,
        finalAttachmentUrl  NVARCHAR(500)   NULL,
        approver            NVARCHAR(50)    NULL,
        approvedAt          DATETIME2       NULL,
        feedback            NVARCHAR(MAX)   NULL,
        createdAt           DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        lastModifiedAt      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
      );

      -- QAPs: ensure salesRequestId exists for linkage
      IF COL_LENGTH('QAPs','salesRequestId') IS NULL
        ALTER TABLE QAPs ADD salesRequestId UNIQUEIDENTIFIER NULL;
        -- QAPs: track edits & diffs
      IF COL_LENGTH('QAPs','editedBy') IS NULL
        ALTER TABLE QAPs ADD editedBy NVARCHAR(50) NULL;

      IF COL_LENGTH('QAPs','editedAt') IS NULL
        ALTER TABLE QAPs ADD editedAt DATETIME2 NULL;

      IF COL_LENGTH('QAPs','editChanges') IS NULL
        ALTER TABLE QAPs ADD editChanges NVARCHAR(MAX) NULL;

      ------------------------------------------------
      -- 3a) MQP Specs
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MQPSpecs')
      CREATE TABLE MQPSpecs (
        qapId                 UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MQPSpecs_QAPs FOREIGN KEY REFERENCES QAPs(id),
        sno                   INT    NOT NULL,
        subCriteria           NVARCHAR(MAX),
        componentOperation    NVARCHAR(MAX),
        characteristics       NVARCHAR(MAX),
        class                 NVARCHAR(MAX),
        typeOfCheck           NVARCHAR(MAX),
        sampling              NVARCHAR(MAX),
        specification         NVARCHAR(MAX),
        [match]               NVARCHAR(5),
        customerSpecification NVARCHAR(MAX),
        reviewBy              NVARCHAR(MAX),
        PRIMARY KEY (qapId, sno)
      );

      ------------------------------------------------
      -- 3b) Visual/EL Specs
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VisualSpecs')
      CREATE TABLE VisualSpecs (
        qapId                 UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_VisualSpecs_QAPs FOREIGN KEY REFERENCES QAPs(id),
        sno                   INT    NOT NULL,
        subCriteria           NVARCHAR(MAX),
        defect                NVARCHAR(MAX),
        defectClass           NVARCHAR(MAX),
        description           NVARCHAR(MAX),
        criteriaLimits        NVARCHAR(MAX),
        [match]               NVARCHAR(5),
        customerSpecification NVARCHAR(MAX),
        reviewBy              NVARCHAR(MAX),
        PRIMARY KEY (qapId, sno)
      );

      ------------------------------------------------
      -- 4) LevelResponses
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LevelResponses')
      CREATE TABLE LevelResponses (
        qapId       UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_Resp_QAPs FOREIGN KEY REFERENCES QAPs(id),
        level       INT             NOT NULL,
        role        NVARCHAR(20)     NOT NULL,
        username    NVARCHAR(50)     NOT NULL,
        acknowledged BIT             NOT NULL,
        respondedAt DATETIME2        NOT NULL,
        comments    NVARCHAR(MAX)    NULL,
        CONSTRAINT PK_LevelResp PRIMARY KEY (qapId, level, role)
      );

      ------------------------------------------------
      -- 5) TimelineEntries
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TimelineEntries')
      CREATE TABLE TimelineEntries (
        entryId   INT IDENTITY(1,1) PRIMARY KEY,
        qapId     UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_Time_QAPs FOREIGN KEY REFERENCES QAPs(id),
        level     INT             NOT NULL,
        action    NVARCHAR(200)   NOT NULL,
        [user]    NVARCHAR(50)    NULL,
        timestamp DATETIME2       NOT NULL
      );

      ------------------------------------------------
      -- SalesRequests (master)
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SalesRequests')
      CREATE TABLE SalesRequests (
        id                          UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        customerName                NVARCHAR(200)   NOT NULL,
        isNewCustomer               NVARCHAR(3)     NOT NULL,      -- 'yes' | 'no'
        moduleManufacturingPlant    NVARCHAR(10)    NOT NULL,      -- 'p2' | 'p4' | 'p5' | 'p6'
        moduleOrderType             NVARCHAR(10)    NOT NULL,      -- 'm10' | 'g12r' | 'g12'
        cellType                    NVARCHAR(10)    NOT NULL,      -- 'DCR' | 'NDCR'
        wattageBinning              INT             NOT NULL,
        rfqOrderQtyMW               INT             NOT NULL,
        premierBiddedOrderQtyMW     INT             NULL,
        deliveryStartDate           DATE            NOT NULL,
        deliveryEndDate             DATE            NOT NULL,
        projectLocation             NVARCHAR(200)   NOT NULL,
        cableLengthRequired         INT             NOT NULL,
        qapType                     NVARCHAR(50)    NOT NULL,      -- 'Customer' | 'Premier Energies'

        qapTypeAttachmentName       NVARCHAR(200)   NULL,
        qapTypeAttachmentUrl        NVARCHAR(500)   NULL,

        primaryBom                  NVARCHAR(3)     NOT NULL,      -- 'yes' | 'no'
        primaryBomAttachmentName    NVARCHAR(200)   NULL,
        primaryBomAttachmentUrl     NVARCHAR(500)   NULL,

        inlineInspection            NVARCHAR(3)     NOT NULL,      -- 'yes' | 'no'
        cellProcuredBy              NVARCHAR(20)    NOT NULL,      -- 'Customer' | 'Premier Energies'
        agreedCTM                   DECIMAL(18,8)   NOT NULL,
        factoryAuditTentativeDate   DATE            NULL,
        xPitchMm                    INT             NULL,
        trackerDetails              INT             NULL,
        priority                    NVARCHAR(10)    NOT NULL,      -- 'high' | 'low'
        remarks                     NVARCHAR(MAX)   NULL,

        createdBy                   NVARCHAR(50)    NOT NULL,
        createdAt                   DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),

        -- store BOM JSON as text (SQL Server JSON functions can still query it)
        bom                         NVARCHAR(MAX)   NULL
      );

      -- NEW: add wattageBinningDist column for distribution JSON
      IF COL_LENGTH('SalesRequests','wattageBinningDist') IS NULL
        ALTER TABLE SalesRequests ADD wattageBinningDist NVARCHAR(MAX) NULL;
      -- SalesRequests: add PDI flag if missing
      IF COL_LENGTH('SalesRequests','pdi') IS NULL
        ALTER TABLE SalesRequests ADD pdi NVARCHAR(3) NULL; -- 'yes' | 'no'
      -- NEW: persist sub-dropdowns + misc (nullable; backward compatible)
      IF COL_LENGTH('SalesRequests','moduleCellType') IS NULL
        ALTER TABLE SalesRequests ADD moduleCellType NVARCHAR(10) NULL; -- 'M10'|'M10R'|'G12'|'G12R'
      IF COL_LENGTH('SalesRequests','cellTech') IS NULL
        ALTER TABLE SalesRequests ADD cellTech NVARCHAR(10) NULL; -- 'PERC'|'TOPCon'
      IF COL_LENGTH('SalesRequests','cutCells') IS NULL
        ALTER TABLE SalesRequests ADD cutCells INT NULL; -- 60|66|72|78
      IF COL_LENGTH('SalesRequests','certificationRequired') IS NULL
        ALTER TABLE SalesRequests ADD certificationRequired NVARCHAR(50) NULL; -- 'BIS'|'IEC'|'BIS + IEC'|'Not Required'
      IF COL_LENGTH('SalesRequests','projectCode') IS NULL
        ALTER TABLE SalesRequests ADD projectCode NVARCHAR(100) NULL; -- optional display-only
      ------------------------------------------------
      -- SalesRequestFiles (child)
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SalesRequestFiles')
      CREATE TABLE SalesRequestFiles (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        salesRequestId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT FK_SRF_SR FOREIGN KEY REFERENCES SalesRequests(id) ON DELETE CASCADE,
        title          NVARCHAR(200)   NULL,
        fileName       NVARCHAR(200)   NOT NULL,
        url            NVARCHAR(500)   NOT NULL
      );

      ------------------------------------------------
      -- SalesRequestHistory (audit trail)
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SalesRequestHistory')
      CREATE TABLE SalesRequestHistory (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        salesRequestId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT FK_SRH_SR FOREIGN KEY REFERENCES SalesRequests(id) ON DELETE CASCADE,
        action         NVARCHAR(20)    NOT NULL,  -- 'create' | 'update' | 'delete'
        changedBy      NVARCHAR(50)    NOT NULL,
        changedAt      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        changes        NVARCHAR(MAX)   NULL,       -- JSON array of { field, before, after }
        snapshot       NVARCHAR(MAX)   NULL       -- JSON snapshot for UI history views      
        );

        IF COL_LENGTH('SalesRequestHistory','snapshot') IS NULL
        ALTER TABLE SalesRequestHistory ADD snapshot NVARCHAR(MAX) NULL;
      ------------------------------------------------
      -- Customers (master)
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Customers')
      BEGIN
        CREATE TABLE Customers (
          id        UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
          name      NVARCHAR(200) NOT NULL,
          createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );

        -- Make names unique (collation is typically case-insensitive; if yours is case-sensitive,
        -- keep this and also consider a computed lowercase column + unique index).
        CREATE UNIQUE INDEX UX_Customers_name ON Customers(name);
      END;

      -- (Optional) auto-bump updatedAt on updates if you prefer DB-side stamping
      IF OBJECT_ID('dbo.trg_Customers_UpdatedAt', 'TR') IS NULL
      EXEC('CREATE TRIGGER trg_Customers_UpdatedAt ON Customers
      AFTER UPDATE AS
        UPDATE c SET updatedAt = SYSUTCDATETIME()
        FROM Customers c
        INNER JOIN inserted i ON c.id = i.id;');

      ------------------------------------------------  
      -- Order support for BOM components
      IF COL_LENGTH('dbo.BomComponents','position') IS NULL
      BEGIN
        ALTER TABLE dbo.BomComponents ADD position INT NULL;

        -- compile this after the ALTER using dynamic SQL
        EXEC sp_executesql N'
          ;WITH x AS (
            SELECT name, ROW_NUMBER() OVER (ORDER BY name) AS rn
            FROM dbo.BomComponents
          )
          UPDATE c
          SET position = x.rn
          FROM dbo.BomComponents c
          JOIN x ON x.name = c.name;
        ';
      END;
      ------------------------------------------------
      ------------------------------------------------
      -- Only add a position column; do NOT add an id.
      IF COL_LENGTH('dbo.BomComponents','position') IS NULL
      ALTER TABLE dbo.BomComponents ADD position INT NULL;
    `);

    console.log("✅ MSSQL schema ensured");
  } catch (err) {
    console.error("❌ MSSQL init error:", err);
  }
}

// call + connect init
async function initDatabases() {
  await initMssql();
  await seedBomDbFromLocalIfEmpty(); // ← fill DB once from local JSON if empty
  await upsertBomTsFromDb(); // ← then mirror DB → TS (only if DB has rows)
}

// session management via JWT in httpOnly cookie
const JWT_SECRET =
  process.env.JWT_SECRET || "please_change_me_to_a_strong_secret";
const JWT_EXPIRES_IN = "2h";

// auth middleware
function authenticateToken(req, res, next) {
  const token =
    req.cookies.token || (req.headers.authorization || "").split(" ")[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // stale/invalid token → clear it and force re-login path
      res.clearCookie("token");
      return res.sendStatus(401);
    }
    req.user = user;
    next();
  });
}

// role-based authorization middleware
function authorizeRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role)) return res.sendStatus(403);
    next();
  };
}

// helper for db fallback options
async function tryMssql(fn) {
  return await fn(mssqlPool);
}

// helper for express-validator
function handleValidation(req, res, next) {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  next();
}

// small coercion helpers used by Sales Requests create/update
function yesNo(v) {
  return String(v || "").toLowerCase() === "yes" ? "yes" : "no";
}

// return int or null if invalid/absent
function intOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// return decimal or zero if invalid/absent
function decOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Accept "YYYY-MM-DD" or any ISO-ish string → "YYYY-MM-DD" | null
function normYMD(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Simple fallback for enumerations (prevents accidental NULLs)
function pick(v, def) {
  const s = (v ?? "").toString().trim();
  return s ? s : def;
}

// Normalize reviewBy to a lowercase CSV string
function normReviewBy(v) {
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        String(x || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
      .join(",");
  }
  if (v == null) return "";
  return String(v)
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .join(",");
}

// Convert CSV to array of lowercase roles
function rolesCsvToArrayLower(csv) {
  if (!csv) return [];
  return String(csv)
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function diffRowFields(oldRow, newRow, fields) {
  const deltas = [];
  for (const f of fields) {
    const before =
      f === "reviewBy" ? normReviewBy(oldRow?.[f]) : oldRow?.[f] ?? null;
    const after =
      f === "reviewBy" ? normReviewBy(newRow?.[f]) : newRow?.[f] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      deltas.push({ field: f, before, after });
    }
  }
  return deltas;
}

function diffSpecs(oldArr = [], newArr = [], kind /* 'mqp' | 'visual' */) {
  const key = kind === "mqp" ? "sno" : "sno";
  const idxOld = new Map(oldArr.map((r) => [r[key], r]));
  const idxNew = new Map(newArr.map((r) => [r[key], r]));
  const rowsChanged = [];
  const fields =
    kind === "mqp"
      ? // add 'specification' so MQP Premier Spec cells can highlight
        ["match", "customerSpecification", "specification", "reviewBy"]
      : // add 'criteriaLimits' so Visual 'Limits' cells can highlight
        ["match", "customerSpecification", "criteriaLimits", "reviewBy"];
  for (const sno of new Set([...idxOld.keys(), ...idxNew.keys()])) {
    const deltas = diffRowFields(
      idxOld.get(sno) || {},
      idxNew.get(sno) || {},
      fields
    );
    if (deltas.length) rowsChanged.push({ sno, deltas });
  }
  return rowsChanged;
}

function diffHeader(oldM, newM) {
  const fields = [
    "customerName",
    "projectName",
    "projectCode",
    "orderQuantity",
    "productType",
    "plant",
  ];
  const out = [];
  for (const f of fields) {
    const before = oldM?.[f] ?? null;
    const after = newM?.[f] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      out.push({ field: f, before, after });
    }
  }
  return out;
}

// treat "" as "omit" on UPDATE so we never write NULLs accidentally
function isBlank(v) {
  return (
    v === undefined || v === null || (typeof v === "string" && v.trim() === "")
  );
}

// keep original value if blank (undefined or "")
function keepIfPresent(v) {
  // undefined => don't update; "" => don't update; anything else => keep original value
  return isBlank(v) ? undefined : v;
}

function coerceOrderTagFromBody(b) {
  // Prefer new sub-field if present; else legacy order type
  const tag = (b.moduleCellType || b.moduleOrderType || "M10").toString();
  return tag.toUpperCase(); // "M10" | "M10R" | "G12" | "G12R"
}

function makeSrProjectCodeFromBody(b) {
  return makeProjectCodeSR({
    customerName: b.customerName || "CUS",
    plant: (b.moduleManufacturingPlant || "P?").toString().toUpperCase(), // "P2"/"P5"/"P6"
    orderTag: coerceOrderTagFromBody(b),
    date: b.deliveryStartDate, // "YYYY-MM-DD"
  });
}

// ── Project Code helper (SR-format) ──────────────────────────────────────────
// Builds: SR-CUS-P5-G12R-YYYYMMDD-0001 (FE is the source of truth for seq; BE just mirrors)
function makeProjectCodeSR({
  customerName,
  plant, // "P2" | "P5" | "P6"
  orderTag, // "M10" | "M10R" | "G12" | "G12R"
  date, // "YYYY-MM-DD" | Date | undefined
}) {
  const cus3 =
    (customerName || "CUS")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3) || "CUS";
  const plantTag = (plant || "P?").toUpperCase();
  const ord = (orderTag || "M10").toUpperCase();
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seq = "0001"; // placeholder; if you later add server-side sequencing, replace this
  return `SR-${cus3}-${plantTag}-${ord}-${yyyy}${mm}${dd}-${seq}`;
}

// strict required coercers (CREATE path)
function mustEnum(v, allowed, defIfBlank) {
  const s = String(v ?? "").trim();
  const val = s || defIfBlank;
  if (!allowed.includes(val))
    throw new Error(`Bad enum value: ${s || "(empty)"}`);
  return val;
}

// returns finite int, else throws
function mustInt(v, { gt = null, gte = null } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("Bad int");
  if (gt != null && !(n > gt)) throw new Error("Bad int > check");
  if (gte != null && !(n >= gte)) throw new Error("Bad int >= check");
  return n;
}

// returns finite decimal, else throws
function mustDec(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("Bad decimal");
  return n;
}

// returns "YYYY-MM-DD" or throws
function mustYMD(v) {
  const s = normYMD(v);
  if (!s) throw new Error("Bad date");
  return s;
}

// inflate SalesRequest row from DB + attach files
function mapSpecRow(r) {
  return {
    id: String(r.id), // DB id is INT, UI expects string
    criteria: r.criteria, // "MQP" | "Visual"
    subCriteria: r.subCriteria || "",
    specification: r.specification || "",
    class: r.class || "Major", // driver returns "[class]" as "class"
    description: r.description || null,
    sampling: r.sampling || null,
    typeOfCheck: r.typeOfCheck || null,
  };
}

// Turn whatever is in LevelResponses.comments into a normalized thread array
function coerceCommentsToThread(raw, fallbackBy, fallbackAt) {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      // legacy single object { [sno]: "text", ... } → wrap as first entry
      return [
        {
          by: fallbackBy || "unknown",
          at:
            fallbackAt instanceof Date
              ? fallbackAt.toISOString()
              : new Date(fallbackAt || Date.now()).toISOString(),
          responses: parsed,
        },
      ];
    }
    return [];
  } catch {
    return [];
  }
}

// CMD+F: NEST_RESPONSES_HELPER
function nestResponses(rows = []) {
  return rows.reduce((o, r) => {
    o[r.level] = o[r.level] || {};
    o[r.level][r.role] = {
      username: r.username,
      acknowledged: r.acknowledged === 1 || r.acknowledged === true,
      comments: coerceCommentsToThread(r.comments, r.username, r.respondedAt),
      respondedAt: r.respondedAt,
    };
    return o;
  }, {});
}

// CMD+F: L2_FEED_HELPER
function flattenLevel2Feed(rows = []) {
  // a flat, UI-friendly feed of all Level-2 comment entries across roles
  const out = [];
  for (const r of rows) {
    if (Number(r.level) !== 2) continue;
    const thread = coerceCommentsToThread(
      r.comments,
      r.username,
      r.respondedAt
    );
    for (const entry of thread) {
      out.push({
        role: r.role,
        by: entry.by,
        at: entry.at,
        responses: entry.responses || {},
      });
    }
  }
  // sort by time, oldest first
  out.sort((a, b) => new Date(a.at) - new Date(b.at));
  return out;
}

// CMD+F: EDIT_CHANGES_HELPER
function parseEditChanges(masterRow) {
  try {
    return JSON.parse(masterRow?.editChanges || "[]");
  } catch {
    return [];
  }
}

// CMD+F: EDIT_SNOS_HELPER
function deriveEditedSnos(editHistory /* from parseEditChanges(...) */) {
  try {
    const last =
      Array.isArray(editHistory) && editHistory.length
        ? editHistory[editHistory.length - 1]
        : null;
    const pickSnos = (arr) =>
      Array.from(
        new Set(
          (Array.isArray(arr) ? arr : [])
            .map((x) => Number(x?.sno))
            .filter((n) => Number.isFinite(n))
        )
      );

    return {
      mqp: pickSnos(last?.mqp),
      visual: pickSnos(last?.visual),
    };
  } catch {
    return { mqp: [], visual: [] };
  }
}

// CMD+F: EDIT_BOM_COMPONENTS_HELPER
function deriveEditedBomComponents(
  editHistory /* from parseEditChanges(...) */
) {
  try {
    const evts = Array.isArray(editHistory) ? editHistory : [];
    // walk backwards to find the most recent event that actually changed BOM
    for (let i = evts.length - 1; i >= 0; i--) {
      const bom = evts[i]?.bom;
      if (!bom) continue;
      const { changed = [], added = [], removed = [] } = bom || {};
      const comps = [...changed, ...added, ...removed]
        .map((x) => x && x.component)
        .filter(Boolean);
      if (comps.length) return Array.from(new Set(comps));
    }
    return [];
  } catch {
    return [];
  }
}

// CMD+F: QAP_BOM_EDIT_EVENT_HELPER
async function appendBomEditAndReopenL2(qapId, by, bomDiff) {
  // 1) Load current history
  const r = await mssqlPool
    .request()
    .input("id", sql.UniqueIdentifier, qapId)
    .query("SELECT editChanges FROM QAPs WHERE id=@id");
  const history = (() => {
    try {
      return JSON.parse(r.recordset[0]?.editChanges || "[]");
    } catch {
      return [];
    }
  })();

  // 2) Push a BOM-only edit event
  history.push({
    by: by || "system",
    at: new Date().toISOString(),
    header: [],
    mqp: [],
    visual: [],
    bom: bomDiff || { changed: [], added: [], removed: [] },
    scope: "reset-level-2",
  });

  // 3) Stamp edit fields
  await mssqlPool
    .request()
    .input("id", sql.UniqueIdentifier, qapId)
    .input("editedBy", sql.NVarChar, by || "system")
    .input("editChanges", sql.NVarChar, JSON.stringify(history)).query(`
      UPDATE QAPs
      SET editedBy=@editedBy,
          editedAt=SYSUTCDATETIME(),
          lastModifiedAt=SYSUTCDATETIME(),
          editChanges=@editChanges
      WHERE id=@id
    `);

  // 4) Reset L2 acks and push back to Level-2
  await mssqlPool
    .request()
    .input("id", sql.UniqueIdentifier, qapId)
    .query(
      `UPDATE LevelResponses SET acknowledged=0 WHERE qapId=@id AND level=2`
    );

  await mssqlPool.request().input("id", sql.UniqueIdentifier, qapId).query(`
      UPDATE QAPs
      SET status='level-2',
          currentLevel=2,
          lastModifiedAt=SYSUTCDATETIME()
      WHERE id=@id
    `);

  await mssqlPool
    .request()
    .input("qapId", sql.UniqueIdentifier, qapId)
    .input("user", sql.NVarChar, by || "system")
    .input("ts", sql.DateTime2, new Date()).query(`
      INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
      VALUES (@qapId, 2, 'BOM updated; reopened Level 2', @user, @ts)
    `);
}

// ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// serve static uploads
app.use("/uploads", express.static(uploadDir));

// serve frontend static files
const distDir = path.join(__dirname, "../dist");
const indexHtml = path.join(distDir, "../index.html");

// serve SPA + static assets
app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(indexHtml);
});

// multer setup
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const name = `${base}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

// max file size 100MB
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 10MB
});

function safeParseJson(s, fallback = null) {
  if (!s || typeof s !== "string") return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function ymd(val) {
  if (!val) return "";
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val))
    return val.slice(0, 10);
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fileUrl(req, filename) {
  return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
}

// Map a SalesRequests master row (+ files) to the FE shape
function inflateSalesRequestRow(row, filesMap = {}) {
  const otherFiles = filesMap[row.id] || [];
  const dist = safeParseJson(row.wattageBinningDist, []);
  const bom = safeParseJson(row.bom, null);

  // derive bomFrom for UI from legacy columns
  const bomFrom =
    (row.primaryBom && row.primaryBom.toLowerCase() === "yes") ||
    row.primaryBomAttachmentUrl
      ? "Customer"
      : "Premier Energies";

  return {
    id: String(row.id),
    projectCode: row.projectCode || makeSrProjectCodeFromBody(row),
    customerName: row.customerName,
    moduleManufacturingPlant: String(
      row.moduleManufacturingPlant || ""
    ).toUpperCase(),
    cellType: row.cellType, // 'DCR' | 'NDCR'

    // new optional sub-fields
    moduleCellType: row.moduleCellType || null,
    cellTech: row.cellTech || null,
    cutCells: row.cutCells != null ? String(row.cutCells) : null,
    certificationRequired: row.certificationRequired || undefined,

    wattageBinningDist: Array.isArray(dist) ? dist : [],
    rfqOrderQtyMW: Number(row.rfqOrderQtyMW) || 0,
    premierBiddedOrderQtyMW:
      row.premierBiddedOrderQtyMW != null
        ? Number(row.premierBiddedOrderQtyMW)
        : null,
    deliveryStartDate: ymd(row.deliveryStartDate),
    deliveryEndDate: ymd(row.deliveryEndDate),
    projectLocation: row.projectLocation || "",
    cableLengthRequired: Number(row.cableLengthRequired) || 0,

    qapType: row.qapType,
    qapTypeAttachmentUrl: row.qapTypeAttachmentUrl || null,

    bomFrom,
    primaryBomAttachmentUrl: row.primaryBomAttachmentUrl || null,

    inlineInspection: yesNo(row.inlineInspection),
    pdi: yesNo(row.pdi),
    cellProcuredBy: row.cellProcuredBy,
    agreedCTM: Number(row.agreedCTM) || 0,
    factoryAuditTentativeDate: ymd(row.factoryAuditTentativeDate) || null,
    xPitchMm: row.xPitchMm != null ? Number(row.xPitchMm) : null,
    trackerDetails:
      row.trackerDetails != null ? Number(row.trackerDetails) : null,
    priority: row.priority || "low",
    remarks: row.remarks || null,

    otherAttachments: otherFiles.map((f) => ({
      title: f.title || "",
      url: f.url,
    })),

    createdBy: row.createdBy,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString(),

    bom: bom,
  };
}

// small diff helper for history logging
function buildDiff(before, after, fields) {
  const out = [];
  for (const f of fields) {
    const b = before?.[f];
    const a = after?.[f];
    const norm = (v) => (typeof v === "object" ? JSON.stringify(v) : v);
    if (norm(b) !== norm(a))
      out.push({ field: f, before: b ?? null, after: a ?? null });
  }
  return out;
}

// CMD+F: BOM_DIFF_HELPER
function computeBomDiff(prev, next) {
  const out = { changed: [], added: [], removed: [] };
  try {
    const a = prev || {};
    const b = next || {};

    // Track a few top-level fields (prefix with __ to mark non-component)
    const topFields = [
      "vendorName",
      "rfidLocation",
      "technologyProposed",
      "vendorAddress",
      "documentRef",
      "moduleWattageWp",
      "moduleDimensionsOption",
      "moduleModelNumber",
    ];
    for (const f of topFields) {
      if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) {
        out.changed.push({
          component: `__${f}`,
          before: a[f] ?? null,
          after: b[f] ?? null,
        });
      }
    }

    const ai = new Map((a.components || []).map((c) => [c.name, c]));
    const bi = new Map((b.components || []).map((c) => [c.name, c]));

    // Added components
    for (const name of bi.keys()) {
      if (!ai.has(name))
        out.added.push({ component: name, after: bi.get(name) });
    }
    // Removed components
    for (const name of ai.keys()) {
      if (!bi.has(name))
        out.removed.push({ component: name, before: ai.get(name) });
    }
    // Changed component rows
    for (const name of bi.keys()) {
      if (!ai.has(name)) continue;
      const ar = JSON.stringify(ai.get(name).rows || []);
      const br = JSON.stringify(bi.get(name).rows || []);
      if (ar !== br) {
        out.changed.push({
          component: name,
          before: JSON.parse(ar),
          after: JSON.parse(br),
        });
      }
    }
  } catch {}
  return out;
}

// POST /api/login → sets { token } cookie + returns user payload
app.post(
  "/api/login",
  [body("username").isString(), body("password").isString()],
  handleValidation,
  async (req, res) => {
    const { username, password } = req.body;
    let user;

    // try MSSQL first, fallback to MySQL
    await tryMssql(async (db) => {
      if (db === mssqlPool) {
        const r = await mssqlPool
          .request()
          .input("u", sql.NVarChar, username)
          .query(
            "SELECT id,username,passwordHash,role,plant FROM Users WHERE username=@u"
          );
        if (r.recordset.length) user = r.recordset[0];
      }
    });

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      plant: user.plant,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // In dev on localhost, don’t use Secure (self-signed certs) and relax SameSite
    const isLocalhost =
      req.hostname === "localhost" || req.hostname === "127.0.0.1";
    const inProd = process.env.NODE_ENV === "production" && !isLocalhost;
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: inProd ? "strict" : "lax",
        secure: inProd, // avoids Chrome dropping cookies on self-signed localhost
      })
      .json({ user: payload });
  }
);

// POST /api/logout → clears cookie
app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

// GET /api/me → returns current user from JWT
app.get("/api/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/users (admin only) → list all users
app.get(
  "/api/users",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      let users;
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          const r = await mssqlPool
            .request()
            .query(`SELECT id, username, role, plant FROM Users`);
          users = r.recordset;
        }
      });
      res.json(users);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/users (admin only) → create user
app.post(
  "/api/users",
  [
    authenticateToken,
    authorizeRole("admin"),
    body("username").isString(),
    body("password").isLength({ min: 6 }),
    body("role").isIn([
      "requestor",
      "production",
      "quality",
      "technical",
      "head",
      "technical-head",
      "plant-head",
      "admin",
    ]),
    body("plant").optional().isString(),
  ],
  handleValidation,
  async (req, res) => {
    const { username, password, role, plant } = req.body;
    const hash = await bcrypt.hash(password, 10);
    try {
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          await mssqlPool
            .request()
            .input("u", sql.NVarChar, username)
            .input("h", sql.NVarChar, hash)
            .input("r", sql.NVarChar, role)
            .input("p", sql.NVarChar, plant || null).query(`
            INSERT INTO Users (username,passwordHash,role,plant)
            VALUES (@u,@h,@r,@p)
          `);
        }
      });
      res.status(201).json({ message: "User created" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/users/:id (admin only) → update user (password, role, plant)
app.put(
  "/api/users/:id",
  [
    authenticateToken,
    authorizeRole("admin"),
    param("id").isUUID(),
    body("password").optional().isLength({ min: 6 }),
    body("role")
      .optional()
      .isIn([
        "requestor",
        "production",
        "quality",
        "technical",
        "head",
        "technical-head",
        "plant-head",
        "admin",
      ]),
    body("plant").optional().isString(),
  ],
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    const { password, role, plant } = req.body;
    const fields = [];
    const inputs = {};
    if (password) {
      inputs.h = await bcrypt.hash(password, 10);
      fields.push(`passwordHash=@h`);
    }
    if (role) {
      inputs.r = role;
      fields.push(`role=@r`);
    }
    if (plant !== undefined) {
      inputs.p = plant;
      fields.push(`plant=@p`);
    }
    if (!fields.length)
      return res.status(400).json({ message: "Nothing to update" });

    try {
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          let reqt = mssqlPool.request().input("id", sql.UniqueIdentifier, id);
          for (const k in inputs) reqt = reqt.input(k, sql.NVarChar, inputs[k]);
          await reqt.query(`
          UPDATE Users SET ${fields.join(",")} WHERE id=@id
        `);
        }
      });
      res.json({ message: "User updated" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// DELETE /api/users/:id (admin only) → delete user
app.delete(
  "/api/users/:id",
  authenticateToken,
  authorizeRole("admin"),
  param("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("DELETE FROM Users WHERE id=@id");
        }
      });
      res.json({ message: "User deleted" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// fetch BOM master from DB
async function fetchBomFromDb() {
  const q = `
    SELECT
      c.name     AS compName,
      c.position AS compPos,
      o.id       AS optId,
      o.model,
      o.subVendor,
      o.spec
    FROM dbo.BomComponents c
    LEFT JOIN dbo.BomComponentOptions o
      ON o.componentName = c.name
    ORDER BY
      CASE WHEN c.position IS NULL THEN 1 ELSE 0 END,
      c.position, c.name, o.id
  `;
  const { recordset: rows } = await mssqlPool.request().query(q);

  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.compName)) {
      map.set(r.compName, { id: r.compName, name: r.compName, options: [] });
    }
    if (r.optId != null) {
      map.get(r.compName).options.push({
        model: r.model,
        subVendor: r.subVendor,
        spec: r.spec,
      });
    }
  }
  return [...map.values()];
}

// regenerate bomMaster.ts from DB
async function upsertBomTsFromDb() {
  try {
    const list = await fetchBomFromDb();
    if (!Array.isArray(list) || list.length === 0) {
      console.warn("BOM DB is empty → skipping bomMaster.ts regeneration");
      return;
    }
    fs.writeFileSync(BOM_TS, generateBomTs(list), "utf-8");
  } catch (e) {
    console.warn("Skipping bomMaster.ts regeneration:", e.message || e);
  }
}

function buildBomFallbackFromList(list, srLike) {
  const tech = String(
    srLike?.moduleCellType || srLike?.moduleOrderType || "M10"
  ).toUpperCase();

  return {
    vendorName: "Premier Energies",
    rfidLocation: "Near junction box",
    technologyProposed: tech,
    vendorAddress: "",
    documentRef: `PE-BOM-${tech}-${new Date()
      .toISOString()
      .slice(0, 10)} Rev.1`,
    moduleWattageWp: 0,
    moduleDimensionsOption: "",
    moduleModelNumber: "",
    components: list.map((c) => ({
      name: c.name,
      rows: (c.options || []).map((o) => ({
        model: o.model,
        subVendor: o.subVendor ?? null,
        spec: o.spec ?? null,
      })),
    })),
  };
}

// GET /api/qaps → list all QAPs (with optional filters)  [UPDATED: embeds salesRequest]
app.get("/api/qaps", authenticateToken, async (req, res) => {
  const { status, plant } = req.query;
  const filters = [];
  const inputs = {};
  if (status) {
    filters.push("status=@status");
    inputs.status = status;
  }
  if (plant) {
    filters.push("plant=@plant");
    inputs.plant = plant;
  }

  try {
    // 1) fetch all master rows
    let masters;
    await tryMssql(async (db) => {
      if (db === mssqlPool) {
        let rq = mssqlPool.request();
        if (inputs.status) rq = rq.input("status", sql.NVarChar, inputs.status);
        if (inputs.plant) rq = rq.input("plant", sql.NVarChar, inputs.plant);
        const q =
          "SELECT * FROM QAPs" +
          (filters.length ? ` WHERE ${filters.join(" AND ")}` : "");
        const { recordset } = await rq.query(q);
        masters = recordset;
      }
    });

    const ids = masters.map((m) => m.id);
    if (ids.length === 0) return res.json([]);

    // 2) fetch all MQP specs in one go
    let allMqp, allVis, allResp;
    await tryMssql(async (db) => {
      const inClause = ids.map((_, i) => `@id${i}`).join(",");
      const idInputs = ids.reduce((acc, id, i) => {
        acc[`id${i}`] = id;
        return acc;
      }, {});
      if (db === mssqlPool) {
        let rm = mssqlPool.request(),
          rv = mssqlPool.request(),
          rr = mssqlPool.request();
        for (let [k, v] of Object.entries(idInputs)) {
          rm = rm.input(k, sql.UniqueIdentifier, v);
          rv = rv.input(k, sql.UniqueIdentifier, v);
          rr = rr.input(k, sql.UniqueIdentifier, v);
        }
        const mqpQ = `SELECT * FROM MQPSpecs WHERE qapId IN (${inClause}) ORDER BY sno`;
        const visQ = `SELECT * FROM VisualSpecs WHERE qapId IN (${inClause}) ORDER BY sno`;
        const respQ = `SELECT * FROM LevelResponses WHERE qapId IN (${inClause})`;
        allMqp = (await rm.query(mqpQ)).recordset;
        allVis = (await rv.query(visQ)).recordset;
        allResp = (await rr.query(respQ)).recordset;
      }
    });

    // 3) SALES REQUESTS: fetch & inflate all referenced SRs and attach per QAP
    let srById = {};
    const srIds = Array.from(
      new Set(
        masters
          .map((m) => m.salesRequestId)
          .filter((x) => x && String(x).length > 0)
      )
    );

    if (srIds.length) {
      let srMasters = [];
      let srFiles = [];
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          // masters
          {
            const inClause = srIds.map((_, i) => `@sid${i}`).join(",");
            let rq = mssqlPool.request();
            srIds.forEach(
              (id, i) => (rq = rq.input(`sid${i}`, sql.UniqueIdentifier, id))
            );
            srMasters = (
              await rq.query(
                `SELECT * FROM SalesRequests WHERE id IN (${inClause})`
              )
            ).recordset;
          }
          // files
          if (srMasters.length) {
            const inClause = srIds.map((_, i) => `@fid${i}`).join(",");
            let rf = mssqlPool.request();
            srIds.forEach(
              (id, i) => (rf = rf.input(`fid${i}`, sql.UniqueIdentifier, id))
            );
            srFiles = (
              await rf.query(
                `SELECT * FROM SalesRequestFiles WHERE salesRequestId IN (${inClause}) ORDER BY id`
              )
            ).recordset;
          }
        }
      });

      const filesMap = srFiles.reduce((acc, f) => {
        (acc[f.salesRequestId] ||= []).push(f);
        return acc;
      }, {});
      srById = srMasters.reduce((acc, row) => {
        acc[row.id] = inflateSalesRequestRow(row, filesMap);
        return acc;
      }, {});

      // If SR has no BOM JSON, hydrate a read-only fallback from DB master
      const bomList = await fetchBomFromDb();
      for (const sid of Object.keys(srById)) {
        if (!srById[sid]?.bom) {
          srById[sid].bom = buildBomFallbackFromList(bomList, srById[sid]);
        }
      }
    }

    // 4) group by qapId
    const groupBy = (arr, keyFn) =>
      arr.reduce((acc, x) => {
        const k = keyFn(x);
        (acc[k] || (acc[k] = [])).push(x);
        return acc;
      }, {});
    const mqpMap = groupBy(allMqp, (r) => r.qapId);
    const visMap = groupBy(allVis, (r) => r.qapId);
    const respMap = groupBy(allResp, (r) => r.qapId);

    // 5) assemble final result (embed salesRequest)
    // 5) assemble final result (embed salesRequest)
    const result = masters.map((m) => {
      const editCommentsParsed = parseEditChanges(m);
      const editedSnos = deriveEditedSnos(editCommentsParsed);
      const editedBomComponents = deriveEditedBomComponents(editCommentsParsed);

      return {
        ...m,

        // ── nest specs ──────────────────────────────────────────────
        specs: {
          mqp: mqpMap[m.id] || [],
          visual: visMap[m.id] || [],
        },

        // ── level-responses as level → role → details ───────────────
        levelResponses: (respMap[m.id] || []).reduce((o, r) => {
          o[r.level] = o[r.level] || {};
          o[r.level][r.role] = {
            username: r.username,
            acknowledged: r.acknowledged === 1 || r.acknowledged === true,
            comments: coerceCommentsToThread(
              r.comments,
              r.username,
              r.respondedAt
            ),
            respondedAt: r.respondedAt,
          };
          return o;
        }, {}),

        // ── convenience: parsed per-item final comments ─────────────
        finalCommentsPerItem:
          m.finalComments && m.finalComments.trim().startsWith("{")
            ? JSON.parse(m.finalComments)
            : {},

        // ── expose edit history + latest deltas to FE ───────────────
        editCommentsParsed,
        editedSnos,
        editedBomComponents,

        // (optional) a flat L2 feed for parity with /api/qaps/:id and /for-review
        level2CommentFeed: flattenLevel2Feed(respMap[m.id] || []),

        // ── embed the linked Sales Request (if any) ─────────────────
        salesRequest:
          m.salesRequestId && srById[m.salesRequestId]
            ? srById[m.salesRequestId]
            : undefined,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("GET /api/qaps error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/qaps/for-review → list QAPs with unmatched items for this user’s role  [UPDATED: embeds salesRequest]
app.get("/api/qaps/for-review", authenticateToken, async (req, res) => {
  const userRole = req.user.role;
  const userPlants = (req.user.plant || "")
    .split(",")
    .map((p) => p.trim().toLowerCase());
  const level = 2;

  try {
    // 1) Fetch only masters at currentLevel=2
    let masters;
    await tryMssql(async (db) => {
      if (db === mssqlPool) {
        masters = (
          await mssqlPool
            .request()
            .input("lvl", sql.Int, level)
            .query("SELECT * FROM QAPs WHERE currentLevel=@lvl")
        ).recordset;
      }
    });

    // 2) Filter by plant(s)
    masters = masters.filter((q) => userPlants.includes(q.plant.toLowerCase()));
    if (!masters.length) return res.json([]);

    const ids = masters.map((m) => m.id);

    // 3) Bulk-fetch specs & responses
    let allMqp, allVis, allResp;
    await tryMssql(async (db) => {
      if (db === mssqlPool) {
        const inClause = ids.map((_, i) => `@id${i}`).join(",");
        let r = mssqlPool.request();
        ids.forEach(
          (id, i) => (r = r.input(`id${i}`, sql.UniqueIdentifier, id))
        );
        allMqp = (
          await r.query(
            `SELECT * FROM MQPSpecs   WHERE qapId IN (${inClause}) ORDER BY sno`
          )
        ).recordset;
        allVis = (
          await r.query(
            `SELECT * FROM VisualSpecs WHERE qapId IN (${inClause}) ORDER BY sno`
          )
        ).recordset;
        allResp = (
          await r.query(
            `SELECT * FROM LevelResponses WHERE qapId IN (${inClause})`
          )
        ).recordset;
      }
    });

    // 4) SALES REQUESTS for these masters
    let srById = {};
    const srIds = Array.from(
      new Set(
        masters
          .map((m) => m.salesRequestId)
          .filter((x) => x && String(x).length > 0)
      )
    );
    if (srIds.length) {
      let srMasters = [];
      let srFiles = [];
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          // masters
          {
            const inClause = srIds.map((_, i) => `@sid${i}`).join(",");
            let rq = mssqlPool.request();
            srIds.forEach(
              (id, i) => (rq = rq.input(`sid${i}`, sql.UniqueIdentifier, id))
            );
            srMasters = (
              await rq.query(
                `SELECT * FROM SalesRequests WHERE id IN (${inClause})`
              )
            ).recordset;
          }
          // files
          if (srMasters.length) {
            const inClause = srIds.map((_, i) => `@fid${i}`).join(",");
            let rf = mssqlPool.request();
            srIds.forEach(
              (id, i) => (rf = rf.input(`fid${i}`, sql.UniqueIdentifier, id))
            );
            srFiles = (
              await rf.query(
                `SELECT * FROM SalesRequestFiles WHERE salesRequestId IN (${inClause}) ORDER BY id`
              )
            ).recordset;
          }
        }
      });
      const filesMap = srFiles.reduce((acc, f) => {
        (acc[f.salesRequestId] ||= []).push(f);
        return acc;
      }, {});
      srById = srMasters.reduce((acc, row) => {
        acc[row.id] = inflateSalesRequestRow(row, filesMap);
        return acc;
      }, {});
      const bomList = await fetchBomFromDb();
      for (const sid of Object.keys(srById)) {
        if (!srById[sid]?.bom) {
          srById[sid].bom = buildBomFallbackFromList(bomList, srById[sid]);
        }
      }
    }

    // 5) Group by qapId
    const groupBy = (arr, key) =>
      arr.reduce((acc, x) => {
        (acc[x[key]] = acc[x[key]] || []).push(x);
        return acc;
      }, {});
    const mqpMap = groupBy(allMqp, "qapId");
    const visMap = groupBy(allVis, "qapId");
    const respMap = groupBy(allResp, "qapId");

    // 6) Assemble + filter out any QAP with NO unmatched items for this role
    // CMD+F: FOR_REVIEW_L3_VISIBILITY — expose L2 comments + edit changes to Level-3 list
    const reviewable = masters
      .map((m) => {
        const specs = [...(mqpMap[m.id] || []), ...(visMap[m.id] || [])];

        const rawResp = respMap[m.id] || [];
        const levelResponsesNested = nestResponses(rawResp);
        const level2CommentFeed = flattenLevel2Feed(rawResp);
        const editCommentsParsed = parseEditChanges(m);
        // CMD+F: INCLUDE_EDIT_SNOS_CONST_FOR_REVIEW
        const editedSnos = deriveEditedSnos(editCommentsParsed);
        // NEW: list of BOM component names touched in the latest edit event
        const editedBomComponents =
          deriveEditedBomComponents(editCommentsParsed);

        return {
          ...m,
          specs: {
            mqp: mqpMap[m.id] || [],
            visual: visMap[m.id] || [],
          },
          levelResponses: levelResponsesNested,
          level2CommentFeed,
          editCommentsParsed,
          editedSnos,
          editedBomComponents,
          // embed SR for the UI BOM tab
          salesRequest:
            m.salesRequestId && srById[m.salesRequestId]
              ? srById[m.salesRequestId]
              : undefined,
        };
      })
      .filter((qap) => {
        const roleLc = String(userRole || "").toLowerCase();
        return [...qap.specs.mqp, ...qap.specs.visual].some((spec) =>
          rolesCsvToArrayLower(spec.reviewBy).includes(roleLc)
        );
      });

    res.json(reviewable);
  } catch (err) {
    console.error("GET /api/qaps/for-review error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/qaps/:id → get full details of a QAP  [UPDATED: embeds salesRequest]
app.get(
  "/api/qaps/:id",
  authenticateToken,
  param("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      let master, mqp, visual, resp, tl;

      // master
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          const r = await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("SELECT * FROM QAPs WHERE id=@id");
          master = r.recordset[0] || null;
        }
      });
      if (!master) return res.status(404).json({ message: "Not found" });

      // MQP specs
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          const r = await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("SELECT * FROM MQPSpecs WHERE qapId=@id ORDER BY sno");
          mqp = r.recordset;
        }
      });

      // Visual specs
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          const r = await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("SELECT * FROM VisualSpecs WHERE qapId=@id ORDER BY sno");
          visual = r.recordset;
        }
      });

      // LevelResponses
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          const r = await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("SELECT * FROM LevelResponses WHERE qapId=@id");
          resp = r.recordset;
        }
      });

      // TimelineEntries
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          const r = await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query(
              "SELECT * FROM TimelineEntries WHERE qapId=@id ORDER BY entryId"
            );
          tl = r.recordset;
        }
      });

      // Sales Request (optional embed)
      let embeddedSalesRequest;
      if (master.salesRequestId) {
        let srRow, srFiles;
        await tryMssql(async (db) => {
          if (db === mssqlPool) {
            srRow = (
              await mssqlPool
                .request()
                .input("sid", sql.UniqueIdentifier, master.salesRequestId)
                .query("SELECT * FROM SalesRequests WHERE id=@sid")
            ).recordset[0];
            if (srRow) {
              srFiles = (
                await mssqlPool
                  .request()
                  .input("sid", sql.UniqueIdentifier, master.salesRequestId)
                  .query(
                    "SELECT * FROM SalesRequestFiles WHERE salesRequestId=@sid ORDER BY id"
                  )
              ).recordset;
            }
          }
        });
        if (srRow) {
          const filesMap = { [srRow.id]: srFiles || [] };
          embeddedSalesRequest = inflateSalesRequestRow(srRow, filesMap);
        }
        if (embeddedSalesRequest && !embeddedSalesRequest.bom) {
          const bomList = await fetchBomFromDb();
          embeddedSalesRequest.bom = buildBomFallbackFromList(
            bomList,
            embeddedSalesRequest
          );
        }
      }

      // CMD+F: SHOW_L2_COMMENTS_TO_L3
      const levelResponsesNested = nestResponses(resp || []);
      const level2CommentFeed = flattenLevel2Feed(resp || []);
      const editCommentsParsed = parseEditChanges(master);
      const editedSnos = deriveEditedSnos(editCommentsParsed);
      const editedBomComponents = deriveEditedBomComponents(editCommentsParsed);
      return res.json({
        ...master,
        specs: { mqp, visual },
        // parsed & nested for consistent UI usage
        levelResponses: levelResponsesNested,
        // CMD+F: L2_COMMENT_FEED_FOR_L3 — a flat feed for Level-3 UI
        level2CommentFeed,
        // CMD+F: EDIT_COMMENTS_FOR_L3 — parsed edit history for Level-3 UI
        editCommentsParsed,
        editedSnos,
        editedBomComponents,
        // keep timeline
        timeline: tl,
        // convenience: parsed per-item final comments (for parity with /api/qaps)
        finalCommentsPerItem:
          master.finalComments && master.finalComments.trim().startsWith("{")
            ? JSON.parse(master.finalComments)
            : {},
        salesRequest: embeddedSalesRequest,
      });
    } catch (e) {
      console.error("GET /api/qaps/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/qaps → create a new QAP  [UPDATED: accepts salesRequestId]
app.post(
  "/api/qaps",
  [
    authenticateToken,
    body("customerName").isString(),
    body("projectName").isString(),
    body("projectCode").optional().isString(),
    body("orderQuantity").isInt({ gt: 0 }),
    body("productType").isString(),
    body("plant").isString(),
    body("status").isString(),
    body("currentLevel").isInt({ min: 1, max: 5 }),
    body("specs").isObject(),
    body("salesRequestId").optional().isUUID(), // <── NEW
    handleValidation,
  ],
  async (req, res) => {
    const {
      customerName,
      projectName,
      projectCode,
      orderQuantity,
      productType,
      plant,
      status,
      submittedBy,
      currentLevel,
      specs,
      salesRequestId, // <── NEW
    } = req.body;
    const newId = require("crypto").randomUUID();

    try {
      // validate the SR id if provided
      if (salesRequestId) {
        const vr = await mssqlPool
          .request()
          .input("sid", sql.UniqueIdentifier, salesRequestId)
          .query("SELECT id FROM SalesRequests WHERE id=@sid");
        if (!vr.recordset.length) {
          return res.status(400).json({ message: "Invalid salesRequestId" });
        }
      }

      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          // MSSQL master insert
          await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, newId)
            .input("c", sql.NVarChar, customerName)
            .input("p", sql.NVarChar, projectName)
            .input("pc", sql.NVarChar, projectCode || null)
            .input("o", sql.Int, orderQuantity)
            .input("pt", sql.NVarChar, productType)
            .input("pl", sql.NVarChar, plant)
            .input("s", sql.NVarChar, status)
            .input("sb", sql.NVarChar, submittedBy || null)
            .input("cl", sql.Int, currentLevel)
            .input(
              "srid",
              sql.UniqueIdentifier,
              salesRequestId ? salesRequestId : null
            ).query(`
              INSERT INTO QAPs (
                id, customerName, projectName, orderQuantity,
                productType, plant, status, submittedBy, submittedAt,
                currentLevel, createdAt, lastModifiedAt, projectCode, salesRequestId
              )
              VALUES (
                @id,@c,@p,@o,
                @pt,@pl,@s,@sb,SYSUTCDATETIME(),
                @cl,SYSUTCDATETIME(),SYSUTCDATETIME(),@pc, @srid
              );
            `);

          // MSSQL MQP specs insert
          for (const sp of specs.mqp || []) {
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, newId)
              .input("sno", sql.Int, sp.sno)
              .input("sub", sql.NVarChar, sp.subCriteria)
              .input("co", sql.NVarChar, sp.componentOperation)
              .input("ch", sql.NVarChar, sp.characteristics)
              .input("clz", sql.NVarChar, sp.class)
              .input("tc", sql.NVarChar, sp.typeOfCheck)
              .input("sm", sql.NVarChar, sp.sampling)
              .input("spx", sql.NVarChar, sp.specification)
              .input("m", sql.NVarChar, sp.match || null)
              .input("cs", sql.NVarChar, sp.customerSpecification || null)
              .input("rb", sql.NVarChar, normReviewBy(sp.reviewBy) || null)
              .query(`
                INSERT INTO MQPSpecs
                  (qapId,sno,subCriteria,componentOperation,characteristics,
                   class,typeOfCheck,sampling,specification,[match],
                   customerSpecification,reviewBy)
                VALUES
                  (@id,@sno,@sub,@co,@ch,@clz,@tc,@sm,@spx,@m,@cs,@rb);
              `);
          }

          // MSSQL Visual specs insert
          for (const sp of specs.visual || []) {
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, newId)
              .input("sno", sql.Int, sp.sno)
              .input("sub", sql.NVarChar, sp.subCriteria)
              .input("df", sql.NVarChar, sp.defect)
              .input("dc", sql.NVarChar, sp.defectClass)
              .input("ds", sql.NVarChar, sp.description)
              .input("clz", sql.NVarChar, sp.criteriaLimits)
              .input("m", sql.NVarChar, sp.match || null)
              .input("cs", sql.NVarChar, sp.customerSpecification || null)
              .input("rb", sql.NVarChar, normReviewBy(sp.reviewBy) || null)
              .query(`
                INSERT INTO VisualSpecs
                  (qapId,sno,subCriteria,defect,defectClass,description,
                   criteriaLimits,[match],customerSpecification,reviewBy)
                VALUES
                  (@id,@sno,@sub,@df,@dc,@ds,@clz,@m,@cs,@rb);
              `);
          }
        }
      });

      res.status(201).json({ id: newId });
    } catch (e) {
      console.error("POST /api/qaps error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/qaps/:id → update QAP and append edit audit event
app.put(
  "/api/qaps/:id",
  [
    authenticateToken,
    param("id").isUUID(),
    body("specs").optional().isObject(),
    handleValidation,
  ],
  async (req, res) => {
    const { id } = req.params;
    const {
      customerName,
      projectName,
      projectCode,
      orderQuantity,
      productType,
      plant,
      status,
      currentLevel,
      specs,
      salesRequestId,
      editMeta, // {header, mqp, visual, bom, scope}
    } = req.body;

    try {
      // 1) Load existing master (and current edit history)
      const masterRow =
        (
          await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("SELECT * FROM QAPs WHERE id=@id")
        ).recordset[0] || null;

      if (!masterRow) return res.status(404).json({ message: "Not found" });

      // 2) Build next edit history entry from client-provided diffs
      const historyPrev = (() => {
        try {
          return JSON.parse(masterRow.editChanges || "[]");
        } catch {
          return [];
        }
      })();

      // Load current specs BEFORE overwriting them
      const oldMqp = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT sno, specification, [match], customerSpecification, reviewBy FROM MQPSpecs WHERE qapId=@id"
          )
      ).recordset;
      const oldVis = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT sno, criteriaLimits, [match], customerSpecification, reviewBy FROM VisualSpecs WHERE qapId=@id"
          )
      ).recordset;

      const computedDiff = {
        header: diffHeader(masterRow, req.body),
        mqp: specs?.mqp ? diffSpecs(oldMqp, specs.mqp, "mqp") : [],
        visual: specs?.visual ? diffSpecs(oldVis, specs.visual, "visual") : [],
      };

      const hasClientMeta =
        editMeta &&
        ((Array.isArray(editMeta.header) && editMeta.header.length) ||
          (Array.isArray(editMeta.mqp) && editMeta.mqp.length) ||
          (Array.isArray(editMeta.visual) && editMeta.visual.length));

      const editEvent = {
        by: req.user?.username || "unknown",
        at: new Date().toISOString(),
        header: hasClientMeta ? editMeta.header || [] : computedDiff.header,
        mqp: hasClientMeta ? editMeta.mqp || [] : computedDiff.mqp,
        visual: hasClientMeta ? editMeta.visual || [] : computedDiff.visual,
        bom: (editMeta && editMeta.bom) || {
          changed: [],
          added: [],
          removed: [],
        },
        scope: (editMeta && editMeta.scope) || "none",
      };
      historyPrev.push(editEvent);
      const editChangesStr = JSON.stringify(historyPrev);

      // 3) Update master fields (keepIfPresent semantics)
      let rq = mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("editedBy", sql.NVarChar, req.user?.username || null)
        .input("editChanges", sql.NVarChar, editChangesStr);

      const sets = [
        "editedBy=@editedBy",
        "editedAt=SYSUTCDATETIME()",
        "lastModifiedAt=SYSUTCDATETIME()",
        "editChanges=@editChanges",
      ];

      if (!isBlank(customerName)) {
        rq = rq.input("customerName", sql.NVarChar, customerName);
        sets.push("customerName=@customerName");
      }
      if (!isBlank(projectName)) {
        rq = rq.input("projectName", sql.NVarChar, projectName);
        sets.push("projectName=@projectName");
      }
      if (!isBlank(projectCode)) {
        rq = rq.input("projectCode", sql.NVarChar, projectCode);
        sets.push("projectCode=@projectCode");
      }
      if (!isBlank(orderQuantity)) {
        rq = rq.input("orderQuantity", sql.Int, Number(orderQuantity));
        sets.push("orderQuantity=@orderQuantity");
      }
      if (!isBlank(productType)) {
        rq = rq.input("productType", sql.NVarChar, productType);
        sets.push("productType=@productType");
      }
      if (!isBlank(plant)) {
        rq = rq.input("plant", sql.NVarChar, plant);
        sets.push("plant=@plant");
      }
      if (!isBlank(status)) {
        rq = rq.input("status", sql.NVarChar, status);
        sets.push("status=@status");
      }
      if (!isBlank(currentLevel)) {
        rq = rq.input("currentLevel", sql.Int, Number(currentLevel));
        sets.push("currentLevel=@currentLevel");
      }
      if (!isBlank(salesRequestId)) {
        rq = rq.input("salesRequestId", sql.UniqueIdentifier, salesRequestId);
        sets.push("salesRequestId=@salesRequestId");
      }

      if (sets.length > 0) {
        await rq.query(`UPDATE QAPs SET ${sets.join(",")} WHERE id=@id`);
      }

      // 4) Replace specs if provided (simple approach: delete → insert)
      if (specs && (Array.isArray(specs.mqp) || Array.isArray(specs.visual))) {
        // MQP
        if (Array.isArray(specs.mqp)) {
          const prevMqpRB = (
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
              .query("SELECT sno, reviewBy FROM MQPSpecs WHERE qapId=@id")
          ).recordset.reduce((acc, r) => {
            acc[r.sno] = r.reviewBy || "";
            return acc;
          }, {});
          await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("DELETE FROM MQPSpecs WHERE qapId=@id");

          for (const sp of specs.mqp) {
            const rbRaw =
              typeof sp.reviewBy !== "undefined"
                ? sp.reviewBy
                : prevMqpRB[sp.sno];
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
              .input("sno", sql.Int, sp.sno)
              .input("sub", sql.NVarChar, sp.subCriteria || "")
              .input("co", sql.NVarChar, sp.componentOperation || "")
              .input("ch", sql.NVarChar, sp.characteristics || "")
              .input("clz", sql.NVarChar, sp.class || "")
              .input("tc", sql.NVarChar, sp.typeOfCheck || "")
              .input("sm", sql.NVarChar, sp.sampling || "")
              .input("spx", sql.NVarChar, sp.specification || "")
              .input("m", sql.NVarChar, sp.match || null)
              .input("cs", sql.NVarChar, sp.customerSpecification || null)
              .input("rb", sql.NVarChar, normReviewBy(rbRaw) || null).query(`
                INSERT INTO MQPSpecs
                  (qapId,sno,subCriteria,componentOperation,characteristics,
                   class,typeOfCheck,sampling,specification,[match],
                   customerSpecification,reviewBy)
                VALUES
                  (@id,@sno,@sub,@co,@ch,@clz,@tc,@sm,@spx,@m,@cs,@rb)
              `);
          }
        }

        // Visual/EL
        if (Array.isArray(specs.visual)) {
          const prevVisRB = (
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
              .query("SELECT sno, reviewBy FROM VisualSpecs WHERE qapId=@id")
          ).recordset.reduce((acc, r) => {
            acc[r.sno] = r.reviewBy || "";
            return acc;
          }, {});
          await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("DELETE FROM VisualSpecs WHERE qapId=@id");

          for (const sp of specs.visual) {
            const rbRaw =
              typeof sp.reviewBy !== "undefined"
                ? sp.reviewBy
                : prevVisRB[sp.sno];
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
              .input("sno", sql.Int, sp.sno)
              .input("sub", sql.NVarChar, sp.subCriteria || "")
              .input("df", sql.NVarChar, sp.defect || "")
              .input("dc", sql.NVarChar, sp.defectClass || "")
              .input("ds", sql.NVarChar, sp.description || "")
              .input("clz", sql.NVarChar, sp.criteriaLimits || "")
              .input("m", sql.NVarChar, sp.match || null)
              .input("cs", sql.NVarChar, sp.customerSpecification || null)
              .input("rb", sql.NVarChar, normReviewBy(rbRaw) || null).query(`
                INSERT INTO VisualSpecs
                  (qapId,sno,subCriteria,defect,defectClass,description,
                   criteriaLimits,[match],customerSpecification,reviewBy)
                VALUES
                  (@id,@sno,@sub,@df,@dc,@ds,@clz,@m,@cs,@rb)
              `);
          }
        }
      }

      // >>> L2_RESET_ON_EDIT (REWRITE)
      // Decide if we should force a Level 2 re-sign for all departments.
      // Triggers: explicit scope OR any header/mqp/visual/bom changes OR specs array replaced.
      const hasAnyEditMeta = !!(
        editMeta &&
        ((Array.isArray(editMeta.header) && editMeta.header.length) ||
          (Array.isArray(editMeta.mqp) && editMeta.mqp.length) ||
          (Array.isArray(editMeta.visual) && editMeta.visual.length) ||
          (editMeta.bom &&
            ((Array.isArray(editMeta.bom.changed) &&
              editMeta.bom.changed.length) ||
              (Array.isArray(editMeta.bom.added) &&
                editMeta.bom.added.length) ||
              (Array.isArray(editMeta.bom.removed) &&
                editMeta.bom.removed.length))))
      );

      const specsWereReplaced = !!(
        specs &&
        (Array.isArray(specs.mqp) || Array.isArray(specs.visual))
      );

      if (
        (editMeta &&
          (editMeta.scope === "reset-level-2" ||
            editMeta.scope === "reopen-level-2")) ||
        hasAnyEditMeta ||
        specsWereReplaced
      ) {
        // 1) Reset (do NOT delete) Level 2 responses so every department must respond again,
        //    preserving existing comment threads for Level-3 visibility
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            `UPDATE LevelResponses SET acknowledged=0 WHERE qapId=@id AND level=2`
          );

        // 2) Push the QAP back to Level 2
        await mssqlPool.request().input("id", sql.UniqueIdentifier, id).query(`
    UPDATE QAPs
    SET status='level-2',
        currentLevel=2,
        lastModifiedAt=SYSUTCDATETIME()
    WHERE id=@id;
  `);

        // 3) Timeline entry
        await mssqlPool
          .request()
          .input("qapId", sql.UniqueIdentifier, id)
          .input("user", sql.NVarChar, req.user?.username || "system")
          .input("ts", sql.DateTime2, new Date()).query(`
    INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
    VALUES (@qapId, 2, 'Reopened Level 2 after edit; all departments must respond again', @user, @ts);
  `);
      }
      // <<< L2_RESET_ON_EDIT

      // 5) Return updated master (with edit stamps)
      const updated =
        (
          await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query("SELECT * FROM QAPs WHERE id=@id")
        ).recordset[0] || null;

      res.json(updated);
    } catch (err) {
      console.error("PUT /api/qaps/:id error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// DELETE /api/qaps/:id → delete a QAP and all its specs, responses, timeline
app.delete(
  "/api/qaps/:id",
  authenticateToken,
  param("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          await mssqlPool.request().input("id", sql.UniqueIdentifier, id)
            .query(`
              DELETE FROM MQPSpecs        WHERE qapId=@id;
              DELETE FROM VisualSpecs     WHERE qapId=@id;
              DELETE FROM LevelResponses  WHERE qapId=@id;
              DELETE FROM TimelineEntries WHERE qapId=@id;
              DELETE FROM QAPs            WHERE id=@id;
            `);
        }
      });
      res.json({ message: "QAP deleted" });
    } catch (e) {
      console.error("DELETE /api/qaps/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/qaps/:id/responses → add/update a level response
app.post(
  "/api/qaps/:id/responses",
  [
    authenticateToken,
    authorizeRole(
      "production",
      "quality",
      "technical",
      "head",
      "technical-head"
    ),
    param("id").isUUID(),
    body("level").isInt({ min: 2, max: 4 }),
    body("comments").isObject(),
    handleValidation,
  ],
  async (req, res) => {
    const { id } = req.params;
    const { level, comments } = req.body;
    const responderRole = req.user.role; // from your JWT
    const respondedAt = new Date();

    const tx = new sql.Transaction(mssqlPool);
    try {
      await tx.begin();

      // 1) Upsert the reviewer’s response
      // 1) Load existing (if any) for this qapId+level+role
      const prev = (
        await tx
          .request()
          .input("qapId", sql.UniqueIdentifier, id)
          .input("lvl", sql.Int, level)
          .input("rl", sql.NVarChar, responderRole)
          .query(`SELECT username, respondedAt, comments
            FROM LevelResponses
            WHERE qapId=@qapId AND level=@lvl AND role=@rl`)
      ).recordset[0];

      const threadPrev = coerceCommentsToThread(
        prev?.comments,
        prev?.username,
        prev?.respondedAt
      );

      // 2) Build the new entry we want to append
      const entry = {
        by: req.user.username,
        at: respondedAt.toISOString(),
        // comments is the posted payload: { [sno:number]: string }
        responses: comments || {},
      };

      // 3) Upsert with appended thread
      const cmJson = JSON.stringify([...threadPrev, entry]);

      const upsert = tx.request();
      upsert
        .input("qapId", sql.UniqueIdentifier, id)
        .input("lvl", sql.Int, level)
        .input("rl", sql.NVarChar, responderRole)
        .input("un", sql.NVarChar, req.user.username)
        .input("ack", sql.Bit, 1)
        .input("dt", sql.DateTime2, respondedAt)
        .input("cm", sql.NVarChar, cmJson);

      await upsert.query(`
  MERGE LevelResponses AS T
  USING (SELECT @qapId AS qapId, @lvl AS level, @rl AS role) AS S
    ON T.qapId=S.qapId AND T.level=S.level AND T.role=S.role
  WHEN MATCHED THEN
    UPDATE SET username=@un, acknowledged=@ack, respondedAt=@dt, comments=@cm
  WHEN NOT MATCHED THEN
    INSERT (qapId, level, role, username, acknowledged, respondedAt, comments)
    VALUES (@qapId, @lvl, @rl, @un, @ack, @dt, @cm);
`);

      // 3) If this was Level 2, see if *all* required roles have now responded…
      // 3) If this was Level 2, see if *all* required roles have now responded…
      // 3) If this was Level 2, require ALL departments listed in any reviewBy to respond
      if (level === 2) {
        // Gather required roles from ALL rows (MQP + Visual), regardless of match
        const mqpAll = (
          await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .query(
              `SELECT reviewBy FROM MQPSpecs WHERE qapId=@qapId AND ISNULL(reviewBy,'') <> ''`
            )
        ).recordset;

        const visAll = (
          await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .query(
              `SELECT reviewBy FROM VisualSpecs WHERE qapId=@qapId AND ISNULL(reviewBy,'') <> ''`
            )
        ).recordset;

        const required = Array.from(
          new Set(
            [...mqpAll, ...visAll].flatMap((r) =>
              rolesCsvToArrayLower(r.reviewBy)
            )
          )
        );

        // Who has already responded at Level 2?
        const doneRows = (
          await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .input("lvl2", sql.Int, level)
            .query(
              `SELECT role FROM LevelResponses WHERE qapId=@qapId AND level=@lvl2 AND acknowledged=1`
            )
        ).recordset;
        const done = doneRows.map((r) => String(r.role || "").toLowerCase());

        // Advance only when every required role has responded
        if (required.length > 0 && required.every((r) => done.includes(r))) {
          // fetch plant
          const { recordset } = await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .query(`SELECT plant FROM QAPs WHERE id=@qapId`);
          const plant = recordset[0]?.plant?.trim()?.toLowerCase();

          if (plant === "p2") {
            await tx
              .request()
              .input("qapId", sql.UniqueIdentifier, id)
              .input("newLvl", sql.Int, 4).query(`
        UPDATE QAPs
        SET status='level-4',
            currentLevel=@newLvl,
            lastModifiedAt=SYSUTCDATETIME()
        WHERE id=@qapId;
      `);
            await tx
              .request()
              .input("qapId", sql.UniqueIdentifier, id)
              .input("ts2", sql.DateTime2, new Date()).query(`
        INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
        VALUES (@qapId, 2, 'Level 2 completed, skipped Level 3, sent to Level 4', 'system', @ts2);
      `);
          } else {
            await tx
              .request()
              .input("qapId", sql.UniqueIdentifier, id)
              .input("newLvl", sql.Int, 3).query(`
        UPDATE QAPs
        SET status='level-3',
            currentLevel=@newLvl,
            lastModifiedAt=SYSUTCDATETIME()
        WHERE id=@qapId;
      `);
            await tx
              .request()
              .input("qapId", sql.UniqueIdentifier, id)
              .input("ts2", sql.DateTime2, new Date()).query(`
        INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
        VALUES (@qapId, 2, 'Level 2 completed, sent to Level 3', 'system', @ts2);
      `);
          }
        }
      }

      // 4) If this was Level 3, automatically advance to Level 4
      if (level === 3) {
        await tx
          .request()
          .input("qapId", sql.UniqueIdentifier, id)
          .input("newLvl", sql.Int, 4).query(`
            UPDATE QAPs
            SET status='level-4',
                currentLevel=@newLvl,
                lastModifiedAt=SYSUTCDATETIME()
            WHERE id=@qapId;
          `);

        await tx
          .request()
          .input("qapId", sql.UniqueIdentifier, id)
          .input("ts3", sql.DateTime2, new Date()).query(`
            INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
            VALUES (@qapId, 3, 'Level 3 completed, sent to Level 4', 'system', @ts3);
          `);
      }

      // 5) If this was Level 4, send back to Requestor for final comments
      if (level === 4) {
        await tx
          .request()
          .input("qapId", sql.UniqueIdentifier, id)
          .input("newLvl", sql.Int, 5).query(`
            UPDATE QAPs
            SET status='final-comments',
                currentLevel=@newLvl,
                lastModifiedAt=SYSUTCDATETIME()
            WHERE id=@qapId;
          `);

        await tx
          .request()
          .input("qapId", sql.UniqueIdentifier, id)
          .input("ts4", sql.DateTime2, new Date()).query(`
            INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
            VALUES (@qapId, 4, 'Level 4 completed, sent back to Requestor for Final Comments', 'system', @ts4);
          `);
      }

      // 6) commit all changes
      await tx.commit();
      return res.json({ message: "Response recorded" });
    } catch (err) {
      await tx.rollback();
      console.error("❌ POST /api/qaps/:id/responses error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/qaps/:id/final-comments → add final comments + optional attachment, advance to Level 5
app.post(
  "/api/qaps/:id/final-comments",
  authenticateToken,
  authorizeRole("requestor", "admin"),
  upload.single("attachment"),
  param("id").isUUID(),
  body("comments").isString(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    const { comments } = req.body;
    const username = req.user.username;
    const now = new Date();

    try {
      // 1) Update final comments (and optional attachment)
      const rq = mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("fc", sql.NVarChar, comments)
        .input("by", sql.NVarChar, username)
        .input("at", sql.DateTime2, now);

      if (req.file) {
        const fileName = req.file.filename;
        const fileUrl = `${
          process.env.APP_URL || "http://localhost:4000"
        }/uploads/${fileName}`;
        rq.input("fan", sql.NVarChar, fileName).input(
          "fau",
          sql.NVarChar,
          fileUrl
        );

        await rq.query(`
          UPDATE QAPs
          SET finalComments        = @fc,
              finalCommentsBy      = @by,
              finalCommentsAt      = @at,
              finalAttachmentName  = @fan,
              finalAttachmentUrl   = @fau,
              lastModifiedAt       = SYSUTCDATETIME()
          WHERE id = @id;
        `);
      } else {
        await rq.query(`
          UPDATE QAPs
          SET finalComments   = @fc,
              finalCommentsBy = @by,
              finalCommentsAt = @at,
              lastModifiedAt  = SYSUTCDATETIME()
          WHERE id = @id;
        `);
      }

      // 2) Advance to Level 5
      await mssqlPool
        .request()
        .input("qapId", sql.UniqueIdentifier, id)
        .input("lvl", sql.Int, 5).query(`
          UPDATE QAPs
          SET status       = 'level-5',
              currentLevel = @lvl,
              lastModifiedAt = SYSUTCDATETIME()
          WHERE id = @qapId;
        `);

      // 3) Log timeline entry for the transition
      await mssqlPool
        .request()
        .input("qapId", sql.UniqueIdentifier, id)
        .input("level", sql.Int, 5)
        .input("action", sql.NVarChar, "Sent to Plant Head for Approval")
        .input("user", sql.NVarChar, username)
        .input("ts", sql.DateTime2, now).query(`
          INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
          VALUES (@qapId, @level, @action, @user, @ts);
        `);

      return res.json({
        message: "Final comments saved and QAP advanced to Level 5",
      });
    } catch (err) {
      console.error("POST /api/qaps/:id/final-comments error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/qaps/:id/approve → approve a QAP (Plant‑head only)
app.post(
  "/api/qaps/:id/approve",
  authenticateToken,
  authorizeRole("plant-head", "admin"),
  param("id").isUUID(),
  body("feedback").optional().isString(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    const { feedback } = req.body;
    const username = req.user.username;
    const now = new Date();

    // start a transaction
    const tx = new sql.Transaction(mssqlPool);
    try {
      await tx.begin();

      // 1) Update the QAP row
      await tx
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("fb", sql.NVarChar, feedback || null)
        .input("by", sql.NVarChar, username)
        .input("at", sql.DateTime2, now).query(`
          UPDATE QAPs
          SET status        = 'approved',
              approver      = @by,
              approvedAt    = @at,
              feedback      = @fb,
              lastModifiedAt = SYSUTCDATETIME()
          WHERE id = @id;
        `);

      // 2) Insert a timeline entry
      await tx
        .request()
        .input("qapId", sql.UniqueIdentifier, id)
        .input("level", sql.Int, 5)
        .input("action", sql.NVarChar, "Plant‑head approved QAP")
        .input("user", sql.NVarChar, username)
        .input("ts", sql.DateTime2, now).query(`
          INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
          VALUES (@qapId, @level, @action, @user, @ts);
        `);

      // 3) Commit everything
      await tx.commit();
      res.json({ message: "QAP approved" });
    } catch (err) {
      await tx.rollback();
      console.error("POST /api/qaps/:id/approve error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/qaps/:id/reject → reject a QAP (Plant‑head only)
app.post(
  "/api/qaps/:id/reject",
  authenticateToken,
  authorizeRole("plant-head", "admin"),
  param("id").isUUID(),
  body("reason").isString(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const username = req.user.username;
    const now = new Date();

    const tx = new sql.Transaction(mssqlPool);
    try {
      await tx.begin();

      // 1) Update the QAP row as rejected
      await tx
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("rs", sql.NVarChar, reason)
        .input("by", sql.NVarChar, username)
        .input("at", sql.DateTime2, now).query(`
          UPDATE QAPs
          SET status        = 'rejected',
              approver      = @by,
              approvedAt    = @at,
              feedback      = @rs,
              lastModifiedAt = SYSUTCDATETIME()
          WHERE id = @id;
        `);

      // 2) Insert a timeline entry
      await tx
        .request()
        .input("qapId", sql.UniqueIdentifier, id)
        .input("level", sql.Int, 5)
        .input("action", sql.NVarChar, "Plant‑head rejected QAP")
        .input("user", sql.NVarChar, username)
        .input("ts", sql.DateTime2, now).query(`
          INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
          VALUES (@qapId, @level, @action, @user, @ts);
        `);

      await tx.commit();
      res.json({ message: "QAP rejected" });
    } catch (err) {
      await tx.rollback();
      console.error("POST /api/qaps/:id/reject error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/qaps/:id/share → share a QAP link via email
app.post(
  "/api/qaps/:id/share",
  authenticateToken,
  param("id").isUUID(),
  body("to").isEmail(),
  handleValidation,
  async (req, res) => {
    // TODO: integrate your sendEmail()
    const { id } = req.params,
      { to } = req.body;
    // link: https://your-domain/qap/${id}
    const link = `${process.env.APP_URL || "http://localhost:3000"}/qap/${id}`;
    const html = `<p>A QAP has been shared with you:</p>
                  <p><a href="${link}">${link}</a></p>`;
    try {
      await sendEmail(to, "QAP Review Link", html);
      res.json({ message: "Shared via email" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Email failed" });
    }
  }
);

// -─────────────────────────────────────────────────────────────────
// SPEC ENDPOINTS
// GET /api/spec-templates → list available spec templates
app.get("/api/spec-templates", authenticateToken, async (req, res) => {
  // simply combine your in‑memory arrays
  const { qapSpecifications } = require("../src/data/qapSpecifications");
  res.json(qapSpecifications);
});

// helper for file URLs under sales-requests
const PUBLIC_APP_URL = process.env.APP_URL || "https://localhost:11443";

// ─────────────────────────────────────────────────────────────────
// Data-file helpers to read from root/src/data/*.ts or *.js
const vm = require("vm");
function tryRequireJs(fpathNoExt) {
  try {
    return require(fpathNoExt + ".js");
  } catch {
    try {
      return require(fpathNoExt); // if someone compiled to .cjs or .mjs and Node can load it
    } catch {
      return null;
    }
  }
}
/**
 * Load an exported array from a TS/JS data file.
 * - Tries compiled JS first (root/src/data/X.js).
 * - If missing, reads TS source and extracts a `export const <name> = [...]` literal.
 */
function loadArrayExportFromDataFile(absPathNoExt, exportNameCandidates) {
  // 1) Prefer compiled JS
  const jsMod = tryRequireJs(absPathNoExt);
  if (jsMod) {
    for (const k of exportNameCandidates) {
      if (Array.isArray(jsMod[k])) return jsMod[k];
    }
    // default export fallback
    if (Array.isArray(jsMod.default)) return jsMod.default;
  }

  // 2) Fallback: parse TS file literal
  const tsPath = absPathNoExt + ".ts";
  if (!fs.existsSync(tsPath)) return [];
  const raw = fs.readFileSync(tsPath, "utf8");
  // Find: export const <name> = [ ... ];
  for (const name of exportNameCandidates) {
    const re = new RegExp(
      String.raw`export\s+const\s+${name}\s*=\s*(\[[\s\S]*?\])\s*;?`,
      "m"
    );
    const m = raw.match(re);
    if (m && m[1]) {
      const literal = m[1];
      // Very safe evaluation in a sandbox: only array/object/primitive literals
      // Avoid JSON.parse because trailing commas & single quotes may appear.
      const context = {};
      const script = new vm.Script("(" + literal + ")");
      const arr = script.runInNewContext(context, { timeout: 1000 });
      if (Array.isArray(arr)) return arr;
    }
  }
  return [];
}

// function to create a snapshot of fields from sales-requests for history
function snapshotForHistory(row, otherFilesList) {
  // Only include fields we care about displaying in history
  return {
    projectCode: row.projectCode ?? null,
    customerName: row.customerName,
    isNewCustomer: row.isNewCustomer,
    moduleManufacturingPlant: row.moduleManufacturingPlant,
    moduleOrderType: row.moduleOrderType,
    cellType: row.cellType,
    wattageBinning: row.wattageBinning,
    rfqOrderQtyMW: row.rfqOrderQtyMW,
    premierBiddedOrderQtyMW: row.premierBiddedOrderQtyMW ?? null,
    deliveryStartDate:
      row.deliveryStartDate?.toISOString?.().slice(0, 10) ??
      row.deliveryStartDate ??
      null,
    deliveryEndDate:
      row.deliveryEndDate?.toISOString?.().slice(0, 10) ??
      row.deliveryEndDate ??
      null,
    projectLocation: row.projectLocation,
    cableLengthRequired: row.cableLengthRequired,
    qapType: row.qapType,
    qapTypeAttachmentName: row.qapTypeAttachmentName ?? null,
    qapTypeAttachmentUrl: row.qapTypeAttachmentUrl ?? null,
    primaryBom: row.primaryBom,
    primaryBomAttachmentName: row.primaryBomAttachmentName ?? null,
    primaryBomAttachmentUrl: row.primaryBomAttachmentUrl ?? null,
    inlineInspection: row.inlineInspection,
    cellProcuredBy: row.cellProcuredBy,
    agreedCTM: Number(row.agreedCTM),
    factoryAuditTentativeDate: row.factoryAuditTentativeDate
      ? row.factoryAuditTentativeDate.toISOString?.().slice(0, 10) ??
        row.factoryAuditTentativeDate
      : null,
    xPitchMm: row.xPitchMm ?? null,
    trackerDetails: row.trackerDetails ?? null,
    priority: row.priority,
    remarks: row.remarks ?? null,
    bom: (() => {
      try {
        return row.bom ? JSON.parse(row.bom) : null;
      } catch {
        return row.bom || null;
      }
    })(),
    otherAttachments: (otherFilesList || []).map((f) => ({
      id: f.id,
      title: f.title || null,
      fileName: f.fileName,
      url: f.url,
    })),
  };
}

// function to do deep equality check of two values
function isEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return String(a) === String(b);
  }
}

// function to generate a project code
function makeProjectCode({
  customerName,
  rfqOrderQtyMW,
  projectLocation,
  date = new Date(),
}) {
  const slug = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const qty = Number(rfqOrderQtyMW || 0);
  return `${slug(customerName)}_${qty}MW_${slug(
    projectLocation
  )}_${yyyy}${mm}${dd}`.slice(0, 50);
}

// helper multer middleware to handle multiple file fields
const salesRequestUpload = upload.fields([
  { name: "qapTypeAttachment", maxCount: 1 },
  { name: "primaryBomAttachment", maxCount: 1 },
  { name: "otherAttachments", maxCount: 50 }, // multiple additional files
]);

function ymdPartsUTC(d = new Date()) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return { dd, mm, yyyy, ymd: `${yyyy}${mm}${dd}`, dmy: `${dd}-${mm}-${yyyy}` };
}

function bumpDocRefString(docRef) {
  try {
    if (!docRef || typeof docRef !== "string") return docRef;
    const { dmy, ymd } = ymdPartsUTC();

    // 1) Rev.N → Rev.(N+1) (or inject Rev.1 if not present)
    const revMatch = docRef.match(/\bRev\.(\d+)\b/i);
    let out = docRef;
    if (revMatch) {
      const n = parseInt(revMatch[1], 10);
      out = out.replace(/\bRev\.(\d+)\b/i, `Rev.${(n || 0) + 1}`);
    } else {
      // Append a revision token if missing
      out = `${out} Rev.1`;
    }

    // 2) Replace any DD-MM-YYYY date token with today (keep format)
    out = out.replace(/\b\d{2}-\d{2}-\d{4}\b/g, dmy);

    // 3) Replace the last 8-digit date token (YYYYMMDD) with today (if present)
    out = out.replace(/(\d{8})(?!.*\d)/, ymd);

    return out;
  } catch {
    return docRef;
  }
}

function bumpBomDocRefJSON(bomJson) {
  try {
    const obj = typeof bomJson === "string" ? JSON.parse(bomJson) : bomJson;
    if (!obj || typeof obj !== "object") return bomJson;
    const current = obj.documentRef || "";
    const bumped = bumpDocRefString(current);
    if (bumped !== current) obj.documentRef = bumped;
    return JSON.stringify(obj);
  } catch {
    return bomJson;
  }
}

// use the same multer instance you already created:
const srUpload = upload.fields([
  { name: "qapTypeAttachment", maxCount: 1 },
  { name: "primaryBomAttachment", maxCount: 1 },
  { name: "otherAttachments", maxCount: 25 },
]);

// fetch files for a set of SR ids → map id → files[]
async function fetchSrFilesMap(ids = []) {
  if (!ids.length) return {};
  const inClause = ids.map((_, i) => `@id${i}`).join(",");
  let r = mssqlPool.request();
  ids.forEach((id, i) => (r = r.input(`id${i}`, sql.UniqueIdentifier, id)));
  const rows = (
    await r.query(
      `SELECT * FROM SalesRequestFiles WHERE salesRequestId IN (${inClause}) ORDER BY id`
    )
  ).recordset;
  return rows.reduce((acc, row) => {
    (acc[row.salesRequestId] ||= []).push(row);
    return acc;
  }, {});
}

// ────────────────────────────────────────────────────────────────────────────
// Sales Requests: list / get / history / create / update
// ────────────────────────────────────────────────────────────────────────────

// GET /api/sales-requests
app.get("/api/sales-requests", authenticateToken, async (req, res) => {
  try {
    const rows = (
      await mssqlPool
        .request()
        .query("SELECT * FROM SalesRequests ORDER BY createdAt DESC")
    ).recordset;

    const ids = rows.map((r) => r.id);
    const filesMap = await fetchSrFilesMap(ids);
    const data = rows.map((r) => inflateSalesRequestRow(r, filesMap));
    res.json(data);
  } catch (e) {
    console.error("GET /api/sales-requests error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/sales-requests/:id
app.get(
  "/api/sales-requests/:id",
  authenticateToken,
  vParam("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      const row = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      if (!row) return res.status(404).json({ message: "Not found" });

      const filesMap = await fetchSrFilesMap([row.id]);
      res.json(inflateSalesRequestRow(row, filesMap));
    } catch (e) {
      console.error("GET /api/sales-requests/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /api/sales-requests/:id/history
app.get(
  "/api/sales-requests/:id/history",
  authenticateToken,
  vParam("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      const rows = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT id, salesRequestId, action, changedBy, changedAt, changes FROM SalesRequestHistory WHERE salesRequestId=@id ORDER BY id DESC"
          )
      ).recordset;

      const data = rows.map((r) => ({
        id: r.id,
        salesRequestId: r.salesRequestId,
        action: r.action,
        changedBy: r.changedBy,
        changedAt: r.changedAt,
        changes: safeParseJson(r.changes, null),
        snapshot: safeParseJson(r.snapshot, null),
      }));
      res.json(data);
    } catch (e) {
      console.error("GET /api/sales-requests/:id/history error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/sales-requests  (multipart/form-data)
app.post(
  "/api/sales-requests",
  authenticateToken,
  srUpload,
  async (req, res) => {
    try {
      const b = req.body;

      // files
      const qapFile = (req.files?.qapTypeAttachment || [])[0] || null;
      const bomFile = (req.files?.primaryBomAttachment || [])[0] || null;
      const otherFiles = req.files?.otherAttachments || [];
      const otherTitles = safeParseJson(b.otherAttachmentTitles, []).map((s) =>
        String(s || "")
      );

      // computed / normalized
      const projectCode = pick(b.projectCode, makeSrProjectCodeFromBody(b));
      const moduleOrderType = coerceOrderTagFromBody(b); // M10 | G12 | G12R
      const wattageBinningDist = safeParseJson(b.wattageBinningDist, []);
      const bomJson = safeParseJson(b.bom, null);

      const newId = crypto.randomUUID();

      // insert master
      let r = mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, newId)
        .input("customerName", sql.NVarChar, b.customerName)
        .input("isNewCustomer", sql.NVarChar, "no")
        .input(
          "moduleManufacturingPlant",
          sql.NVarChar,
          b.moduleManufacturingPlant
        )
        .input("moduleOrderType", sql.NVarChar, moduleOrderType)
        .input(
          "cellType",
          sql.NVarChar,
          mustEnum(b.cellType, ["DCR", "NDCR"], "DCR")
        )
        .input("wattageBinning", sql.Int, 0)
        .input("rfqOrderQtyMW", sql.Int, mustInt(b.rfqOrderQtyMW, { gte: 0 }))
        .input(
          "premierBiddedOrderQtyMW",
          sql.Int,
          intOrNull(b.premierBiddedOrderQtyMW)
        )
        .input("deliveryStartDate", sql.Date, mustYMD(b.deliveryStartDate))
        .input("deliveryEndDate", sql.Date, mustYMD(b.deliveryEndDate))
        .input("projectLocation", sql.NVarChar, b.projectLocation)
        .input(
          "cableLengthRequired",
          sql.Int,
          mustInt(b.cableLengthRequired, { gte: 0 })
        )
        .input(
          "qapType",
          sql.NVarChar,
          mustEnum(
            b.qapType,
            ["Customer", "Premier Energies"],
            "Premier Energies"
          )
        )
        .input(
          "qapTypeAttachmentName",
          sql.NVarChar,
          qapFile ? qapFile.originalname : null
        )
        .input(
          "qapTypeAttachmentUrl",
          sql.NVarChar,
          qapFile ? fileUrl(req, qapFile.filename) : null
        )
        .input(
          "primaryBom",
          sql.NVarChar,
          b.bomFrom === "Customer" ? "yes" : "no"
        )
        .input(
          "primaryBomAttachmentName",
          sql.NVarChar,
          bomFile ? bomFile.originalname : null
        )
        .input(
          "primaryBomAttachmentUrl",
          sql.NVarChar,
          bomFile ? fileUrl(req, bomFile.filename) : null
        )
        .input("inlineInspection", sql.NVarChar, yesNo(b.inlineInspection))
        .input("pdi", sql.NVarChar, yesNo(b.pdi))
        .input(
          "cellProcuredBy",
          sql.NVarChar,
          mustEnum(
            b.cellProcuredBy,
            ["Customer", "Premier Energies", "Financed By Customer"],
            "Customer"
          )
        )
        .input("agreedCTM", sql.Decimal(18, 8), mustDec(b.agreedCTM))
        .input(
          "factoryAuditTentativeDate",
          sql.Date,
          normYMD(b.factoryAuditTentativeDate)
        )
        .input("xPitchMm", sql.Int, intOrNull(b.xPitchMm))
        .input("trackerDetails", sql.Int, intOrNull(b.trackerDetails))
        .input(
          "priority",
          sql.NVarChar,
          mustEnum(b.priority, ["high", "low"], "low")
        )
        .input("remarks", sql.NVarChar, pick(b.remarks, null))
        .input("createdBy", sql.NVarChar, pick(b.createdBy, req.user.username))
        .input("bom", sql.NVarChar, bomJson ? JSON.stringify(bomJson) : null)
        .input(
          "wattageBinningDist",
          sql.NVarChar,
          JSON.stringify(wattageBinningDist || [])
        )
        .input("moduleCellType", sql.NVarChar, keepIfPresent(b.moduleCellType))
        .input("cellTech", sql.NVarChar, keepIfPresent(b.cellTech))
        .input("cutCells", sql.Int, intOrNull(b.cutCells))
        .input(
          "certificationRequired",
          sql.NVarChar,
          keepIfPresent(b.certificationRequired)
        )
        .input("projectCode", sql.NVarChar, projectCode);

      await r.query(`
      INSERT INTO SalesRequests (
        id, customerName, isNewCustomer, moduleManufacturingPlant, moduleOrderType,
        cellType, wattageBinning, rfqOrderQtyMW, premierBiddedOrderQtyMW,
        deliveryStartDate, deliveryEndDate, projectLocation, cableLengthRequired,
        qapType, qapTypeAttachmentName, qapTypeAttachmentUrl,
        primaryBom, primaryBomAttachmentName, primaryBomAttachmentUrl,
        inlineInspection, pdi, cellProcuredBy, agreedCTM, factoryAuditTentativeDate,
        xPitchMm, trackerDetails, priority, remarks, createdBy, bom,
        wattageBinningDist, moduleCellType, cellTech, cutCells, certificationRequired, projectCode
      )
      VALUES (
        @id, @customerName, @isNewCustomer, @moduleManufacturingPlant, @moduleOrderType,
        @cellType, @wattageBinning, @rfqOrderQtyMW, @premierBiddedOrderQtyMW,
        @deliveryStartDate, @deliveryEndDate, @projectLocation, @cableLengthRequired,
        @qapType, @qapTypeAttachmentName, @qapTypeAttachmentUrl,
        @primaryBom, @primaryBomAttachmentName, @primaryBomAttachmentUrl,
        @inlineInspection, @pdi, @cellProcuredBy, @agreedCTM, @factoryAuditTentativeDate,
        @xPitchMm, @trackerDetails, @priority, @remarks, @createdBy, @bom,
        @wattageBinningDist, @moduleCellType, @cellTech, @cutCells, @certificationRequired, @projectCode
      );
    `);

      // other attachments (child table)
      for (let i = 0; i < otherFiles.length; i++) {
        const f = otherFiles[i];
        const t = otherTitles[i] || `Attachment ${i + 1}`;
        await mssqlPool
          .request()
          .input("sid", sql.UniqueIdentifier, newId)
          .input("title", sql.NVarChar, t)
          .input("fileName", sql.NVarChar, f.originalname)
          .input("url", sql.NVarChar, fileUrl(req, f.filename)).query(`
          INSERT INTO SalesRequestFiles (salesRequestId,title,fileName,url)
          VALUES (@sid,@title,@fileName,@url);
        `);
      }

      // history
      const filesMap = await fetchSrFilesMap([newId]);
      const freshRow = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, newId)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      const otherFilesList = filesMap[newId] || [];
      const snap = snapshotForHistory(freshRow, otherFilesList);

      await mssqlPool
        .request()
        .input("sid", sql.UniqueIdentifier, newId)
        .input("by", sql.NVarChar, pick(b.createdBy, req.user.username))
        .input("snap", sql.NVarChar, JSON.stringify(snap)).query(`
        INSERT INTO SalesRequestHistory (salesRequestId, action, changedBy, changes, snapshot)
        VALUES (@sid, 'create', @by, NULL, @snap);
      `);

      // return hydrated row
      const master = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, newId)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];

      res.status(201).json(inflateSalesRequestRow(master, filesMap));
    } catch (e) {
      console.error("POST /api/sales-requests error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/sales-requests/:id  (multipart/form-data)
app.put(
  "/api/sales-requests/:id",
  authenticateToken,
  vParam("id").isUUID(),
  handleValidation,
  srUpload,
  async (req, res) => {
    const { id } = req.params;
    try {
      // current snapshot
      const current = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      if (!current) return res.status(404).json({ message: "Not found" });

      const b = req.body;

      // files
      const qapFile = (req.files?.qapTypeAttachment || [])[0] || null;
      const bomFile = (req.files?.primaryBomAttachment || [])[0] || null;
      const otherFiles = req.files?.otherAttachments || [];
      const otherTitles = safeParseJson(b.otherAttachmentTitles, []).map((s) =>
        String(s || "")
      );

      const updates = [];
      const reqt = mssqlPool.request().input("id", sql.UniqueIdentifier, id);

      // helper to set nullable NVARCHAR
      const setNVar = (col, val) => {
        if (keepIfPresent(val) !== undefined) {
          updates.push(`${col}=@${col}`);
          reqt.input(col, sql.NVarChar, val);
        }
      };
      const setInt = (col, val) => {
        if (keepIfPresent(val) !== undefined) {
          updates.push(`${col}=@${col}`);
          reqt.input(col, sql.Int, intOrNull(val));
        }
      };
      const setDec = (col, val) => {
        if (keepIfPresent(val) !== undefined) {
          updates.push(`${col}=@${col}`);
          reqt.input(col, sql.Decimal(18, 8), decOrZero(val));
        }
      };
      const setDate = (col, val) => {
        if (keepIfPresent(val) !== undefined) {
          updates.push(`${col}=@${col}`);
          reqt.input(col, sql.Date, normYMD(val));
        }
      };

      // plain fields (only update if present)
      setNVar("projectCode", pick(b.projectCode, current.projectCode));
      setNVar("moduleManufacturingPlant", b.moduleManufacturingPlant);
      setNVar("cellType", b.cellType);
      setNVar("qapType", b.qapType);
      setNVar("inlineInspection", yesNo(b.inlineInspection));
      setNVar("pdi", yesNo(b.pdi));
      setNVar("cellProcuredBy", b.cellProcuredBy);
      setNVar("priority", b.priority);
      setNVar("remarks", b.remarks);
      setNVar("moduleCellType", b.moduleCellType);
      setNVar("cellTech", b.cellTech);
      setInt("cutCells", b.cutCells);
      setNVar("certificationRequired", b.certificationRequired);

      setInt("rfqOrderQtyMW", b.rfqOrderQtyMW);
      setInt("premierBiddedOrderQtyMW", b.premierBiddedOrderQtyMW);
      setDate("deliveryStartDate", b.deliveryStartDate);
      setDate("deliveryEndDate", b.deliveryEndDate);
      setNVar("projectLocation", b.projectLocation);
      setInt("cableLengthRequired", b.cableLengthRequired);
      setDec("agreedCTM", b.agreedCTM);
      setDate("factoryAuditTentativeDate", b.factoryAuditTentativeDate);
      setInt("xPitchMm", b.xPitchMm);
      setInt("trackerDetails", b.trackerDetails);

      // derived legacy fields
      if (keepIfPresent(b.moduleCellType) !== undefined) {
        updates.push(`moduleOrderType=@moduleOrderType`);
        reqt.input("moduleOrderType", sql.NVarChar, coerceOrderTagFromBody(b));
      }

      // JSON blobs (wattage dist + BOM)
      if (keepIfPresent(b.wattageBinningDist) !== undefined) {
        const dist = safeParseJson(b.wattageBinningDist, []);
        updates.push(`wattageBinningDist=@wbd`);
        reqt.input("wbd", sql.NVarChar, JSON.stringify(dist || []));
      }
      if (keepIfPresent(b.bom) !== undefined) {
        const bom = safeParseJson(b.bom, null);
        updates.push(`bom=@bom`);
        reqt.input("bom", sql.NVarChar, bom ? JSON.stringify(bom) : null);
      }

      // BOM source mapping to legacy 'primaryBom'
      if (keepIfPresent(b.bomFrom) !== undefined) {
        updates.push(`primaryBom=@primaryBom`);
        reqt.input(
          "primaryBom",
          sql.NVarChar,
          b.bomFrom === "Customer" ? "yes" : "no"
        );
      }

      // replace single attachments if new ones are uploaded
      if (qapFile) {
        updates.push(`qapTypeAttachmentName=@qapName`);
        updates.push(`qapTypeAttachmentUrl=@qapUrl`);
        reqt.input("qapName", sql.NVarChar, qapFile.originalname);
        reqt.input("qapUrl", sql.NVarChar, fileUrl(req, qapFile.filename));
      }
      if (bomFile) {
        updates.push(`primaryBomAttachmentName=@bomName`);
        updates.push(`primaryBomAttachmentUrl=@bomUrl`);
        reqt.input("bomName", sql.NVarChar, bomFile.originalname);
        reqt.input("bomUrl", sql.NVarChar, fileUrl(req, bomFile.filename));
      }

      if (!updates.length && !otherFiles.length) {
        return res.status(400).json({ message: "Nothing to update" });
      }

      // perform update
      if (updates.length) {
        await reqt.query(
          `UPDATE SalesRequests SET ${updates.join(", ")} WHERE id=@id;`
        );
      }

      // append any new "other" files
      for (let i = 0; i < otherFiles.length; i++) {
        const f = otherFiles[i];
        const t = otherTitles[i] || `Attachment ${i + 1}`;
        await mssqlPool
          .request()
          .input("sid", sql.UniqueIdentifier, id)
          .input("title", sql.NVarChar, t)
          .input("fileName", sql.NVarChar, f.originalname)
          .input("url", sql.NVarChar, fileUrl(req, f.filename)).query(`
          INSERT INTO SalesRequestFiles (salesRequestId,title,fileName,url)
          VALUES (@sid,@title,@fileName,@url);
        `);
      }

      // fetch fresh for diff + response
      const fresh = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      const filesMap = await fetchSrFilesMap([id]);
      const before = inflateSalesRequestRow(current, filesMap);
      const after = inflateSalesRequestRow(fresh, filesMap);

      const tracked = [
        "customerName",
        "projectCode",
        "moduleManufacturingPlant",
        "cellType",
        "moduleCellType",
        "cellTech",
        "cutCells",
        "certificationRequired",
        "rfqOrderQtyMW",
        "premierBiddedOrderQtyMW",
        "deliveryStartDate",
        "deliveryEndDate",
        "projectLocation",
        "cableLengthRequired",
        "qapType",
        "bomFrom",
        "inlineInspection",
        "pdi",
        "cellProcuredBy",
        "agreedCTM",
        "factoryAuditTentativeDate",
        "xPitchMm",
        "trackerDetails",
        "priority",
        "remarks",
        "wattageBinningDist",
        "bom",
      ];
      const diff = buildDiff(before, after, tracked);

      // build a snapshot for the UI
      const otherFilesList = (await fetchSrFilesMap([id]))[id] || [];
      const snap = snapshotForHistory(fresh, otherFilesList);

      await mssqlPool
        .request()
        .input("sid", sql.UniqueIdentifier, id)
        .input("by", sql.NVarChar, req.user.username)
        .input("chg", sql.NVarChar, diff.length ? JSON.stringify(diff) : null)
        .input("snap", sql.NVarChar, JSON.stringify(snap)).query(`
                INSERT INTO SalesRequestHistory (salesRequestId, action, changedBy, changes, snapshot)
        VALUES (@sid, 'update', @by, @chg, @snap);
      `);

      // If BOM changed, propagate a BOM edit event into the linked QAP(s)
      if (diff.some((d) => d.field === "bom")) {
        const beforeBom = before.bom ?? null;
        const afterBom = after.bom ?? null;
        const bomDiff = computeBomDiff(beforeBom, afterBom); // uses BOM_DIFF_HELPER

        // find QAPs referencing this SalesRequest
        const qaps = (
          await mssqlPool
            .request()
            .input("sid", sql.UniqueIdentifier, id)
            .query("SELECT id FROM QAPs WHERE salesRequestId=@sid")
        ).recordset;

        for (const row of qaps) {
          await appendBomEditAndReopenL2(row.id, req.user.username, bomDiff); // QAP_BOM_EDIT_EVENT_HELPER
        }
      }

      res.json(after);
    } catch (e) {
      console.error("PUT /api/sales-requests/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// PATCH /api/sales-requests/:id → partial update (supports BOM persistence)
app.patch(
  "/api/sales-requests/:id",
  [authenticateToken, param("id").isUUID(), handleValidation],
  async (req, res) => {
    const { id } = req.params;
    const { bom } = req.body; // expect object (or null) from FE
    const changedBy = req.user?.username || req.body.updatedBy || "unknown";

    try {
      // 1) load current row
      const getReq = await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query("SELECT * FROM SalesRequests WHERE id=@id");
      const beforeRow = getReq.recordset[0];
      if (!beforeRow) return res.status(404).json({ message: "Not found" });

      // 2) build update set
      const sets = [];
      let rq = mssqlPool.request().input("id", sql.UniqueIdentifier, id);

      if (typeof bom !== "undefined") {
        rq = rq.input("bom", sql.NVarChar, JSON.stringify(bom));
        sets.push("bom=@bom");
      }

      if (!sets.length) {
        // nothing to update (but if bom was provided, it's still a logical update request)
        // We'll treat "bom provided but identical" as a no-op without reopening L2.
        const inflated = inflateSalesRequestRow(beforeRow, {});
        return res.json(inflated);
      }

      // 3) write update
      await rq.query(`UPDATE SalesRequests SET ${sets.join(",")} WHERE id=@id`);

      // 4) audit history
      const changes = [];
      if (typeof bom !== "undefined") {
        changes.push({
          field: "bom",
          before: safeParseJson(beforeRow.bom, null),
          after: bom ?? null,
        });
      }
      await mssqlPool
        .request()
        .input("sid", sql.UniqueIdentifier, id)
        .input("act", sql.NVarChar, "update")
        .input("by", sql.NVarChar, changedBy)
        .input("chg", sql.NVarChar, JSON.stringify(changes))
        .query(
          `INSERT INTO SalesRequestHistory
           (salesRequestId, action, changedBy, changes)
           VALUES (@sid, @act, @by, @chg)`
        );

      // 4.5) If BOM changed, propagate a BOM edit event into linked QAP(s)
      if (typeof bom !== "undefined") {
        const beforeBom = safeParseJson(beforeRow.bom, null);
        const afterBom = bom ?? null;
        const bomDiff = computeBomDiff(beforeBom, afterBom);

        const hasBomDelta =
          (bomDiff.changed && bomDiff.changed.length) ||
          (bomDiff.added && bomDiff.added.length) ||
          (bomDiff.removed && bomDiff.removed.length);

        if (hasBomDelta) {
          const qaps = (
            await mssqlPool
              .request()
              .input("sid", sql.UniqueIdentifier, id)
              .query("SELECT id FROM QAPs WHERE salesRequestId=@sid")
          ).recordset;

          for (const q of qaps) {
            await appendBomEditAndReopenL2(
              q.id,
              req.user?.username || "system",
              bomDiff
            );
          }
        }
      }

      // 5) return fresh row (inflated to FE shape)
      const afterReq = await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query("SELECT * FROM SalesRequests WHERE id=@id");
      const row = afterReq.recordset[0];

      // include attached files if you want (optional); passing {} is fine
      const inflated = inflateSalesRequestRow(row, {});
      res.json(inflated);
    } catch (e) {
      console.error("PATCH /api/sales-requests/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /api/project-codes  (distinct non-empty codes for dropdown)
app.get("/api/project-codes", authenticateToken, async (_req, res) => {
  try {
    const { recordset } = await mssqlPool
      .request()
      .query(
        "SELECT DISTINCT projectCode FROM SalesRequests WHERE projectCode IS NOT NULL AND projectCode <> '' ORDER BY projectCode"
      );
    res.json(recordset.map((r) => r.projectCode));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/customers?includeCounts=1
app.get("/api/customers", authenticateToken, async (req, res) => {
  try {
    const includeCounts = String(req.query.includeCounts || "") === "1";

    if (includeCounts) {
      // Count SalesRequests by case/space-insensitive customerName match
      const q = `
        SELECT
          c.id, c.name, c.createdAt, c.updatedAt,
          COUNT(s.id) AS salesRequestCount
        FROM Customers c
        LEFT JOIN SalesRequests s
          ON LTRIM(RTRIM(LOWER(s.customerName))) = LTRIM(RTRIM(LOWER(c.name)))
        GROUP BY c.id, c.name, c.createdAt, c.updatedAt
        ORDER BY c.name
      `;
      const { recordset } = await mssqlPool.request().query(q);
      return res.json(recordset);
    }

    const { recordset } = await mssqlPool
      .request()
      .query(
        `SELECT id, name, createdAt, updatedAt FROM Customers ORDER BY name`
      );
    res.json(recordset);
  } catch (e) {
    console.error("GET /api/customers error:", e);
    res.status(500).send("Server error");
  }
});

// POST /api/customers  { name }
app.post(
  "/api/customers",
  [
    authenticateToken,
    vBody("name").isString().trim().notEmpty(),
    handleValidation,
  ],
  async (req, res) => {
    try {
      const name = String(req.body.name || "").trim();

      // dupe (case/space-insensitive)
      const dupe = await mssqlPool
        .request()
        .input("n", sql.NVarChar, name)
        .query(
          `SELECT TOP 1 id
           FROM Customers
           WHERE LTRIM(RTRIM(LOWER(name))) = LTRIM(RTRIM(LOWER(@n)))`
        );
      if (dupe.recordset.length) {
        return res
          .status(409)
          .json({ message: "A customer with this name already exists" });
      }

      const id = require("crypto").randomUUID();
      const now = new Date();

      await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("n", sql.NVarChar, name)
        .input("now", sql.DateTime2, now)
        .query(
          `INSERT INTO Customers (id, name, createdAt, updatedAt)
           VALUES (@id, @n, @now, @now)`
        );

      const { recordset } = await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query(
          `SELECT id, name, createdAt, updatedAt
           FROM Customers WHERE id=@id`
        );

      res.status(201).json(recordset[0]);
    } catch (e) {
      console.error("POST /api/customers error:", e);
      res.status(500).send("Server error");
    }
  }
);

// GET /api/customers/:id
app.get(
  "/api/customers/:id",
  [authenticateToken, vParam("id").isUUID(), handleValidation],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { recordset } = await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query(
          `SELECT id, name, createdAt, updatedAt
           FROM Customers WHERE id=@id`
        );
      if (!recordset.length)
        return res.status(404).json({ message: "Customer not found" });
      res.json(recordset[0]);
    } catch (e) {
      console.error("GET /api/customers/:id error:", e);
      res.status(500).send("Server error");
    }
  }
);

// PUT /api/customers/:id  { name }
app.put(
  "/api/customers/:id",
  [
    authenticateToken,
    vParam("id").isUUID(),
    vBody("name").isString().trim().notEmpty(),
    handleValidation,
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const name = String(req.body.name || "").trim();

      // exists?
      const exists = await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query(`SELECT id FROM Customers WHERE id=@id`);
      if (!exists.recordset.length)
        return res.status(404).json({ message: "Customer not found" });

      // dupe name (different id)
      const dupe = await mssqlPool
        .request()
        .input("n", sql.NVarChar, name)
        .input("id", sql.UniqueIdentifier, id)
        .query(
          `SELECT TOP 1 id
           FROM Customers
           WHERE LTRIM(RTRIM(LOWER(name))) = LTRIM(RTRIM(LOWER(@n)))
             AND id <> @id`
        );
      if (dupe.recordset.length) {
        return res
          .status(409)
          .json({ message: "A customer with this name already exists" });
      }

      await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .input("n", sql.NVarChar, name)
        .query(
          `UPDATE Customers
           SET name=@n, updatedAt=SYSUTCDATETIME()
           WHERE id=@id`
        );

      const { recordset } = await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query(
          `SELECT id, name, createdAt, updatedAt
           FROM Customers WHERE id=@id`
        );

      res.json(recordset[0]);
    } catch (e) {
      console.error("PUT /api/customers/:id error:", e);
      res.status(500).send("Server error");
    }
  }
);

// DELETE /api/customers/:id  (does NOT delete SalesRequests)
app.delete(
  "/api/customers/:id",
  [authenticateToken, vParam("id").isUUID(), handleValidation],
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query(`DELETE FROM Customers WHERE id=@id`);
      // API from Customers.tsx expects 204 on success
      return res.status(204).send("");
    } catch (e) {
      console.error("DELETE /api/customers/:id error:", e);
      res.status(500).send("Server error");
    }
  }
);

// `src/data/qapSpecifications.ts`
function generateSpecTs(specs) {
  const header = `// AUTO-GENERATED by server at ${new Date().toISOString()}
// Do not edit by hand. Update via the Spec Builder UI.

export type CriteriaType = "MQP" | "Visual";
export type SpecClass = "Critical" | "Major" | "Minor";

export interface QAPSpecification {
  id: string;
  criteria: CriteriaType;
  subCriteria: string;
  specification: string;
  class: SpecClass;
  description?: string;
  sampling?: string;
  typeOfCheck?: string;
}

export const mqpSpecifications: QAPSpecification[] = [
`;

  const footer = `
];

export const visualElSpecifications: QAPSpecification[] = [
`;

  const end = `
];

export const qapSpecifications: QAPSpecification[] = [
  ...mqpSpecifications,
  ...visualElSpecifications,
];
`;

  const mqp = specs
    .filter((s) => s.criteria === "MQP")
    .map(
      (s) => `  {
    id: "${s.id}",
    criteria: "MQP",
    subCriteria: \`${escapeTs(s.subCriteria)}\`,
    specification: \`${escapeTs(s.specification)}\`,
    class: "${s.class}",
    ${
      s.description ? `description: \`${escapeTs(s.description)}\`,\n    ` : ""
    }${
        s.typeOfCheck
          ? `typeOfCheck: \`${escapeTs(s.typeOfCheck)}\`,\n    `
          : ""
      }${s.sampling ? `sampling: \`${escapeTs(s.sampling)}\`,\n    ` : ""}},`
    )
    .join("\n");

  const visual = specs
    .filter((s) => s.criteria === "Visual")
    .map(
      (s) => `  {
    id: "${s.id}",
    criteria: "Visual",
    subCriteria: \`${escapeTs(s.subCriteria)}\`,
    specification: \`${escapeTs(s.specification)}\`,
    class: "${s.class}",
    ${
      s.description ? `description: \`${escapeTs(s.description)}\`,\n    ` : ""
    }},`
    )
    .join("\n");

  return header + mqp + footer + visual + end;
}

// `src/data/bomMaster.ts`
function generateBomTs(list) {
  // list: [{ name: string, options: [{model, subVendor, spec}] }, ...]
  const names = [...new Set(list.map((x) => x.name))].sort();

  const compMap = {};
  for (const n of names) {
    const item = list.find((x) => x.name === n);
    compMap[n] = (item?.options || []).map((o) => ({
      model: o.model,
      subVendor: o.subVendor ?? null,
      spec: o.spec ?? null,
    }));
  }

  const nameUnion = names.map((n) => JSON.stringify(n)).join(" | ");

  // Adjust these to your real lock-ins / techs if needed:
  const VENDOR = "Premier Energies";
  const RFID = "Near junction box";
  const TECHS = ["M10", "G12R", "G12"];

  const ts = `/* @generated by server.cjs – do not edit by hand */

export type BomComponentName = ${nameUnion};
export type BomComponentOption = { model: string; subVendor?: string | null; spec?: string | null };

export const BOM_MASTER = ${JSON.stringify(compMap, null, 2)} as const
  satisfies Record<BomComponentName, readonly BomComponentOption[]>;

export const VENDOR_NAME_LOCKIN = ${JSON.stringify(VENDOR)};
export const RFID_LOCATION_LOCKIN = ${JSON.stringify(RFID)};
export const TECHNOLOGIES = ${JSON.stringify(TECHS)} as const;

export function getOptionsFor(name: BomComponentName): readonly BomComponentOption[] {
  return BOM_MASTER[name] || [];
}
`;

  return ts;
}

// Seed dbo.BomComponents / dbo.BomComponentOptions from local JSON if DB is empty.
async function seedBomDbFromLocalIfEmpty() {
  try {
    const { recordset } = await mssqlPool
      .request()
      .query("SELECT COUNT(*) AS n FROM dbo.BomComponents");
    if ((recordset?.[0]?.n || 0) > 0) return; // already populated

    const local = readJsonSafe(BOM_STORE_JSON, []);
    if (!Array.isArray(local) || !local.length) {
      console.warn("BOM seed skipped: no local JSON found.");
      return;
    }

    const tx = new sql.Transaction(mssqlPool);
    await tx.begin();
    try {
      let pos = 0;
      for (const c of local) {
        const name = String(c?.name || "").trim();
        if (!name) continue;

        await new sql.Request(tx)
          .input("n", sql.NVarChar, name)
          .input("p", sql.Int, ++pos)
          .query("INSERT INTO dbo.BomComponents(name, position) VALUES(@n,@p)");

        const options = Array.isArray(c.options) ? c.options : [];
        for (const o of options) {
          if (!o || !String(o.model || "").trim()) continue;
          await new sql.Request(tx)
            .input("cn", sql.NVarChar, name)
            .input("m", sql.NVarChar, String(o.model).trim())
            .input("sv", sql.NVarChar, o.subVendor ?? null)
            .input("sp", sql.NVarChar, o.spec ?? null)
            .query(
              "INSERT INTO dbo.BomComponentOptions(componentName,model,subVendor,spec) VALUES (@cn,@m,@sv,@sp)"
            );
        }
      }
      await tx.commit();
      console.log("✅ Seeded BOM from local JSON →", pos, "components");
    } catch (e) {
      await tx.rollback();
      console.error("❌ BOM seed failed:", e);
    }
  } catch (e) {
    console.error("❌ BOM seed check failed:", e);
  }
}

// ---- Initialize stores from JSON; if JSON not present, try to bootstrap ----
(function bootstrapStores() {
  SPEC_STORE = readJsonSafe(SPEC_STORE_JSON, []);
  BOM_STORE = readJsonSafe(BOM_STORE_JSON, []);

  // If TypeScript files exist but JSON is empty, create a minimal bootstrap read by naive regex (optional).
  // For reliability, we keep JSON as the source of truth once present.
  // If both are empty, we just start empty.
  writeJson(SPEC_STORE_JSON, SPEC_STORE);
  writeJson(BOM_STORE_JSON, BOM_STORE);

  // ---- Bootstrap from TS if JSON is empty (prevents empty arrays on fresh boots) ----
  try {
    if (!SPEC_STORE.length) {
      const specFromTs = loadArrayExportFromDataFile(
        SPEC_TS.replace(/\.ts$/, ""),
        [
          "qapSpecifications",
          "mqpSpecifications",
          "visualElSpecifications",
          "default",
        ]
      );
      if (Array.isArray(specFromTs) && specFromTs.length) {
        SPEC_STORE = specFromTs.map((s) => ({
          id: String(s.id ?? crypto.randomUUID()),
          criteria: s.criteria,
          subCriteria: s.subCriteria ?? "",
          specification: s.specification ?? "",
          class: s.class ?? "Major",
          description: s.description ?? null,
          sampling: s.sampling ?? null,
          typeOfCheck: s.typeOfCheck ?? null,
        }));
      }
    }
  } catch {}

  try {
    if (!BOM_STORE.length) {
      const bomFromTs = loadArrayExportFromDataFile(
        BOM_TS.replace(/\.ts$/, ""),
        ["bomComponents", "default"]
      );
      if (Array.isArray(bomFromTs) && bomFromTs.length) {
        BOM_STORE = bomFromTs.map((b) => ({
          id: String(b.id ?? crypto.randomUUID()),
          name: b.name,
          options: (b.options || []).map((o) => ({
            model: String(o.model ?? "").trim(),
            subVendor: o.subVendor ? String(o.subVendor).trim() : null,
            spec: o.spec ? String(o.spec).trim() : null,
          })),
        }));
      }
    }
  } catch {}

  // persist stores and ensure TS files exist (now populated if possible)
  writeJson(SPEC_STORE_JSON, SPEC_STORE);
  writeJson(BOM_STORE_JSON, BOM_STORE);

  if (!fs.existsSync(SPEC_TS)) {
    fs.writeFileSync(SPEC_TS, generateSpecTs(SPEC_STORE), "utf-8");
  } else {
    // keep TS in sync with (possibly) hydrated store
    fs.writeFileSync(SPEC_TS, generateSpecTs(SPEC_STORE), "utf-8");
  }
  if (!fs.existsSync(BOM_TS)) {
    fs.writeFileSync(BOM_TS, generateBomTs(BOM_STORE), "utf-8");
  } else {
    // keep TS in sync with (possibly) hydrated store
    fs.writeFileSync(BOM_TS, generateBomTs(BOM_STORE), "utf-8");
  }
})();

// ---- Utilities ----
const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const SPEC_CLASSES = new Set(["Critical", "Major", "Minor"]);
const CRITERIA_SET = new Set(["MQP", "Visual"]);

const COMP_SET = new Set([
  "Solar Cell",
  "Front Cover",
  "Back Cover",
  "Encapsulation (EVA)",
  "Back Sheet (Tedlar)",
  "Frame",
  "Junction Box",
  "Bypass Diodes",
  "Interconnect Ribbons",
  "Bus Bar",
  "Sealants",
  "Label",
  "Carton Box",
]);

// valid technologies (server-side validation for /api/bom-components POST/PUT)
const TECH_SET = new Set(["M10", "M10R", "G12", "G12R"]);

function regenerateSpecFile() {
  writeJson(SPEC_STORE_JSON, SPEC_STORE);
  fs.writeFileSync(SPEC_TS, generateSpecTs(SPEC_STORE), "utf-8");
}

function regenerateBomFile() {
  writeJson(BOM_STORE_JSON, BOM_STORE);
  fs.writeFileSync(BOM_TS, generateBomTs(BOM_STORE), "utf-8");
}

// ---- SPECS API ----

// ───────────────────────────────────────────────────────────────
// SPECS CRUD (backed by dbo.QAPSpecifications)
// id = INT IDENTITY in DB; UI treats it as string
// ───────────────────────────────────────────────────────────────
const asUiSpec = (r) => ({
  id: String(r.id),
  criteria: r.criteria, // "MQP" | "Visual"
  subCriteria: r.subCriteria || "",
  specification: r.specification || "",
  class: r.class || "Major",
  description: r.description || null,
  sampling: r.sampling || null,
  typeOfCheck: r.typeOfCheck || null,
});

// GET /api/specs?criteria=MQP|Visual  (criteria optional)
app.get("/api/specs", authenticateToken, async (req, res) => {
  try {
    const crit = String(req.query.criteria || "").trim();
    let rq = mssqlPool.request();
    let where = "";
    if (crit === "MQP" || crit === "Visual") {
      where = "WHERE criteria=@crit";
      rq = rq.input("crit", sql.NVarChar, crit);
    }
    const q = `
      SELECT id, criteria, subCriteria, specification, [class] AS class,
             [description], sampling, typeOfCheck, sno
      FROM dbo.QAPSpecifications
      ${where}
      ORDER BY COALESCE(sno, 2147483647), subCriteria
    `;
    const rows = (await rq.query(q)).recordset;
    res.json(rows.map(asUiSpec));
  } catch (e) {
    console.error("GET /api/specs", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/specs  (create; auto-assign next sno within criteria)
app.post("/api/specs", authenticateToken, async (req, res) => {
  try {
    const s = req.body || {};
    if (!s.criteria || !s.subCriteria || !s.specification || !s.class) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const crit = String(s.criteria);
    const { recordset: maxRows } = await mssqlPool
      .request()
      .input("crit", sql.NVarChar, crit)
      .query(
        "SELECT ISNULL(MAX(sno),0) AS maxSno FROM dbo.QAPSpecifications WHERE criteria=@crit"
      );
    const nextSno = (maxRows[0]?.maxSno || 0) + 1;

    const { recordset: rid } = await mssqlPool
      .request()
      .input("sno", sql.Int, nextSno)
      .input("criteria", sql.NVarChar, crit)
      .input("subCriteria", sql.NVarChar, s.subCriteria)
      .input("specification", sql.NVarChar, s.specification)
      .input("class", sql.NVarChar, s.class)
      .input(
        "description",
        sql.NVarChar,
        crit === "Visual" ? s.description || null : null
      )
      .input(
        "sampling",
        sql.NVarChar,
        crit === "MQP" ? s.sampling || null : null
      )
      .input(
        "typeOfCheck",
        sql.NVarChar,
        crit === "MQP" ? s.typeOfCheck || null : null
      ).query(`
        INSERT INTO dbo.QAPSpecifications
          (sno, criteria, subCriteria, specification, [class],
           [description], sampling, typeOfCheck)
        VALUES
          (@sno, @criteria, @subCriteria, @specification, @class,
           @description, @sampling, @typeOfCheck);

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
      `);

    const newId = rid[0].id;
    const row = (
      await mssqlPool
        .request()
        .input("id", sql.Int, newId)
        .query(
          `SELECT id, criteria, subCriteria, specification, [class] AS class,
                  [description], sampling, typeOfCheck, sno
           FROM dbo.QAPSpecifications WHERE id=@id`
        )
    ).recordset[0];

    res.status(201).json(asUiSpec(row));
  } catch (e) {
    console.error("POST /api/specs", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/specs/:id  (full replace of editable fields)
app.put("/api/specs/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id))
      return res.status(400).json({ message: "Bad id" });

    const s = req.body || {};
    if (!s.criteria || !s.subCriteria || !s.specification || !s.class) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const crit = String(s.criteria);

    const rq = mssqlPool
      .request()
      .input("id", sql.Int, id)
      .input("criteria", sql.NVarChar, crit)
      .input("subCriteria", sql.NVarChar, s.subCriteria)
      .input("specification", sql.NVarChar, s.specification)
      .input("class", sql.NVarChar, s.class)
      .input(
        "description",
        sql.NVarChar,
        crit === "Visual" ? s.description || null : null
      )
      .input(
        "sampling",
        sql.NVarChar,
        crit === "MQP" ? s.sampling || null : null
      )
      .input(
        "typeOfCheck",
        sql.NVarChar,
        crit === "MQP" ? s.typeOfCheck || null : null
      );

    const { rowsAffected } = await rq.query(`
      UPDATE dbo.QAPSpecifications
      SET criteria=@criteria,
          subCriteria=@subCriteria,
          specification=@specification,
          [class]=@class,
          [description]=@description,
          sampling=@sampling,
          typeOfCheck=@typeOfCheck
      WHERE id=@id;
    `);

    if (!rowsAffected[0]) return res.status(404).json({ message: "Not found" });

    const row = (
      await mssqlPool
        .request()
        .input("id", sql.Int, id)
        .query(
          `SELECT id, criteria, subCriteria, specification, [class] AS class,
                  [description], sampling, typeOfCheck, sno
           FROM dbo.QAPSpecifications WHERE id=@id`
        )
    ).recordset[0];

    res.json(asUiSpec(row));
  } catch (e) {
    console.error("PUT /api/specs/:id", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/specs/:id
app.delete("/api/specs/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id))
      return res.status(400).json({ message: "Bad id" });
    const { rowsAffected } = await mssqlPool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM dbo.QAPSpecifications WHERE id=@id");
    if (!rowsAffected[0]) return res.status(404).json({ message: "Not found" });
    res.json({ message: "deleted" });
  } catch (e) {
    console.error("DELETE /api/specs/:id", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/specs/reorder  { criteria, ids: string[] }  (set sno by order)
app.post("/api/specs/reorder", authenticateToken, async (req, res) => {
  try {
    const { criteria, ids } = req.body || {};
    if ((criteria !== "MQP" && criteria !== "Visual") || !Array.isArray(ids))
      return res.status(400).json({ message: "Bad payload" });

    const tx = new sql.Transaction(mssqlPool);
    await tx.begin();
    try {
      // first null out to avoid duplicates, then set in order
      await new sql.Request(tx)
        .input("crit", sql.NVarChar, criteria)
        .query(
          `UPDATE dbo.QAPSpecifications SET sno=NULL WHERE criteria=@crit`
        );

      for (let i = 0; i < ids.length; i++) {
        const idInt = parseInt(String(ids[i]), 10);
        if (!Number.isFinite(idInt)) continue;
        await new sql.Request(tx)
          .input("id", sql.Int, idInt)
          .input("sno", sql.Int, i + 1)
          .query(`UPDATE dbo.QAPSpecifications SET sno=@sno WHERE id=@id`);
      }

      await tx.commit();
      res.json({ message: "ok" });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (e) {
    console.error("POST /api/specs/reorder", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---- BOM API ----
function rowsToBomComponents(rows) {
  // rows: one per option (or null option fields if none)
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.componentName)) {
      byName.set(r.componentName, {
        id: r.componentName, // UI uses id:string; we'll use the PK name
        name: r.componentName,
        technology: r.technology || "M10", // derived from ModelMaster; default for UI
        options: [],
      });
    }
    if (r.optionId) {
      byName.get(r.componentName).options.push({
        model: r.model,
        subVendor: r.subVendor || null,
        spec: r.spec || null,
      });
    }
  }

  // If a component has mixed technologies (different models), keep the first non-null
  return Array.from(byName.values());
}

app.get("/api/bom-components", authenticateToken, async (_req, res) => {
  try {
    const { recordset } = await mssqlPool.request().query(`
      SELECT
        c.name AS componentName,
        c.position,
        o.id AS optionId,
        o.model,
        o.subVendor,
        o.spec,
        mm.technology
      FROM dbo.BomComponents c
      LEFT JOIN dbo.BomComponentOptions o ON o.componentName = c.name
      LEFT JOIN dbo.ModelMaster mm ON mm.model = o.model
      ORDER BY c.position, c.name, o.id
    `);
    res.json(rowsToBomComponents(recordset));
  } catch (e) {
    console.error("GET /api/bom-components", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/bom-components
app.post("/api/bom-components", authenticateToken, async (req, res) => {
  const p = req.body || {};
  try {
    if (!COMP_SET.has(p.name))
      return res.status(400).json({ message: "Invalid component name" });
    if (!TECH_SET.has(p.technology))
      return res.status(400).json({ message: "Invalid technology" });

    const opts = Array.isArray(p.options) ? p.options : [];
    const options = opts
      .filter((o) => o && typeof o.model === "string" && o.model.trim())
      .map((o) => ({
        model: String(o.model).trim(),
        subVendor: o.subVendor?.toString().trim() || null,
        spec: o.spec?.toString().trim() || null,
      }));
    if (!options.length)
      return res
        .status(400)
        .json({ message: "At least one option with a model is required" });

    const tx = new sql.Transaction(mssqlPool);
    await tx.begin();
    try {
      // position = max+1
      const nextPos = (
        await tx
          .request()
          .query("SELECT ISNULL(MAX(position),0)+1 AS n FROM dbo.BomComponents")
      ).recordset[0].n;

      await tx
        .request()
        .input("n", sql.NVarChar, p.name)
        .input("pos", sql.Int, nextPos)
        .query(
          "INSERT INTO dbo.BomComponents(name, position) VALUES (@n, @pos)"
        );

      for (const o of options) {
        await tx
          .request()
          .input("cn", sql.NVarChar, p.name)
          .input("m", sql.NVarChar, o.model)
          .input("sv", sql.NVarChar, o.subVendor)
          .input("sp", sql.NVarChar, o.spec)
          .query(`INSERT INTO dbo.BomComponentOptions(componentName, model, subVendor, spec)
                  VALUES (@cn, @m, @sv, @sp)`);

        // ensure model exists in ModelMaster with given technology (insert if missing)
        await tx
          .request()
          .input("model", sql.NVarChar, o.model)
          .input("tech", sql.NVarChar, p.technology).query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.ModelMaster WHERE model=@model)
              INSERT INTO dbo.ModelMaster(model, technology) VALUES (@model, @tech);
          `);
      }

      await tx.commit();

      // return the single component freshly loaded
      const rows = (
        await mssqlPool.request().input("n", sql.NVarChar, p.name).query(`
            SELECT c.name AS componentName, c.position,
                   o.id AS optionId, o.model, o.subVendor, o.spec,
                   mm.technology
            FROM dbo.BomComponents c
            LEFT JOIN dbo.BomComponentOptions o ON o.componentName = c.name
            LEFT JOIN dbo.ModelMaster mm ON mm.model = o.model
            WHERE c.name=@n
            ORDER BY o.id
          `)
      ).recordset;

      res.status(201).json(rowsToBomComponents(rows)[0]);
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (e) {
    console.error("POST /api/bom-components", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/bom-components/:id
app.put("/api/bom-components/:id", authenticateToken, async (req, res) => {
  const id = req.params.id; // current name
  const p = req.body || {};
  try {
    if (p.name && !COMP_SET.has(p.name))
      return res.status(400).json({ message: "Invalid component name" });
    if (p.technology && !TECH_SET.has(p.technology))
      return res.status(400).json({ message: "Invalid technology" });

    const newName = p.name || id;
    const options = (Array.isArray(p.options) ? p.options : [])
      .filter((o) => o && typeof o.model === "string" && o.model.trim())
      .map((o) => ({
        model: String(o.model).trim(),
        subVendor: o.subVendor?.toString().trim() || null,
        spec: o.spec?.toString().trim() || null,
      }));
    if (!options.length)
      return res
        .status(400)
        .json({ message: "At least one option with a model is required" });

    const tx = new sql.Transaction(mssqlPool);
    await tx.begin();
    try {
      // ensure component exists
      const exists = (
        await tx
          .request()
          .input("id", sql.NVarChar, id)
          .query("SELECT name FROM dbo.BomComponents WHERE name=@id")
      ).recordset.length;
      if (!exists) {
        await tx.rollback();
        return res.status(404).json({ message: "Not found" });
      }

      // rename if needed
      if (newName !== id) {
        await tx
          .request()
          .input("old", sql.NVarChar, id)
          .input("nn", sql.NVarChar, newName)
          .query(
            "UPDATE dbo.BomComponents SET name=@nn WHERE name=@old; UPDATE dbo.BomComponentOptions SET componentName=@nn WHERE componentName=@old;"
          );
      }

      // replace options
      await tx
        .request()
        .input("n", sql.NVarChar, newName)
        .query("DELETE FROM dbo.BomComponentOptions WHERE componentName=@n");

      for (const o of options) {
        await tx
          .request()
          .input("cn", sql.NVarChar, newName)
          .input("m", sql.NVarChar, o.model)
          .input("sv", sql.NVarChar, o.subVendor)
          .input("sp", sql.NVarChar, o.spec)
          .query(`INSERT INTO dbo.BomComponentOptions(componentName, model, subVendor, spec)
                  VALUES (@cn, @m, @sv, @sp)`);

        if (p.technology) {
          await tx
            .request()
            .input("model", sql.NVarChar, o.model)
            .input("tech", sql.NVarChar, p.technology).query(`
              IF NOT EXISTS (SELECT 1 FROM dbo.ModelMaster WHERE model=@model)
                INSERT INTO dbo.ModelMaster(model, technology) VALUES (@model, @tech);
            `);
        }
      }

      await tx.commit();

      const rows = (
        await mssqlPool.request().input("n", sql.NVarChar, newName).query(`
            SELECT c.name AS componentName, c.position,
                   o.id AS optionId, o.model, o.subVendor, o.spec, mm.technology
            FROM dbo.BomComponents c
            LEFT JOIN dbo.BomComponentOptions o ON o.componentName = c.name
            LEFT JOIN dbo.ModelMaster mm ON mm.model = o.model
            WHERE c.name=@n
            ORDER BY o.id
          `)
      ).recordset;

      res.json(rowsToBomComponents(rows)[0]);
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (e) {
    console.error("PUT /api/bom-components/:id", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/bom-components/:id
app.delete("/api/bom-components/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const r = await mssqlPool.request().input("n", sql.NVarChar, id).query(`
      DELETE FROM dbo.BomComponentOptions WHERE componentName=@n;
      DELETE FROM dbo.BomComponents       WHERE name=@n;
    `);
    res.status(204).send("");
  } catch (e) {
    console.error("DELETE /api/bom-components/:id", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/bom-components/reorder  { ids: string[] }
// body: { ids: string[] } where ids are component names in desired order
app.post("/api/bom-components/reorder", authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length)
      return res.status(400).json({ message: "ids required" });

    let rq = mssqlPool.request();
    const whens = ids.map((name, i) => {
      rq = rq.input("n" + i, sql.NVarChar, name).input("p" + i, sql.Int, i + 1);
      return `WHEN name=@n${i} THEN @p${i}`;
    });

    await rq.query(`
      UPDATE dbo.BomComponents
      SET position = CASE ${whens.join(" ")} ELSE position END
      WHERE name IN (${ids.map((_, i) => `@n${i}`).join(", ")})
    `);

    res.json({ message: "ok" });
  } catch (e) {
    console.error("POST /api/bom-components/reorder", e);
    res.status(500).json({ message: "Server error" });
  }
});

// certificates for HTTPS
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "mydomain.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "d466aacf3db3f299.crt")),
  ca: fs.readFileSync(path.join(__dirname, "certs", "gd_bundle-g2-g1.crt")),
};

// environment
const PORT = Number(process.env.PORT) || 11443;
const HOST = process.env.HOST || "0.0.0.0";

// start server
async function start() {
  try {
    await initDatabases();
    https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
      console.log(
        `🔒  HTTPS ready → https://${
          HOST === "0.0.0.0" ? "localhost" : HOST
        }:${PORT}`
      );
    });
  } catch (err) {
    console.error("❌  Server start failed:", err);
    process.exit(1);
  }
}
start();
