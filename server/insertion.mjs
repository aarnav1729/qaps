import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import path from "node:path";

// 🟢 Force ESM output from ts-node regardless of your tsconfig
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "esnext",
  moduleResolution: "node",
  target: "ES2022",
  esModuleInterop: true,
});

// Register the ts-node ESM loader BEFORE any .ts import
register("ts-node/esm", pathToFileURL("./"));

import dotenv from "dotenv";
dotenv.config();
import sql from "mssql";

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Import your TypeScript modules as ESM
const bom = await import(
  pathToFileURL(path.join(__dirname, "./bomMaster.ts")).href
);
const qap = await import(
  pathToFileURL(path.join(__dirname, "./qapSpecifications.ts")).href
);

// ---- DB CONFIG (mirrors server.cjs) ----
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

// ---- SQL DDL ----
const DDL = `
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC('CREATE SCHEMA dbo');

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BomComponents]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.BomComponents (
    name NVARCHAR(100) NOT NULL PRIMARY KEY
  );
END;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BomComponentOptions]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.BomComponentOptions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    componentName NVARCHAR(100) NOT NULL,
    model NVARCHAR(255) NOT NULL,
    subVendor NVARCHAR(255) NULL,
    spec NVARCHAR(MAX) NULL
  );
  CREATE INDEX IX_BomComponentOptions_Component ON dbo.BomComponentOptions(componentName);
  CREATE INDEX IX_BomComponentOptions_Model     ON dbo.BomComponentOptions(model);
END;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ModelMaster]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.ModelMaster (
    model NVARCHAR(120) NOT NULL PRIMARY KEY,
    technology NVARCHAR(20) NOT NULL,
    line NVARCHAR(120) NULL,
    minWp INT NULL,
    dimensions NVARCHAR(120) NULL
  );
END;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Technologies]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.Technologies (
    name NVARCHAR(20) NOT NULL PRIMARY KEY
  );
END;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppSettings]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.AppSettings (
    [key] NVARCHAR(100) NOT NULL PRIMARY KEY,
    [value] NVARCHAR(400) NOT NULL
  );
END;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QAPSpecifications]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.QAPSpecifications (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    sno INT NOT NULL,
    criteria NVARCHAR(50) NOT NULL,
    subCriteria NVARCHAR(100) NOT NULL,
    componentOperation NVARCHAR(120) NULL,
    characteristics NVARCHAR(300) NULL,
    defect NVARCHAR(200) NULL,
    [class] NVARCHAR(20) NOT NULL,
    typeOfCheck NVARCHAR(200) NULL,
    sampling NVARCHAR(200) NULL,
    specification NVARCHAR(MAX) NULL,
    defectClass NVARCHAR(50) NULL,
    [description] NVARCHAR(MAX) NULL,
    criteriaLimits NVARCHAR(MAX) NULL,
    [match] NVARCHAR(3) NULL,
    customerSpecification NVARCHAR(MAX) NULL
  );
  CREATE INDEX IX_QAP_1 ON dbo.QAPSpecifications(criteria, subCriteria);
  CREATE INDEX IX_QAP_2 ON dbo.QAPSpecifications(sno);
END;
`;

