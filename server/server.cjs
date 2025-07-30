// server/server.js

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
const https       = require("https");






const app = express();

/* ------------------------------------------------------------------ */
/* Middleware                                                         */
/* ------------------------------------------------------------------ */

// allow our front‑end at localhost:8080 to send/receive cookies
// allow credentials from your React host
app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb", strict: true }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cookieParser());
app.use(compression());

/* ------------------------------------------------------------------ */
/* Database Configs                                                   */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Ensure MSSQL Schema                                                */
/* ------------------------------------------------------------------ */
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
    `);

    console.log("✅ MSSQL schema ensured");
  } catch (err) {
    console.error("❌ MSSQL init error:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Initialize both DBs                                                */
/* ------------------------------------------------------------------ */
async function initDatabases() {
  await initMssql();
}
initDatabases();

// ─────────────────────────────────────────────────────────────────────────────
//   J W T   A U T H   M I D D L E W A R E
// ─────────────────────────────────────────────────────────────────────────────
const JWT_SECRET =
  process.env.JWT_SECRET || "please_change_me_to_a_strong_secret";
const JWT_EXPIRES_IN = "2h";

function authenticateToken(req, res, next) {
  const token =
    req.cookies.token || (req.headers.authorization || "").split(" ")[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
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

// ─────────────────────────────────────────────────────────────────────────────
//   H E L P E R :  M S S Q L  W /  M Y S Q L  F A L L B A C K
// ─────────────────────────────────────────────────────────────────────────────
async function tryMssql(fn) {
  return await fn(mssqlPool);
}
// ─────────────────────────────────────────────────────────────────────────────
//   V A L I D A T I O N  E R R O R  H A N D L E R
// ─────────────────────────────────────────────────────────────────────────────
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

// ─── AUTH ENDPOINTS ──────────────────────────────────────────────────────────
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

    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
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
// ──────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//   ───   U S E R S   (A D M I N  O N L Y)   ─────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//   ───   Q A P   C R U D   ───────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ─── LIST QAPs ───────────────────────────────────────────────────────────────
// server.cjs (replace your existing GET /api/qaps)
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

    // 3) group by qapId
    const groupBy = (arr, keyFn) =>
      arr.reduce((acc, x) => {
        const k = keyFn(x);
        (acc[k] || (acc[k] = [])).push(x);
        return acc;
      }, {});
    const mqpMap = groupBy(allMqp, (r) => r.qapId);
    const visMap = groupBy(allVis, (r) => r.qapId);
    const respMap = groupBy(allResp, (r) => r.qapId);

    // 4) assemble final result
    const result = masters.map((m) => ({
      ...m,

      // ── nest specs ──────────────────────────────────────────────
      specs: {
        mqp: mqpMap[m.id] || [],
        visual: visMap[m.id] || [],
      },

      // ── level‑responses as level → role → details ───────────────
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

      // ── convenience: parsed per‑item final comments ─────────────
      finalCommentsPerItem:
        m.finalComments && m.finalComments.trim().startsWith("{")
          ? JSON.parse(m.finalComments)
          : {},
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /api/qaps error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── GET QAPs “for review” (Level 2) ─────────────────────────────────────────
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

    // 3) Bulk‑fetch specs & responses
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

    // 4) Group by qapId
    const groupBy = (arr, key) =>
      arr.reduce((acc, x) => {
        (acc[x[key]] = acc[x[key]] || []).push(x);
        return acc;
      }, {});
    const mqpMap = groupBy(allMqp, "qapId");
    const visMap = groupBy(allVis, "qapId");
    const respMap = groupBy(allResp, "qapId");

    // 5) Assemble + filter out any QAP with NO unmatched items for this role
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

// ─── GET A SINGLE QAP ────────────────────────────────────────────────────────
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

      res.json({
        ...master,
        specs: { mqp, visual },
        levelResponses: resp,
        timeline: tl,
      });
    } catch (e) {
      console.error("GET /api/qaps/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ─── CREATE A QAP ────────────────────────────────────────────────────────────
app.post(
  "/api/qaps",
  [
    authenticateToken,
    body("customerName").isString(),
    body("projectName").isString(),
    body("orderQuantity").isInt({ gt: 0 }),
    body("productType").isString(),
    body("plant").isString(),
    body("status").isString(),
    body("currentLevel").isInt({ min: 1, max: 5 }),
    body("specs").isObject(),
    handleValidation,
  ],
  async (req, res) => {
    const {
      customerName,
      projectName,
      orderQuantity,
      productType,
      plant,
      status,
      submittedBy,
      currentLevel,
      specs,
    } = req.body;
    const newId = require("crypto").randomUUID();

    try {
      await tryMssql(async (db) => {
        if (db === mssqlPool) {
          // MSSQL master insert
          await mssqlPool
            .request()
            .input("id", sql.UniqueIdentifier, newId)
            .input("c", sql.NVarChar, customerName)
            .input("p", sql.NVarChar, projectName)
            .input("o", sql.Int, orderQuantity)
            .input("pt", sql.NVarChar, productType)
            .input("pl", sql.NVarChar, plant)
            .input("s", sql.NVarChar, status)
            .input("sb", sql.NVarChar, submittedBy || null)
            .input("cl", sql.Int, currentLevel).query(`
              INSERT INTO QAPs (
                id, customerName, projectName, orderQuantity,
                productType, plant, status, submittedBy, submittedAt,
                currentLevel, createdAt, lastModifiedAt
              )
              VALUES (
                @id,@c,@p,@o,
                @pt,@pl,@s,@sb,SYSUTCDATETIME(),
                @cl,SYSUTCDATETIME(),SYSUTCDATETIME()
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

// ─── UPDATE A QAP ────────────────────────────────────────────────────────────
app.put(
  "/api/qaps/:id",
  [
    authenticateToken,
    param("id").isUUID(),
    // only validate fields you actually support
    body("customerName").optional().isString(),
    body("projectName").optional().isString(),
    body("orderQuantity").optional().isInt({ gt: 0 }),
    body("productType").optional().isString(),
    body("plant").optional().isString(),
    body("status").optional().isString(),
    body("currentLevel").optional().isInt({ min: 1, max: 5 }),
    body("specs").optional().isObject(),
    handleValidation,
  ],
  async (req, res) => {
    const { id } = req.params;

    // Build up master‐row updates
    const fields = [
      "customerName",
      "projectName",
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
    ];
    const updates = [];
    const inputs = {};

    for (const f of fields) {
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
          const type =
            typeof val === "number"
              ? sql.Int
              : key.endsWith("At")
              ? sql.DateTime2
              : sql.NVarChar;
          r = r.input(key, type, val);
        }
        await r.query(`
          UPDATE QAPs
          SET ${updates.join(",")}, lastModifiedAt=SYSUTCDATETIME()
          WHERE id=@id;
        `);

        // 2) If specs were sent, delete old and re‑insert
        if (req.body.specs) {
          await mssqlPool.request().input("id", sql.UniqueIdentifier, id)
            .query(`
              DELETE FROM MQPSpecs   WHERE qapId=@id;
              DELETE FROM VisualSpecs WHERE qapId=@id;
            `);

          // helper to normalize reviewBy
          const normalize = (v) =>
            Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : null;

          // re‑insert MQP specs
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

          // re‑insert Visual specs
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

// ─── DELETE A QAP ────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
//   ───   L E V E L   R E V I E W   E N D P O I N T S   ────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// body: { level, role?, comments: { [itemIndex]: string }, respondedAt? }
// ─── LEVEL RESPONSE ENDPOINT ────────────────────────────────────────────────
// body: { level, role?, comments: { [itemIndex]: string } }
// server.cjs (or server.js)

// ─── LEVEL RESPONSE ENDPOINT ────────────────────────────────────────────────
// ─── LEVEL RESPONSE ENDPOINT ────────────────────────────────────────────────
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

// final comments (requestor)
// in server/server.js (or .cjs), replace your existing POST /api/qaps/:id/final-comments handler with this:

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

// approve / reject (plant-head)
// in server.cjs (or server.js), after your existing imports & middleware…

// ─── APPROVE QAP ─────────────────────────────────────────────────────────────
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

// ─── REJECT QAP ──────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
//   ───   S H A R E    ( E M A I L     Q A P  L I N K )   ──────────────────
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
//   ───   S P E C ‑ T E M P L A T E S    ──────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/spec-templates", authenticateToken, async (req, res) => {
  // simply combine your in‑memory arrays
  const { qapSpecifications } = require("../src/data/qapSpecification");
  res.json(qapSpecifications);
});

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

// ─────────────────────────────────────────────────────────────────────────────
//   ───   S T A R T   S E R V E R   ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
