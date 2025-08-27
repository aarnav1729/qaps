// required modules
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const sql = require("mssql");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { body, param, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const https = require("https");
const app = express();

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
  changes        NVARCHAR(MAX)   NULL       -- JSON array of { field, before, after }
);

    `);

    console.log("✅ MSSQL schema ensured");
  } catch (err) {
    console.error("❌ MSSQL init error:", err);
  }
}

// call + connect init
async function initDatabases() {
  await initMssql();
}
initDatabases();

// session management via JWT in httpOnly cookie
const JWT_SECRET =
  process.env.JWT_SECRET || "please_change_me_to_a_strong_secret";
const JWT_EXPIRES_IN = "2h";

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

// ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// serve static uploads
app.use("/uploads", express.static(uploadDir));

const distDir = path.join(__dirname, "dist");
const indexHtml = path.join(distDir, "index.html");

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

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 10MB
});

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
    const result = masters.map((m) => ({
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
          comments: JSON.parse(r.comments || "{}"),
          respondedAt: r.respondedAt,
        };
        return o;
      }, {}),

      // ── convenience: parsed per-item final comments ─────────────
      finalCommentsPerItem:
        m.finalComments && m.finalComments.trim().startsWith("{")
          ? JSON.parse(m.finalComments)
          : {},

      // ── new: embed the linked Sales Request (if any) ────────────
      salesRequest:
        m.salesRequestId && srById[m.salesRequestId]
          ? srById[m.salesRequestId]
          : undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /api/qaps error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/qaps/for-review → list QAPs with unmatched items for this user’s role
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
    const reviewable = masters
      .map((m) => {
        const specs = [...(mqpMap[m.id] || []), ...(visMap[m.id] || [])];
        const lrsp = (respMap[m.id] || []).reduce((o, r) => {
          o[r.level] = o[r.level] || {};
          o[r.level][r.role] = {
            username: r.username,
            acknowledged: !!r.acknowledged,
            comments: JSON.parse(r.comments || "{}"),
            respondedAt: r.respondedAt,
          };
          return o;
        }, {});

        return {
          ...m,
          specs: {
            mqp: mqpMap[m.id] || [],
            visual: visMap[m.id] || [],
          },
          levelResponses: lrsp,
          // embed SR for the UI BOM tab
          salesRequest:
            m.salesRequestId && srById[m.salesRequestId]
              ? srById[m.salesRequestId]
              : undefined,
        };
      })
      .filter((qap) =>
        // keep only if there *is* at least one unmatched spec for this role
        [...qap.specs.mqp, ...qap.specs.visual].some(
          (spec) =>
            spec.match === "no" &&
            spec.reviewBy
              .split(",")
              .map((r) => r.trim())
              .includes(userRole)
        )
      );

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
      }

      res.json({
        ...master,
        specs: { mqp, visual },
        levelResponses: resp,
        timeline: tl,
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
                currentLevel, createdAt, lastModifiedAt, salesRequestId
              )
              VALUES (
                @id,@c,@p,@o,
                @pt,@pl,@s,@sb,SYSUTCDATETIME(),
                @cl,SYSUTCDATETIME(),SYSUTCDATETIME(),@srid
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
              .input("rb", sql.NVarChar, (sp.reviewBy || []).join(",") || null)
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
              .input("rb", sql.NVarChar, (sp.reviewBy || []).join(",") || null)
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

// PUT /api/qaps/:id → update a QAP (master fields + full specs replace)  [UPDATED: supports salesRequestId]
app.put(
  "/api/qaps/:id",
  [
    authenticateToken,
    param("id").isUUID(),
    // only validate fields you actually support
    body("customerName").optional().isString(),
    body("projectName").optional().isString(),
    body("projectCode").optional().isString(),
    body("orderQuantity").optional().isInt({ gt: 0 }),
    body("productType").optional().isString(),
    body("plant").optional().isString(),
    body("status").optional().isString(),
    body("currentLevel").optional().isInt({ min: 1, max: 5 }),
    body("specs").optional().isObject(),
    body("salesRequestId").optional({ nullable: true }).isUUID(), // <── NEW
    handleValidation,
  ],
  async (req, res) => {
    const { id } = req.params;

    // Build up master‐row updates
    const fields = [
      "customerName",
      "projectName",
      "projectCode",
      "orderQuantity",
      "productType",
      "plant",
      "status",
      "submittedBy",
      "currentLevel",
      "finalComments",
      "finalCommentsBy",
      "finalCommentsAt",
      "finalAttachmentName",
      "finalAttachmentUrl",
      "approver",
      "approvedAt",
      "feedback",
      "salesRequestId", // <── NEW
    ];
    const updates = [];
    const inputs = {};

    // Handle salesRequestId normalization & validation
    if ("salesRequestId" in req.body) {
      const raw = req.body.salesRequestId;
      const normalized = raw === null || raw === "" ? null : String(raw).trim();
      if (normalized) {
        // validate SR existence
        const v = await mssqlPool
          .request()
          .input("sid", sql.UniqueIdentifier, normalized)
          .query("SELECT id FROM SalesRequests WHERE id=@sid");
        if (!v.recordset.length) {
          return res.status(400).json({ message: "Invalid salesRequestId" });
        }
      }
      updates.push("salesRequestId=@salesRequestId");
      inputs.salesRequestId = normalized;
    }

    for (const f of fields) {
      if (f === "salesRequestId") continue; // already handled above
      if (req.body[f] !== undefined) {
        updates.push(`${f}=@${f}`);
        inputs[f] = req.body[f];
      }
    }
    // nothing to do?
    if (!updates.length && !req.body.specs)
      return res.status(400).json({ message: "Nothing to update" });

    try {
      await tryMssql(async (db) => {
        if (db !== mssqlPool) return;

        // 1) Update the QAP master row
        let r = mssqlPool.request().input("id", sql.UniqueIdentifier, id);
        for (const clause of updates) {
          const key = clause.match(/^(\w+)/)[1];
          const val = inputs[key];
          // proper SQL types per column
          let type;
          if (key === "orderQuantity") type = sql.Int;
          else if (key.endsWith("At")) type = sql.DateTime2;
          else if (key === "salesRequestId")
            type = sql.UniqueIdentifier; // <── NEW
          else type = sql.NVarChar;
          r = r.input(key, type, val);
        }
        await r.query(`
          UPDATE QAPs
          SET ${updates.join(",")}, lastModifiedAt=SYSUTCDATETIME()
          WHERE id=@id;
        `);

        // 2) If specs were sent, delete old and re-insert
        if (req.body.specs) {
          await mssqlPool.request().input("id", sql.UniqueIdentifier, id)
            .query(`
              DELETE FROM MQPSpecs   WHERE qapId=@id;
              DELETE FROM VisualSpecs WHERE qapId=@id;
            `);

          // helper to normalize reviewBy
          const normalize = (v) =>
            Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : null;

          // re-insert MQP specs
          for (const sp of req.body.specs.mqp || []) {
            const rb = normalize(sp.reviewBy);
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
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
              .input("rb", sql.NVarChar, rb).query(`
                INSERT INTO MQPSpecs
                  (qapId,sno,subCriteria,componentOperation,characteristics,
                   class,typeOfCheck,sampling,specification,[match],
                   customerSpecification,reviewBy)
                VALUES
                  (@id,@sno,@sub,@co,@ch,@clz,@tc,@sm,@spx,@m,@cs,@rb);
              `);
          }

          // re-insert Visual specs
          for (const sp of req.body.specs.visual || []) {
            const rb = normalize(sp.reviewBy);
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
              .input("sno", sql.Int, sp.sno)
              .input("sub", sql.NVarChar, sp.subCriteria)
              .input("df", sql.NVarChar, sp.defect)
              .input("dc", sql.NVarChar, sp.defectClass)
              .input("ds", sql.NVarChar, sp.description)
              .input("clz", sql.NVarChar, sp.criteriaLimits)
              .input("m", sql.NVarChar, sp.match || null)
              .input("cs", sql.NVarChar, sp.customerSpecification || null)
              .input("rb", sql.NVarChar, rb).query(`
                INSERT INTO VisualSpecs
                  (qapId,sno,subCriteria,defect,defectClass,description,
                   criteriaLimits,[match],customerSpecification,reviewBy)
                VALUES
                  (@id,@sno,@sub,@df,@dc,@ds,@clz,@m,@cs,@rb);
              `);
          }
        }
      });

      res.json({ message: "QAP updated" });
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
      const upsert = tx.request();
      upsert
        .input("qapId", sql.UniqueIdentifier, id)
        .input("lvl", sql.Int, level)
        .input("rl", sql.NVarChar, responderRole)
        .input("un", sql.NVarChar, req.user.username)
        .input("ack", sql.Bit, 1)
        .input("dt", sql.DateTime2, respondedAt)
        .input("cm", sql.NVarChar, JSON.stringify(comments));
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

      // 2) Add a timeline entry for this review
      const tl = tx.request();
      tl.input("qapId", sql.UniqueIdentifier, id)
        .input("lvl", sql.Int, level)
        .input("un", sql.NVarChar, req.user.username)
        .input("ts", sql.DateTime2, respondedAt);
      await tl.query(`
        INSERT INTO TimelineEntries (qapId, level, action, [user], timestamp)
        VALUES (
          @qapId, @lvl,
          'Level ' + CAST(@lvl AS NVARCHAR(10)) + ' reviewed by ' + @un,
          @un, @ts
        );
      `);

      // 3) If this was Level 2, see if *all* required roles have now responded…
      if (level === 2) {
        const mqpRows = (
          await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .query(
              `SELECT reviewBy FROM MQPSpecs WHERE qapId=@qapId AND [match]='no'`
            )
        ).recordset;
        const visRows = (
          await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .query(
              `SELECT reviewBy FROM VisualSpecs WHERE qapId=@qapId AND [match]='no'`
            )
        ).recordset;

        const required = Array.from(
          new Set(
            [...mqpRows, ...visRows].flatMap((r) =>
              (r.reviewBy || "")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
            )
          )
        );

        const doneRows = (
          await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .input("lvl2", sql.Int, level)
            .query(
              `SELECT role FROM LevelResponses WHERE qapId=@qapId AND level=@lvl2 AND acknowledged=1`
            )
        ).recordset;
        const done = doneRows.map((r) => r.role);

        if (required.every((r) => done.includes(r))) {
          // fetch plant
          const { recordset } = await tx
            .request()
            .input("qapId", sql.UniqueIdentifier, id)
            .query(`SELECT plant FROM QAPs WHERE id=@qapId`);
          const plant = recordset[0]?.plant.trim().toLowerCase();

          if (plant === "p2") {
            // skip Level 3, go straight to Level 4
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
            // normal path to Level 3
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

// GET /api/spec-templates → list available spec templates
app.get("/api/spec-templates", authenticateToken, async (req, res) => {
  // simply combine your in‑memory arrays
  const { qapSpecifications } = require("../src/data/qapSpecification");
  res.json(qapSpecifications);
});

// POST /api/spec-templates → create a new spec template (admin only)
app.post(
  "/api/spec-templates",
  authenticateToken,
  authorizeRole("admin"),
  body("criteria").isString(),
  body("subCriteria").isString(),
  body("class").isString(),
  handleValidation,
  (req, res) => {
    // in real life you’d persist to a `SpecTemplates` table
    // for now, just echo back
    res.status(201).json(req.body);
  }
);

// helper for file URLs under sales-requests
const PUBLIC_APP_URL = process.env.APP_URL || "https://localhost:11443";
const fileUrl = (fileName) => `${PUBLIC_APP_URL}/uploads/${fileName}`;

// helper to parse numbers from form data
const intOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// helper to parse decimal numbers from form data
const decOrZero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// helper to parse yes/no from form data
const yesNo = (v) => (v === "yes" ? "yes" : v === "no" ? "no" : "no");

// helper to pick only certain keys from an object
const pick = (o, keys) =>
  keys.reduce(
    (acc, k) => (o[k] !== undefined ? ((acc[k] = o[k]), acc) : acc),
    {}
  );

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

// function to inflate a sales request row from DB + associated files into API response
function inflateSalesRequestRow(row, filesMap) {
  const files = filesMap ? filesMap[row.id] || [] : [];
  return {
    id: row.id,
    projectCode: row.projectCode,
    customerName: row.customerName,
    isNewCustomer: row.isNewCustomer,
    moduleManufacturingPlant: row.moduleManufacturingPlant,
    moduleOrderType: row.moduleOrderType,
    cellType: row.cellType,
    wattageBinning: row.wattageBinning,
    rfqOrderQtyMW: row.rfqOrderQtyMW,
    premierBiddedOrderQtyMW: row.premierBiddedOrderQtyMW,
    deliveryStartDate:
      row.deliveryStartDate?.toISOString?.().slice(0, 10) ??
      row.deliveryStartDate,
    deliveryEndDate:
      row.deliveryEndDate?.toISOString?.().slice(0, 10) ?? row.deliveryEndDate,
    projectLocation: row.projectLocation,
    cableLengthRequired: row.cableLengthRequired,
    qapType: row.qapType,
    qapTypeAttachmentUrl: row.qapTypeAttachmentUrl,
    primaryBom: row.primaryBom,
    primaryBomAttachmentUrl: row.primaryBomAttachmentUrl,
    inlineInspection: row.inlineInspection,
    cellProcuredBy: row.cellProcuredBy,
    agreedCTM: Number(row.agreedCTM),
    factoryAuditTentativeDate: row.factoryAuditTentativeDate
      ? row.factoryAuditTentativeDate.toISOString?.().slice(0, 10) ??
        row.factoryAuditTentativeDate
      : null,
    xPitchMm: row.xPitchMm,
    trackerDetails: row.trackerDetails,
    priority: row.priority,
    remarks: row.remarks,
    otherAttachments: files.map((f) => ({
      title: f.title || null,
      url: f.url,
    })),
    createdBy: row.createdBy,
    createdAt: row.createdAt, // Express will serialize as ISO
    bom: (() => {
      try {
        return row.bom ? JSON.parse(row.bom) : undefined;
      } catch {
        return undefined;
      }
    })(),
  };
}

// GET /api/sales-requests → list all sales requests
app.get("/api/sales-requests", authenticateToken, async (req, res) => {
  try {
    const { projectCode } = req.query || {};
    let masters = [];
    await tryMssql(async (db) => {
      if (db === mssqlPool) {
        let rq = mssqlPool.request();
        let sqlText = "SELECT * FROM SalesRequests";
        if (projectCode) {
          rq = rq.input("pc", sql.NVarChar, String(projectCode));
          sqlText += " WHERE projectCode=@pc";
        }
        sqlText += " ORDER BY createdAt DESC";
        masters = (await rq.query(sqlText)).recordset;
      }
    });

    if (!masters.length) return res.json([]);

    const ids = masters.map((m) => m.id);
    let files = [];
    await tryMssql(async (db) => {
      if (db === mssqlPool) {
        let r = mssqlPool.request();
        const inClause = ids.map((_, i) => `@id${i}`).join(",");
        ids.forEach(
          (id, i) => (r = r.input(`id${i}`, sql.UniqueIdentifier, id))
        );
        files = (
          await r.query(
            `SELECT * FROM SalesRequestFiles WHERE salesRequestId IN (${inClause}) ORDER BY id`
          )
        ).recordset;
      }
    });
    const filesMap = files.reduce((acc, f) => {
      (acc[f.salesRequestId] ||= []).push(f);
      return acc;
    }, {});

    res.json(masters.map((row) => inflateSalesRequestRow(row, filesMap)));
  } catch (e) {
    console.error("GET /api/sales-requests error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/sales-requests/:id → get a specific sales request by ID
app.get(
  "/api/sales-requests/:id",
  authenticateToken,
  param("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      let row;
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          row = (
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
              .query("SELECT * FROM SalesRequests WHERE id=@id")
          ).recordset[0];
        }
      });
      if (!row) return res.status(404).json({ message: "Not found" });

      let files = [];
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          files = (
            await mssqlPool
              .request()
              .input("id", sql.UniqueIdentifier, id)
              .query(
                "SELECT * FROM SalesRequestFiles WHERE salesRequestId=@id ORDER BY id"
              )
          ).recordset;
        }
      });
      const filesMap = { [id]: files };
      res.json(inflateSalesRequestRow(row, filesMap));
    } catch (e) {
      console.error("GET /api/sales-requests/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /api/sales-requests → create a new sales request
app.post(
  "/api/sales-requests",
  authenticateToken,
  salesRequestUpload,
  async (req, res) => {
    const f = req.body; // multipart fields arrive as strings

    // uploaded files
    const qapTypeFile = (req.files?.qapTypeAttachment || [])[0];
    const primaryBomFile = (req.files?.primaryBomAttachment || [])[0];
    const otherFiles = req.files?.otherAttachments || [];

    // optional titles for "otherAttachments"
    let otherTitles = [];
    try {
      otherTitles = JSON.parse(f.otherAttachmentTitles || "[]");
      if (!Array.isArray(otherTitles)) otherTitles = [];
    } catch {
      otherTitles = [];
    }

    const newId = require("crypto").randomUUID();
    const now = new Date();
    const createdBy = req.user?.username || f.createdBy || "sales";
    const actor = req.user?.username || createdBy; // who to log in history

    const code = makeProjectCode({
      customerName: f.customerName,
      rfqOrderQtyMW: f.rfqOrderQtyMW,
      projectLocation: f.projectLocation,
      date: now,
    });

    const tx = new sql.Transaction(mssqlPool);
    try {
      await tx.begin();

      // 1) insert master
      const rq = tx
        .request()
        .input("id", sql.UniqueIdentifier, newId)
        .input("customerName", sql.NVarChar, f.customerName?.trim() || "")
        .input("isNewCustomer", sql.NVarChar, yesNo(f.isNewCustomer))
        .input(
          "moduleManufacturingPlant",
          sql.NVarChar,
          (f.moduleManufacturingPlant || "").toLowerCase()
        )
        .input(
          "moduleOrderType",
          sql.NVarChar,
          (f.moduleOrderType || "").toLowerCase()
        )
        .input("cellType", sql.NVarChar, f.cellType || "DCR")
        .input("wattageBinning", sql.Int, intOrNull(f.wattageBinning) ?? 0)
        .input("rfqOrderQtyMW", sql.Int, intOrNull(f.rfqOrderQtyMW) ?? 0)
        .input(
          "premierBiddedOrderQtyMW",
          sql.Int,
          intOrNull(f.premierBiddedOrderQtyMW)
        )
        .input("deliveryStartDate", sql.Date, f.deliveryStartDate)
        .input("deliveryEndDate", sql.Date, f.deliveryEndDate)
        .input("projectLocation", sql.NVarChar, f.projectLocation?.trim() || "")
        .input(
          "cableLengthRequired",
          sql.Int,
          intOrNull(f.cableLengthRequired) ?? 0
        )
        .input("qapType", sql.NVarChar, f.qapType || "Customer")
        .input(
          "qapTypeAttachmentName",
          sql.NVarChar,
          qapTypeFile?.filename || null
        )
        .input(
          "qapTypeAttachmentUrl",
          sql.NVarChar,
          qapTypeFile ? fileUrl(qapTypeFile.filename) : null
        )
        .input("primaryBom", sql.NVarChar, yesNo(f.primaryBom))
        .input(
          "primaryBomAttachmentName",
          sql.NVarChar,
          primaryBomFile?.filename || null
        )
        .input(
          "primaryBomAttachmentUrl",
          sql.NVarChar,
          primaryBomFile ? fileUrl(primaryBomFile.filename) : null
        )
        .input("inlineInspection", sql.NVarChar, yesNo(f.inlineInspection))
        .input("cellProcuredBy", sql.NVarChar, f.cellProcuredBy || "Customer")
        .input("agreedCTM", sql.Decimal(18, 8), decOrZero(f.agreedCTM))
        .input(
          "factoryAuditTentativeDate",
          sql.Date,
          f.factoryAuditTentativeDate || null
        )
        .input("xPitchMm", sql.Int, intOrNull(f.xPitchMm))
        .input("trackerDetails", sql.Int, intOrNull(f.trackerDetails))
        .input("priority", sql.NVarChar, f.priority || "low")
        .input("remarks", sql.NVarChar, f.remarks || null)
        .input("createdBy", sql.NVarChar, createdBy)
        .input("createdAt", sql.DateTime2, now)
        .input("projectCode", sql.NVarChar, code)
        .input("bom", sql.NVarChar, f.bom || null);

      await rq.query(`
        INSERT INTO SalesRequests (
          id, customerName, isNewCustomer, moduleManufacturingPlant,
          moduleOrderType, cellType, wattageBinning, rfqOrderQtyMW,
          premierBiddedOrderQtyMW, deliveryStartDate, deliveryEndDate,
          projectLocation, cableLengthRequired, qapType,
          qapTypeAttachmentName, qapTypeAttachmentUrl,
          primaryBom, primaryBomAttachmentName, primaryBomAttachmentUrl,
          inlineInspection, cellProcuredBy, agreedCTM, factoryAuditTentativeDate,
          xPitchMm, trackerDetails, priority, remarks, createdBy, createdAt, bom, projectCode
        )
        VALUES (
          @id, @customerName, @isNewCustomer, @moduleManufacturingPlant,
          @moduleOrderType, @cellType, @wattageBinning, @rfqOrderQtyMW,
          @premierBiddedOrderQtyMW, @deliveryStartDate, @deliveryEndDate,
          @projectLocation, @cableLengthRequired, @qapType,
          @qapTypeAttachmentName, @qapTypeAttachmentUrl,
          @primaryBom, @primaryBomAttachmentName, @primaryBomAttachmentUrl,
          @inlineInspection, @cellProcuredBy, @agreedCTM, @factoryAuditTentativeDate,
          @xPitchMm, @trackerDetails, @priority, @remarks, @createdBy, @createdAt, @bom, @projectCode
        );
      `);

      // 2) insert child files (otherAttachments)
      if (otherFiles.length) {
        for (let i = 0; i < otherFiles.length; i++) {
          const ffile = otherFiles[i];
          const title = (otherTitles[i] || "").trim();
          await tx
            .request()
            .input("srid", sql.UniqueIdentifier, newId)
            .input("title", sql.NVarChar, title || null)
            .input("fn", sql.NVarChar, ffile.filename)
            .input("url", sql.NVarChar, fileUrl(ffile.filename)).query(`
              INSERT INTO SalesRequestFiles (salesRequestId, title, fileName, url)
              VALUES (@srid, @title, @fn, @url);
            `);
        }
      }

      // 3) fetch fresh row + files and write history
      const row = (
        await tx
          .request()
          .input("id", sql.UniqueIdentifier, newId)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      const files = (
        await tx
          .request()
          .input("id", sql.UniqueIdentifier, newId)
          .query(
            "SELECT * FROM SalesRequestFiles WHERE salesRequestId=@id ORDER BY id"
          )
      ).recordset;

      const afterSnap = snapshotForHistory(row, files);
      const changes = Object.keys(afterSnap).map((k) => ({
        field: k,
        before: null,
        after: afterSnap[k],
      }));

      await tx
        .request()
        .input("sid", sql.UniqueIdentifier, newId)
        .input("act", sql.NVarChar, "create")
        .input("by", sql.NVarChar, actor)
        .input("chg", sql.NVarChar, JSON.stringify(changes)).query(`
          INSERT INTO SalesRequestHistory (salesRequestId, action, changedBy, changes)
          VALUES (@sid, @act, @by, @chg);
        `);

      await tx.commit();

      // respond with the created entity
      return res
        .status(201)
        .json(inflateSalesRequestRow(row, { [newId]: files }));
    } catch (e) {
      try {
        await tx.rollback();
      } catch {}
      console.error("POST /api/sales-requests error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/sales-requests/:id → update an existing sales request
app.put(
  "/api/sales-requests/:id",
  authenticateToken,
  param("id").isUUID(),
  handleValidation,
  salesRequestUpload,
  async (req, res) => {
    const { id } = req.params;
    const f = req.body;

    // incoming files
    const qapTypeFile = (req.files?.qapTypeAttachment || [])[0];
    const primaryBomFile = (req.files?.primaryBomAttachment || [])[0];
    const otherFiles = req.files?.otherAttachments || [];
    let otherTitles = [];
    try {
      otherTitles = JSON.parse(f.otherAttachmentTitles || "[]");
      if (!Array.isArray(otherTitles)) otherTitles = [];
    } catch {
      otherTitles = [];
    }

    // removal flags
    const removeQap =
      f.removeQapTypeAttachment === "true" || f.removeQapTypeAttachment === "1";
    const removePrimary =
      f.removePrimaryBomAttachment === "true" ||
      f.removePrimaryBomAttachment === "1";
    let removeOtherIds = [];
    try {
      const tmp = JSON.parse(f.removeOtherAttachmentIds || "[]");
      if (Array.isArray(tmp))
        removeOtherIds = tmp.filter((x) => Number.isInteger(x));
    } catch {}

    const actor = req.user?.username || "sales";
    const tx = new sql.Transaction(mssqlPool);

    // we will delete physical files only AFTER commit succeeds
    const filesToUnlink = [];

    try {
      await tx.begin();

      // A) current row + files (BEFORE snapshot)
      const beforeRow = (
        await tx
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      if (!beforeRow) {
        await tx.rollback();
        return res.status(404).json({ message: "Not found" });
      }
      const beforeFiles = (
        await tx
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT * FROM SalesRequestFiles WHERE salesRequestId=@id ORDER BY id"
          )
      ).recordset;
      const beforeSnap = snapshotForHistory(beforeRow, beforeFiles);

      // B) build master UPDATE
      const fields = [];
      let reqt = tx.request().input("id", sql.UniqueIdentifier, id);

      const candidates = pick(f, [
        "customerName",
        "isNewCustomer",
        "moduleManufacturingPlant",
        "moduleOrderType",
        "cellType",
        "wattageBinning",
        "rfqOrderQtyMW",
        "premierBiddedOrderQtyMW",
        "deliveryStartDate",
        "deliveryEndDate",
        "projectLocation",
        "cableLengthRequired",
        "qapType",
        "primaryBom",
        "inlineInspection",
        "cellProcuredBy",
        "agreedCTM",
        "factoryAuditTentativeDate",
        "xPitchMm",
        "trackerDetails",
        "priority",
        "remarks",
        "bom",
      ]);

      if (candidates.customerName !== undefined) {
        fields.push("customerName=@customerName");
        reqt = reqt.input(
          "customerName",
          sql.NVarChar,
          candidates.customerName.trim()
        );
      }
      if (candidates.isNewCustomer !== undefined) {
        fields.push("isNewCustomer=@isNewCustomer");
        reqt = reqt.input(
          "isNewCustomer",
          sql.NVarChar,
          yesNo(candidates.isNewCustomer)
        );
      }
      if (candidates.moduleManufacturingPlant !== undefined) {
        fields.push("moduleManufacturingPlant=@moduleManufacturingPlant");
        reqt = reqt.input(
          "moduleManufacturingPlant",
          sql.NVarChar,
          candidates.moduleManufacturingPlant.toLowerCase()
        );
      }
      if (candidates.moduleOrderType !== undefined) {
        fields.push("moduleOrderType=@moduleOrderType");
        reqt = reqt.input(
          "moduleOrderType",
          sql.NVarChar,
          candidates.moduleOrderType.toLowerCase()
        );
      }
      if (candidates.cellType !== undefined) {
        fields.push("cellType=@cellType");
        reqt = reqt.input("cellType", sql.NVarChar, candidates.cellType);
      }
      if (candidates.wattageBinning !== undefined) {
        fields.push("wattageBinning=@wattageBinning");
        reqt = reqt.input(
          "wattageBinning",
          sql.Int,
          intOrNull(candidates.wattageBinning) ?? 0
        );
      }
      if (candidates.rfqOrderQtyMW !== undefined) {
        fields.push("rfqOrderQtyMW=@rfqOrderQtyMW");
        reqt = reqt.input(
          "rfqOrderQtyMW",
          sql.Int,
          intOrNull(candidates.rfqOrderQtyMW) ?? 0
        );
      }
      if (candidates.premierBiddedOrderQtyMW !== undefined) {
        fields.push("premierBiddedOrderQtyMW=@premierBiddedOrderQtyMW");
        reqt = reqt.input(
          "premierBiddedOrderQtyMW",
          sql.Int,
          intOrNull(candidates.premierBiddedOrderQtyMW)
        );
      }
      if (candidates.deliveryStartDate !== undefined) {
        fields.push("deliveryStartDate=@deliveryStartDate");
        reqt = reqt.input(
          "deliveryStartDate",
          sql.Date,
          candidates.deliveryStartDate || null
        );
      }
      if (candidates.deliveryEndDate !== undefined) {
        fields.push("deliveryEndDate=@deliveryEndDate");
        reqt = reqt.input(
          "deliveryEndDate",
          sql.Date,
          candidates.deliveryEndDate || null
        );
      }
      if (candidates.projectLocation !== undefined) {
        fields.push("projectLocation=@projectLocation");
        reqt = reqt.input(
          "projectLocation",
          sql.NVarChar,
          candidates.projectLocation.trim()
        );
      }
      if (candidates.cableLengthRequired !== undefined) {
        fields.push("cableLengthRequired=@cableLengthRequired");
        reqt = reqt.input(
          "cableLengthRequired",
          sql.Int,
          intOrNull(candidates.cableLengthRequired) ?? 0
        );
      }
      if (candidates.qapType !== undefined) {
        fields.push("qapType=@qapType");
        reqt = reqt.input("qapType", sql.NVarChar, candidates.qapType);
      }
      if (candidates.primaryBom !== undefined) {
        fields.push("primaryBom=@primaryBom");
        reqt = reqt.input(
          "primaryBom",
          sql.NVarChar,
          yesNo(candidates.primaryBom)
        );
      }
      if (candidates.inlineInspection !== undefined) {
        fields.push("inlineInspection=@inlineInspection");
        reqt = reqt.input(
          "inlineInspection",
          sql.NVarChar,
          yesNo(candidates.inlineInspection)
        );
      }
      if (candidates.cellProcuredBy !== undefined) {
        fields.push("cellProcuredBy=@cellProcuredBy");
        reqt = reqt.input(
          "cellProcuredBy",
          sql.NVarChar,
          candidates.cellProcuredBy
        );
      }
      if (candidates.agreedCTM !== undefined) {
        fields.push("agreedCTM=@agreedCTM");
        reqt = reqt.input(
          "agreedCTM",
          sql.Decimal(18, 8),
          decOrZero(candidates.agreedCTM)
        );
      }
      if (candidates.factoryAuditTentativeDate !== undefined) {
        fields.push("factoryAuditTentativeDate=@factoryAuditTentativeDate");
        reqt = reqt.input(
          "factoryAuditTentativeDate",
          sql.Date,
          candidates.factoryAuditTentativeDate || null
        );
      }
      if (candidates.xPitchMm !== undefined) {
        fields.push("xPitchMm=@xPitchMm");
        reqt = reqt.input("xPitchMm", sql.Int, intOrNull(candidates.xPitchMm));
      }
      if (candidates.trackerDetails !== undefined) {
        fields.push("trackerDetails=@trackerDetails");
        reqt = reqt.input(
          "trackerDetails",
          sql.Int,
          intOrNull(candidates.trackerDetails)
        );
      }
      if (candidates.priority !== undefined) {
        fields.push("priority=@priority");
        reqt = reqt.input("priority", sql.NVarChar, candidates.priority);
      }
      if (candidates.remarks !== undefined) {
        fields.push("remarks=@remarks");
        reqt = reqt.input("remarks", sql.NVarChar, candidates.remarks || null);
      }
      if (candidates.bom !== undefined) {
        fields.push("bom=@bom");
        reqt = reqt.input("bom", sql.NVarChar, candidates.bom || null);
      }

      // ── projectCode: recompute when key inputs change ───────────────────────
      const nameChanged = candidates.customerName !== undefined;
      const qtyChanged = candidates.rfqOrderQtyMW !== undefined;
      const locChanged = candidates.projectLocation !== undefined;

      if (nameChanged || qtyChanged || locChanged) {
        const effective = {
          customerName:
            candidates.customerName !== undefined
              ? String(candidates.customerName)
              : beforeRow.customerName,
          rfqOrderQtyMW:
            candidates.rfqOrderQtyMW !== undefined
              ? candidates.rfqOrderQtyMW
              : beforeRow.rfqOrderQtyMW,
          projectLocation:
            candidates.projectLocation !== undefined
              ? String(candidates.projectLocation)
              : beforeRow.projectLocation,
        };
        const newCode = makeProjectCode({ ...effective, date: new Date() });
        fields.push("projectCode=@projectCode");
        reqt = reqt.input("projectCode", sql.NVarChar, newCode);
      }

      // attachment field changes
      if (removeQap) {
        fields.push("qapTypeAttachmentName=NULL", "qapTypeAttachmentUrl=NULL");
        if (beforeRow.qapTypeAttachmentName)
          filesToUnlink.push(beforeRow.qapTypeAttachmentName);
      }
      if (removePrimary) {
        fields.push(
          "primaryBomAttachmentName=NULL",
          "primaryBomAttachmentUrl=NULL"
        );
        if (beforeRow.primaryBomAttachmentName)
          filesToUnlink.push(beforeRow.primaryBomAttachmentName);
      }
      if (qapTypeFile) {
        fields.push(
          "qapTypeAttachmentName=@qapTypeAttachmentName",
          "qapTypeAttachmentUrl=@qapTypeAttachmentUrl"
        );
        reqt = reqt
          .input("qapTypeAttachmentName", sql.NVarChar, qapTypeFile.filename)
          .input(
            "qapTypeAttachmentUrl",
            sql.NVarChar,
            fileUrl(qapTypeFile.filename)
          );
        if (beforeRow.qapTypeAttachmentName)
          filesToUnlink.push(beforeRow.qapTypeAttachmentName);
      }
      if (primaryBomFile) {
        fields.push(
          "primaryBomAttachmentName=@primaryBomAttachmentName",
          "primaryBomAttachmentUrl=@primaryBomAttachmentUrl"
        );
        reqt = reqt
          .input(
            "primaryBomAttachmentName",
            sql.NVarChar,
            primaryBomFile.filename
          )
          .input(
            "primaryBomAttachmentUrl",
            sql.NVarChar,
            fileUrl(primaryBomFile.filename)
          );
        if (beforeRow.primaryBomAttachmentName)
          filesToUnlink.push(beforeRow.primaryBomAttachmentName);
      }

      if (!fields.length && !otherFiles.length && !removeOtherIds.length) {
        await tx.rollback();
        return res.status(400).json({ message: "Nothing to update" });
      }

      if (fields.length) {
        await reqt.query(
          `UPDATE SalesRequests SET ${fields.join(
            ","
          )}, createdAt=createdAt WHERE id=@id`
        );
      }

      // C) remove selected other files (by id)
      if (removeOtherIds.length) {
        const existing = (
          await tx
            .request()
            .input("id", sql.UniqueIdentifier, id)
            .query(
              "SELECT id,fileName FROM SalesRequestFiles WHERE salesRequestId=@id"
            )
        ).recordset;
        const toRemove = existing.filter((r) => removeOtherIds.includes(r.id));
        if (toRemove.length) {
          const inClause = toRemove.map((_, i) => `@rid${i}`).join(",");
          let delReq = tx.request();
          toRemove.forEach(
            (r, i) => (delReq = delReq.input(`rid${i}`, sql.Int, r.id))
          );
          await delReq.query(
            `DELETE FROM SalesRequestFiles WHERE id IN (${inClause})`
          );
          toRemove.forEach((r) => filesToUnlink.push(r.fileName));
        }
      }

      // D) append new other files
      for (let i = 0; i < otherFiles.length; i++) {
        const ff = otherFiles[i];
        const title = (otherTitles[i] || "").trim();
        await tx
          .request()
          .input("srid", sql.UniqueIdentifier, id)
          .input("title", sql.NVarChar, title || null)
          .input("fn", sql.NVarChar, ff.filename)
          .input("url", sql.NVarChar, fileUrl(ff.filename))
          .query(
            "INSERT INTO SalesRequestFiles (salesRequestId, title, fileName, url) VALUES (@srid, @title, @fn, @url)"
          );
      }

      // E) AFTER snapshot + history
      const afterRow = (
        await tx
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      const afterFiles = (
        await tx
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT * FROM SalesRequestFiles WHERE salesRequestId=@id ORDER BY id"
          )
      ).recordset;

      const afterSnap = snapshotForHistory(afterRow, afterFiles);
      const allKeys = Array.from(
        new Set([...Object.keys(beforeSnap), ...Object.keys(afterSnap)])
      );
      const changes = allKeys.reduce((arr, k) => {
        if (!isEqual(beforeSnap[k], afterSnap[k])) {
          arr.push({
            field: k,
            before: beforeSnap[k] ?? null,
            after: afterSnap[k] ?? null,
          });
        }
        return arr;
      }, []);

      if (changes.length) {
        await tx
          .request()
          .input("sid", sql.UniqueIdentifier, id)
          .input("act", sql.NVarChar, "update")
          .input("by", sql.NVarChar, actor)
          .input("chg", sql.NVarChar, JSON.stringify(changes)).query(`
            INSERT INTO SalesRequestHistory (salesRequestId, action, changedBy, changes)
            VALUES (@sid, @act, @by, @chg);
          `);
      }

      await tx.commit();

      // F) only now delete physical files (best-effort)
      filesToUnlink.forEach((fn) =>
        fs.unlink(path.join(uploadDir, fn), () => {})
      );

      // respond
      return res.json(inflateSalesRequestRow(afterRow, { [id]: afterFiles }));
    } catch (e) {
      try {
        await tx.rollback();
      } catch {}
      console.error("PUT /api/sales-requests/:id error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// DELETE /api/sales-requests/:id → delete a sales request
app.delete(
  "/api/sales-requests/:id",
  authenticateToken,
  param("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      // fetch filenames to remove from disk
      const current = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query("SELECT * FROM SalesRequests WHERE id=@id")
      ).recordset[0];
      if (!current) return res.status(404).json({ message: "Not found" });

      const childFiles = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT fileName FROM SalesRequestFiles WHERE salesRequestId=@id"
          )
      ).recordset;

      // delete DB rows (child table has ON DELETE CASCADE)
      await mssqlPool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query("DELETE FROM SalesRequests WHERE id=@id");

      // delete physical files (best-effort)
      if (current.qapTypeAttachmentName)
        fs.unlink(
          path.join(uploadDir, current.qapTypeAttachmentName),
          () => {}
        );
      if (current.primaryBomAttachmentName)
        fs.unlink(
          path.join(uploadDir, current.primaryBomAttachmentName),
          () => {}
        );
      childFiles.forEach((f) =>
        fs.unlink(path.join(uploadDir, f.fileName), () => {})
      );

      res.json({ message: "Sales Request deleted" });
    } catch (e) {
      console.error("DELETE /api/sales-requests/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /api/sales-requests/:id/history → get change history for a sales request
app.get(
  "/api/sales-requests/:id/history",
  authenticateToken,
  param("id").isUUID(),
  handleValidation,
  async (req, res) => {
    const { id } = req.params;
    try {
      const rows = (
        await mssqlPool
          .request()
          .input("id", sql.UniqueIdentifier, id)
          .query(
            "SELECT id, salesRequestId, action, changedBy, changedAt, changes FROM SalesRequestHistory WHERE salesRequestId=@id ORDER BY changedAt DESC, id DESC"
          )
      ).recordset;

      const parsed = rows.map((r) => ({
        id: r.id,
        salesRequestId: r.salesRequestId,
        action: r.action,
        changedBy: r.changedBy,
        changedAt: r.changedAt,
        changes: (() => {
          try {
            return r.changes ? JSON.parse(r.changes) : [];
          } catch {
            return [];
          }
        })(),
      }));

      res.json(parsed);
    } catch (e) {
      console.error("GET /api/sales-requests/:id/history error:", e);
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