async function run() {
  console.log("Connecting to MSSQL...");
  const pool = await sql.connect(mssqlConfig);
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const req = new sql.Request(tx);

    console.log("Ensuring tables exist...");
    await new sql.Request(tx).batch(DDL);

    console.log("Truncating existing rows...");
    await new sql.Request(tx).batch(`
      IF OBJECT_ID('dbo.BomComponentOptions','U') IS NOT NULL TRUNCATE TABLE dbo.BomComponentOptions;
      IF OBJECT_ID('dbo.BomComponents','U')       IS NOT NULL TRUNCATE TABLE dbo.BomComponents;
      IF OBJECT_ID('dbo.ModelMaster','U')         IS NOT NULL TRUNCATE TABLE dbo.ModelMaster;
      IF OBJECT_ID('dbo.Technologies','U')        IS NOT NULL TRUNCATE TABLE dbo.Technologies;
      IF OBJECT_ID('dbo.AppSettings','U')         IS NOT NULL TRUNCATE TABLE dbo.AppSettings;
      IF OBJECT_ID('dbo.QAPSpecifications','U')   IS NOT NULL TRUNCATE TABLE dbo.QAPSpecifications;
    `);

    // Technologies
    console.log("Inserting Technologies...");
    for (const t of bom.TECHNOLOGIES ?? []) {
      await new sql.Request(tx)
        .input("name", sql.NVarChar(20), t)
        .query("INSERT INTO dbo.Technologies(name) VALUES (@name)");
    }

    // App constants
    console.log("Inserting AppSettings...");
    const settings = [
      ["VENDOR_NAME_LOCKIN", bom.VENDOR_NAME_LOCKIN ?? ""],
      ["RFID_LOCATION_LOCKIN", bom.RFID_LOCATION_LOCKIN ?? ""],
    ];
    for (const [k, v] of settings) {
      await new sql.Request(tx)
        .input("key", sql.NVarChar(100), k)
        .input("val", sql.NVarChar(400), String(v ?? ""))
        .query("INSERT INTO dbo.AppSettings([key],[value]) VALUES (@key,@val)");
    }

    // BOM Components + Options
    console.log("Inserting BOM components and options...");
    const bomMaster = bom.BOM_MASTER ?? {};
    for (const name of Object.keys(bomMaster)) {
      await new sql.Request(tx)
        .input("name", sql.NVarChar(100), name)
        .query("INSERT INTO dbo.BomComponents(name) VALUES (@name)");

      const options = Array.isArray(bomMaster[name]) ? bomMaster[name] : [];
      for (const opt of options) {
        await new sql.Request(tx)
          .input("componentName", sql.NVarChar(100), name)
          .input("model", sql.NVarChar(255), opt.model ?? "")
          .input("subVendor", sql.NVarChar(255), opt.subVendor ?? null)
          .input("spec", sql.NVarChar(sql.MAX), opt.spec ?? null)
          .query(
            `INSERT INTO dbo.BomComponentOptions(componentName, model, subVendor, spec)
             VALUES (@componentName, @model, @subVendor, @spec)`
          );
      }
    }

    // ModelMaster
    console.log("Inserting ModelMaster...");
    const modelMaster = bom.MODEL_MASTER ?? {};
    for (const [model, info] of Object.entries(modelMaster)) {
      await new sql.Request(tx)
        .input("model", sql.NVarChar(120), model)
        .input("technology", sql.NVarChar(20), info.technology ?? "")
        .input("line", sql.NVarChar(120), info.line ?? null)
        .input("minWp", sql.Int, info.minWp == null ? null : Number(info.minWp))
        .input("dimensions", sql.NVarChar(120), info.dimensions ?? null)
        .query(
          `INSERT INTO dbo.ModelMaster(model, technology, line, minWp, dimensions)
           VALUES (@model, @technology, @line, @minWp, @dimensions)`
        );
    }

    // QAP Specifications
    console.log("Inserting QAPSpecifications...");
    const allSpecs =
      qap.qapSpecifications ??
      (Array.isArray(qap.mqpSpecifications) &&
      Array.isArray(qap.visualElSpecifications)
        ? qap.mqpSpecifications.concat(qap.visualElSpecifications)
        : []);
    for (const s of allSpecs) {
      await new sql.Request(tx)
        .input("sno", sql.Int, Number(s.sno))
        .input("criteria", sql.NVarChar(50), s.criteria ?? "")
        .input("subCriteria", sql.NVarChar(100), s.subCriteria ?? "")
        .input(
          "componentOperation",
          sql.NVarChar(120),
          s.componentOperation ?? null
        )
        .input("characteristics", sql.NVarChar(300), s.characteristics ?? null)
        .input("defect", sql.NVarChar(200), s.defect ?? null)
        .input("class", sql.NVarChar(20), s.class ?? "")
        .input("typeOfCheck", sql.NVarChar(200), s.typeOfCheck ?? null)
        .input("sampling", sql.NVarChar(200), s.sampling ?? null)
        .input("specification", sql.NVarChar(sql.MAX), s.specification ?? null)
        .input("defectClass", sql.NVarChar(50), s.defectClass ?? null)
        .input("description", sql.NVarChar(sql.MAX), s.description ?? null)
        .input(
          "criteriaLimits",
          sql.NVarChar(sql.MAX),
          s.criteriaLimits ?? null
        )
        .input("match", sql.NVarChar(3), s.match ?? null)
        .input(
          "customerSpecification",
          sql.NVarChar(sql.MAX),
          s.customerSpecification ?? null
        )
        .query(
          `INSERT INTO dbo.QAPSpecifications
           (sno, criteria, subCriteria, componentOperation, characteristics, defect, [class], typeOfCheck, sampling, specification, defectClass, [description], criteriaLimits, [match], customerSpecification)
           VALUES
           (@sno, @criteria, @subCriteria, @componentOperation, @characteristics, @defect, @class, @typeOfCheck, @sampling, @specification, @defectClass, @description, @criteriaLimits, @match, @customerSpecification)`
        );
    }

    await tx.commit();
    console.log("✅ Seed complete. Tables are ready for CRUD.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error while seeding:", err);
    try {
      await tx.rollback();
    } catch {}
    process.exit(1);
  } finally {
    sql.close().catch(() => {});
  }
}

await run();
