// routes/qapSpecifications.cjs (or inline in server.cjs)
const express = require("express");
const sql = require("mssql");

const router = express.Router();

/**
 * GET /api/qap-specifications
 * Optional query: criteria=mqp|visual
 * - mqp   -> criteria = 'MQP'
 * - visual-> criteria IN ('Visual','EL')
 */
router.get("/qap-specifications", async (req, res) => {
  const { criteria } = req.query || {};
  try {
    const pool = await sql.connect(); // uses global config
    let q = `
      SELECT
        sno, criteria, subCriteria, componentOperation, characteristics,
        [class], typeOfCheck, sampling, specification,
        defectClass, [description], criteriaLimits
      FROM dbo.QAPSpecifications
    `;
    const reqSql = new sql.Request(pool);

    if (criteria && String(criteria).toLowerCase() === "mqp") {
      q += ` WHERE criteria = @c1 `;
      reqSql.input("c1", sql.NVarChar(50), "MQP");
    } else if (criteria && String(criteria).toLowerCase() === "visual") {
      q += ` WHERE criteria IN (@v1, @v2) `;
      reqSql.input("v1", sql.NVarChar(50), "Visual");
      reqSql.input("v2", sql.NVarChar(50), "EL");
    }

    q += " ORDER BY sno ASC, criteria ASC, subCriteria ASC";

    const { recordset } = await reqSql.query(q);
    res.json(recordset || []);
  } catch (err) {
    console.error("GET /api/qap-specifications failed:", err);
    res.status(500).json({ error: "Failed to load QAP specifications" });
  }
});

module.exports = router;
