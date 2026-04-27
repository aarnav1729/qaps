import fs from "node:fs/promises";
import path from "node:path";
import sql from "mssql";

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

const API_BASE = (process.env.API_BASE || "https://localhost:11443").replace(
  /\/$/,
  ""
);

const MSSQL_CONFIG = {
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

const RESET_TABLES = [
  "SalesRequestHistory",
  "SalesRequestFiles",
  "LevelResponses",
  "TimelineEntries",
  "MQPSpecs",
  "VisualSpecs",
  "QAPs",
  "Suggestions",
  "SalesRequests",
  "Customers",
];

const RESET_RESEEDS = [
  "SalesRequestHistory",
  "SalesRequestFiles",
  "TimelineEntries",
];

const PLANT_ROLES = {
  p2: {
    production: { username: "manoj", password: "manoj" },
    quality: { username: "abbas", password: "abbas" },
    technical: { username: "rahul", password: "rahul" },
  },
  p4: {
    production: { username: "malik", password: "malik" },
    quality: { username: "sriram", password: "sriram" },
    technical: { username: "ramu", password: "ramu" },
    head: { username: "nrao", password: "nrao" },
  },
};

const SHARED_USERS = {
  requestor: { username: "nagadevi", password: "nagadevi" },
  level1: { username: "yamini", password: "yamini" },
  technicalHead: { username: "jmr", password: "jmr" },
  plantHead: { username: "cmk", password: "cmk" },
  admin: { username: "aarnav", password: "aarnav" },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function api(pathname, { method = "GET", cookie, json, formData } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (json) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : formData,
  });

  const text = await response.text();
  const body = parseJson(text);

  if (!response.ok) {
    throw new Error(
      `${method} ${pathname} failed (${response.status}): ${
        typeof body === "string" ? body : JSON.stringify(body)
      }`
    );
  }

  return body;
}

async function login({ username, password }) {
  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const text = await response.text();
  const body = parseJson(text);

  if (!response.ok) {
    throw new Error(
      `Login failed for ${username} (${response.status}): ${
        typeof body === "string" ? body : JSON.stringify(body)
      }`
    );
  }

  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/token=[^;]+/);
  assert(match, `Missing auth cookie for ${username}`);

  return {
    cookie: match[0],
    user: body?.user || null,
  };
}

async function withPool(fn) {
  const pool = await sql.connect(MSSQL_CONFIG);
  try {
    return await fn(pool);
  } finally {
    await pool.close();
  }
}

async function clearUploads() {
  const uploadsDir = path.join(process.cwd(), "uploads");
  let removed = 0;

  try {
    const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          await fs.unlink(path.join(uploadsDir, entry.name));
          removed += 1;
        })
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  return removed;
}

async function resetTransactionalData() {
  const beforeCounts = await withPool(async (pool) => {
    const countQuery = RESET_TABLES.map(
      (table) => `SELECT '${table}' AS tableName, COUNT(*) AS itemCount FROM dbo.${table}`
    ).join(" UNION ALL ");

    const counts = (await pool.request().query(countQuery)).recordset;
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      await tx.request().batch(`
        DELETE FROM dbo.SalesRequestHistory;
        DELETE FROM dbo.SalesRequestFiles;
        DELETE FROM dbo.LevelResponses;
        DELETE FROM dbo.TimelineEntries;
        DELETE FROM dbo.MQPSpecs;
        DELETE FROM dbo.VisualSpecs;
        DELETE FROM dbo.QAPs;
        DELETE FROM dbo.Suggestions;
        DELETE FROM dbo.SalesRequests;
        DELETE FROM dbo.Customers;
      `);

      for (const table of RESET_RESEEDS) {
        await tx
          .request()
          .batch(`DBCC CHECKIDENT ('dbo.${table}', RESEED, 0);`);
      }

      await tx.commit();
      return Object.fromEntries(
        counts.map((row) => [row.tableName, Number(row.itemCount || 0)])
      );
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  });

  const uploadsRemoved = await clearUploads();

  return {
    beforeCounts,
    uploadsRemoved,
  };
}

function buildBomPayload(bomMaster, label, plant) {
  const selected = (bomMaster || []).slice(0, 3).map((component) => {
    const option = component.options?.[0] || {};
    return {
      name: component.name,
      rows: [
        {
          model: option.model || `${component.name}-${label}-MODEL`,
          subVendor: option.subVendor || `${component.name} Vendor`,
          spec: option.spec || `${label} ${component.name} spec`,
        },
      ],
    };
  });

  return {
    vendorName: `Workflow Vendor ${label}`,
    vendorAddress: `Plant ${plant.toUpperCase()} test lane`,
    rfidLocation: `${plant.toUpperCase()}-RFID-01`,
    technologyProposed: "TOPCon",
    documentRef: `WF-${label}-DOC`,
    moduleWattageWp: 585,
    moduleDimensionsOption: "2278 x 1134 x 35 mm",
    moduleModelNumber: `WF-${label}-585`,
    components: selected,
  };
}

async function createSalesRequest({ cookie, label, plant, bomMaster }) {
  const today = new Date();
  const start = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000);
  const asDate = (value) => value.toISOString().slice(0, 10);

  const form = new FormData();
  form.append("customerName", `Workflow Customer ${label}`);
  form.append("moduleManufacturingPlant", plant);
  form.append("moduleCellType", "M10");
  form.append("cellType", "DCR");
  form.append("rfqOrderQtyMW", "12");
  form.append("premierBiddedOrderQtyMW", "10");
  form.append("deliveryStartDate", asDate(start));
  form.append("deliveryEndDate", asDate(end));
  form.append("projectLocation", `Project Site ${label}`);
  form.append("cableLengthRequired", "140");
  form.append("qapType", "Premier Energies");
  form.append("bomFrom", "Premier Energies");
  form.append("inlineInspection", "yes");
  form.append("pdi", "yes");
  form.append("cellProcuredBy", "Premier Energies");
  form.append("agreedCTM", "1.75");
  form.append("priority", "high");
  form.append("cellTech", "TOPCon");
  form.append("cutCells", "72");
  form.append("certificationRequired", "IEC");
  form.append(
    "wattageBinningDist",
    JSON.stringify([{ wattage: 585, quantity: 12 }])
  );
  form.append("bom", JSON.stringify(buildBomPayload(bomMaster, label, plant)));

  return api("/api/sales-requests", {
    method: "POST",
    cookie,
    formData: form,
  });
}

async function fetchMasterSpecs() {
  const [mqpRows, visualRows] = await Promise.all([
    api("/api/qap-specifications?criteria=mqp"),
    api("/api/qap-specifications?criteria=visual"),
  ]);

  assert(Array.isArray(mqpRows) && mqpRows.length >= 2, "MQP master is empty");
  assert(
    Array.isArray(visualRows) && visualRows.length >= 2,
    "Visual EL master is empty"
  );

  return {
    mqp: mqpRows.slice(0, 2),
    visual: visualRows.slice(0, 2),
  };
}

function buildQapSpecs(masterSpecs, label) {
  const mqp = masterSpecs.mqp.map((row, index) => {
    const matched = index !== 0;
    const premier = row.specification || "";
    const customer = matched ? premier : `Customer MQP gap ${label}`;

    return {
      sno: index + 1,
      criteria: row.criteria,
      subCriteria: row.subCriteria || "",
      componentOperation: row.componentOperation || "",
      characteristics: row.characteristics || "",
      class: row.class || "Major",
      typeOfCheck: row.typeOfCheck || "",
      sampling: row.sampling || "",
      specification: premier,
      match: matched ? "yes" : "no",
      customerSpecification: customer,
      initialMatch: matched ? "yes" : "no",
      initialCustomerSpecification: matched ? undefined : customer,
      reviewBy: matched ? "" : "production",
    };
  });

  const visual = masterSpecs.visual.map((row, index) => {
    const matched = index !== 0;
    const premier = row.criteriaLimits || row.specification || "";
    const customer = matched ? premier : `Customer Visual gap ${label}`;

    return {
      sno: mqp.length + index + 1,
      criteria: row.criteria,
      subCriteria: row.subCriteria || "",
      defect: row.defect || row.subCriteria || "",
      defectClass: row.defectClass || "",
      description: row.description || "",
      criteriaLimits: premier,
      match: matched ? "yes" : "no",
      customerSpecification: customer,
      initialMatch: matched ? "yes" : "no",
      initialCustomerSpecification: matched ? undefined : customer,
      reviewBy: matched ? "" : "quality",
    };
  });

  return { mqp, visual };
}

function getRequiredLevel2Roles(qap) {
  const roles = new Set();
  for (const spec of [...(qap.specs?.mqp || []), ...(qap.specs?.visual || [])]) {
    for (const role of String(spec.reviewBy || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)) {
      roles.add(role);
    }
  }
  return Array.from(roles);
}

async function expectApiFailure(promiseFactory, expectedStatus, label) {
  try {
    await promiseFactory();
    throw new Error(`${label}: expected request to fail with ${expectedStatus}`);
  } catch (error) {
    const message = String(error?.message || error);
    assert(
      message.includes(`(${expectedStatus})`),
      `${label}: expected status ${expectedStatus}, got ${message}`
    );
  }
}

async function createQap({
  cookie,
  label,
  plant,
  salesRequestId,
  projectCode,
  specs,
}) {
  const created = await api("/api/qaps", {
    method: "POST",
    cookie,
    json: {
      customerName: `Workflow Customer ${label}`,
      projectName: `Workflow Project ${label}`,
      projectCode,
      orderQuantity: 12,
      productType: "M10",
      plant,
      status: "level-1",
      submittedBy: SHARED_USERS.requestor.username,
      currentLevel: 1,
      salesRequestId,
      specs,
    },
  });

  assert(created?.id, `QAP create did not return an id for ${label}`);
  return created.id;
}

async function fetchQap(cookie, qapId) {
  return api(`/api/qaps/${qapId}`, { cookie });
}

function summarizeThreads(levelBlock = {}) {
  const summary = {};
  for (const [role, entry] of Object.entries(levelBlock || {})) {
    const comments = entry?.comments;
    summary[role] = Array.isArray(comments) ? comments.length : comments ? 1 : 0;
  }
  return summary;
}

function totalThreadEntries(levelBlock = {}) {
  return Object.values(summarizeThreads(levelBlock)).reduce(
    (sum, count) => sum + Number(count || 0),
    0
  );
}

function assertStatus(qap, { status, currentLevel }, stage) {
  assert(
    qap.status === status,
    `${stage}: expected status ${status}, got ${qap.status}`
  );
  assert(
    Number(qap.currentLevel) === currentLevel,
    `${stage}: expected level ${currentLevel}, got ${qap.currentLevel}`
  );
}

function assertCriteriaLabels(qap, stage) {
  assert(
    (qap.specs?.mqp || []).every((spec) => spec.criteria === "MQP"),
    `${stage}: MQP rows are missing normalized criteria labels`
  );
  assert(
    (qap.specs?.visual || []).every((spec) => spec.criteria === "Visual EL"),
    `${stage}: Visual EL rows are missing normalized criteria labels`
  );
}

function buildLevel1Payload(qap, label) {
  const now = new Date().toISOString();
  const mqp = (qap.specs?.mqp || []).map((spec, index) => {
    if (index !== 0) return spec;
    return {
      ...spec,
      match: "agreed",
      customerSpecification: `Agreed MQP measure ${label}`,
      initialMatch: spec.initialMatch || "no",
      initialCustomerSpecification:
        spec.initialCustomerSpecification || spec.customerSpecification || "",
      level1Resolution: "agreed",
      level1ResolutionText: `Agreed MQP measure ${label}`,
      level1ResolvedBy: SHARED_USERS.level1.username,
      level1ResolvedAt: now,
      level1Closed: true,
    };
  });

  const visual = (qap.specs?.visual || []).map((spec, index) => {
    if (index !== 0) return spec;
    const matchedValue = spec.criteriaLimits || spec.specification || "";
    return {
      ...spec,
      match: "yes",
      customerSpecification: matchedValue,
      initialMatch: spec.initialMatch || "no",
      initialCustomerSpecification:
        spec.initialCustomerSpecification || spec.customerSpecification || "",
      level1Resolution: "matched",
      level1ResolutionText: null,
      level1ResolvedBy: SHARED_USERS.level1.username,
      level1ResolvedAt: now,
      level1Closed: true,
    };
  });

  return {
    specs: { mqp, visual },
    comments: {
      [mqp[0]?.sno]: `Agreed measure recorded for ${label}`,
      [visual[0]?.sno]: `Mismatch closed as match for ${label}`,
    },
  };
}

async function postLevelResponse(cookie, qapId, level, comments = {}) {
  return api(`/api/qaps/${qapId}/responses`, {
    method: "POST",
    cookie,
    json: { level, comments },
  });
}

async function advanceToFinalComments({
  qapId,
  plant,
  cookies,
  level4Cookie,
  stageLabel,
}) {
  const plantRoles = PLANT_ROLES[plant];
  let qap = await fetchQap(cookies.requestor, qapId);
  const requiredRoles = getRequiredLevel2Roles(qap);
  const skippedRoles = ["production", "quality", "technical"].filter(
    (role) => !requiredRoles.includes(role)
  );

  if (skippedRoles.length > 0) {
    const skippedRoleUser = plantRoles[skippedRoles[0]];
    await expectApiFailure(
      () =>
        postLevelResponse(
          cookies[skippedRoleUser.username],
          qapId,
          2,
          {}
        ),
      403,
      `${stageLabel} unselected reviewer guard`
    );
  }

  for (let index = 0; index < requiredRoles.length; index += 1) {
    const role = requiredRoles[index];
    const reviewer = plantRoles[role];
    assert(reviewer, `${stageLabel}: missing reviewer credentials for ${role}`);
    await postLevelResponse(cookies[reviewer.username], qapId, 2, {});
    qap = await fetchQap(cookies.requestor, qapId);
    if (index < requiredRoles.length - 1) {
      assertStatus(
        qap,
        { status: "level-2", currentLevel: 2 },
        `${stageLabel} after ${role} L2 response`
      );
    }
  }

  if (plant === "p4") {
    assertStatus(qap, { status: "level-3", currentLevel: 3 }, `${stageLabel} after L2`);
    await postLevelResponse(cookies[plantRoles.head.username], qapId, 3, {});
    qap = await fetchQap(cookies.requestor, qapId);
    assertStatus(qap, { status: "level-4", currentLevel: 4 }, `${stageLabel} after L3`);
  } else {
    assertStatus(qap, { status: "level-4", currentLevel: 4 }, `${stageLabel} after L2`);
  }

  await postLevelResponse(level4Cookie, qapId, 4, {});
  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "final-comments", currentLevel: 4 }, `${stageLabel} after L4`);
  assertCriteriaLabels(qap, `${stageLabel} at final comments`);
  return qap;
}

async function submitFinalComments({ qap, cookie, label }) {
  const finalCommentPayload = JSON.stringify({
    [qap.specs?.mqp?.[0]?.sno || 1]: `Final confirmation for ${label}`,
  });

  await api(`/api/qaps/${qap.id}/final-comments`, {
    method: "POST",
    cookie,
    formData: (() => {
      const form = new FormData();
      form.append("comments", finalCommentPayload);
      return form;
    })(),
  });

  const reopened = await fetchQap(cookie, qap.id);
  assertStatus(
    reopened,
    { status: "level-1", currentLevel: 1 },
    `${label} after final comments`
  );
  return reopened;
}

async function advancePostFinalToLevel5({
  qapId,
  plant,
  cookies,
  level4Cookie,
  stageLabel,
}) {
  const plantRoles = PLANT_ROLES[plant];
  let qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(
    qap,
    { status: "level-1", currentLevel: 1 },
    `${stageLabel} awaiting post-final Level 1`
  );

  await api(`/api/qaps/${qapId}/level-1-review`, {
    method: "POST",
    cookie: cookies.level1,
    json: buildLevel1Payload(qap, `${stageLabel} re-review`),
  });

  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(
    qap,
    { status: "level-2", currentLevel: 2 },
    `${stageLabel} after post-final L1`
  );

  const requiredRoles = getRequiredLevel2Roles(qap);
  for (const role of requiredRoles) {
    const reviewer = plantRoles[role];
    assert(reviewer, `${stageLabel}: missing reviewer credentials for ${role}`);
    await postLevelResponse(cookies[reviewer.username], qapId, 2, {});
  }
  qap = await fetchQap(cookies.requestor, qapId);

  if (plant === "p4") {
    assertStatus(
      qap,
      { status: "level-3b", currentLevel: 3 },
      `${stageLabel} after post-final L2`
    );
    await postLevelResponse(cookies[plantRoles.head.username], qapId, 3, {});
    qap = await fetchQap(cookies.requestor, qapId);
    assertStatus(
      qap,
      { status: "level-4b", currentLevel: 4 },
      `${stageLabel} after post-final L3`
    );
  } else {
    assertStatus(
      qap,
      { status: "level-4b", currentLevel: 4 },
      `${stageLabel} after post-final L2`
    );
  }

  await postLevelResponse(level4Cookie, qapId, 4, {});
  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "level-5", currentLevel: 5 }, `${stageLabel} after post-final L4`);
  assertCriteriaLabels(qap, `${stageLabel} at level 5`);
  return qap;
}

async function reopenByRequestorHeaderEdit({ qap, cookie, label }) {
  const nextOrderQuantity = Number(qap.orderQuantity || 0) + 1;
  await api(`/api/qaps/${qap.id}`, {
    method: "PUT",
    cookie,
    json: {
      orderQuantity: nextOrderQuantity,
      editMeta: {
        scope: "qap",
        header: [
          {
            field: "orderQuantity",
            before: qap.orderQuantity,
            after: nextOrderQuantity,
          },
        ],
        mqp: [],
        visual: [],
        bom: { changed: [], added: [], removed: [] },
      },
    },
  });

  const reopened = await fetchQap(cookie, qap.id);
  const expectedReopen = qap.finalCommentsAt
    ? { status: "level-1", currentLevel: 1 }
    : { status: "level-2", currentLevel: 2 };
  const expectedTimelineText = qap.finalCommentsAt
    ? "Reopened Level 1 after edit"
    : "Reopened Level 2 after edit";
  assertStatus(
    reopened,
    expectedReopen,
    `${label} after requestor header edit`
  );
  assert(
    Number(reopened.orderQuantity) === nextOrderQuantity,
    `${label}: requestor header edit did not persist`
  );
  assert(
    (reopened.timeline || []).some((entry) =>
      String(entry.action || "").includes(expectedTimelineText)
    ),
    `${label}: missing timeline entry after requestor header edit`
  );
  return reopened;
}

async function reopenByRequestorBomEdit({ qap, cookie, label }) {
  const bom = JSON.parse(JSON.stringify(qap?.salesRequest?.bom || null));
  assert(bom?.components?.length, `${label}: missing BOM to edit`);
  assert(bom.components[0]?.rows?.length, `${label}: missing BOM rows to edit`);

  bom.components[0].rows[0].spec = `${bom.components[0].rows[0].spec || "Spec"} | revised ${label}`;

  await api(`/api/sales-requests/${qap.salesRequest.id}`, {
    method: "PATCH",
    cookie,
    json: { bom },
  });

  const reopened = await fetchQap(cookie, qap.id);
  const expectedReopen = qap.finalCommentsAt
    ? { status: "level-1", currentLevel: 1 }
    : { status: "level-2", currentLevel: 2 };
  const expectedTimelineText = qap.finalCommentsAt
    ? "BOM updated; reopened Level 1"
    : "BOM updated; reopened Level 2";
  assertStatus(
    reopened,
    expectedReopen,
    `${label} after requestor BOM edit`
  );
  assert(
    String(
      reopened?.salesRequest?.bom?.components?.[0]?.rows?.[0]?.spec || ""
    ).includes(`revised ${label}`),
    `${label}: BOM edit did not persist on the linked sales request`
  );
  assert(
    (reopened.timeline || []).some((entry) =>
      String(entry.action || "").includes(expectedTimelineText)
    ),
    `${label}: missing timeline entry after requestor BOM edit`
  );
  return reopened;
}

async function runWorkflowPath({
  label,
  plant,
  cookies,
  salesRequestCookie,
  bomMaster,
  masterSpecs,
}) {
  console.log(`\n[workflow] starting ${label} (${plant.toUpperCase()})`);

  const salesRequest = await createSalesRequest({
    cookie: salesRequestCookie,
    label,
    plant,
    bomMaster,
  });

  const qapId = await createQap({
    cookie: cookies.requestor,
    label,
    plant,
    salesRequestId: salesRequest.id,
    projectCode: salesRequest.projectCode,
    specs: buildQapSpecs(masterSpecs, label),
  });

  let qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "level-1", currentLevel: 1 }, `${label} created`);
  assertCriteriaLabels(qap, `${label} created`);

  await api(`/api/qaps/${qapId}/level-1-review`, {
    method: "POST",
    cookie: cookies.level1,
    json: buildLevel1Payload(qap, label),
  });

  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "level-2", currentLevel: 2 }, `${label} after L1`);
  assertCriteriaLabels(qap, `${label} after L1`);
  assert(
    qap.level1Summary?.matched === 1 && qap.level1Summary?.agreed === 1,
    `${label}: expected Level 1 summary to show 1 matched and 1 agreed closure`
  );

  const plantRoles = PLANT_ROLES[plant];
  const initialRequiredRoles = getRequiredLevel2Roles(qap);
  for (let index = 0; index < initialRequiredRoles.length; index += 1) {
    const role = initialRequiredRoles[index];
    const reviewer = plantRoles[role];
    assert(reviewer, `${label}: missing reviewer credentials for ${role}`);
    await postLevelResponse(cookies[reviewer.username], qapId, 2, {});
    qap = await fetchQap(cookies.requestor, qapId);
    if (index < initialRequiredRoles.length - 1) {
      assertStatus(
        qap,
        { status: "level-2", currentLevel: 2 },
        `${label} after ${role} L2 response`
      );
    }
  }

  if (plant === "p4") {
    assertStatus(qap, { status: "level-3", currentLevel: 3 }, `${label} after L2`);
    await postLevelResponse(cookies[plantRoles.head.username], qapId, 3, {});
    qap = await fetchQap(cookies.requestor, qapId);
    assertStatus(qap, { status: "level-4", currentLevel: 4 }, `${label} after L3`);
  } else {
    assertStatus(qap, { status: "level-4", currentLevel: 4 }, `${label} after L2`);
  }

  await postLevelResponse(cookies.technicalHead, qapId, 4, {});
  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(
    qap,
    { status: "final-comments", currentLevel: 4 },
    `${label} after L4`
  );

  const finalCommentPayload = JSON.stringify({
    [qap.specs?.mqp?.[0]?.sno || 1]: `Final confirmation for ${label}`,
  });
  await api(`/api/qaps/${qapId}/final-comments`, {
    method: "POST",
    cookie: cookies.requestor,
    formData: (() => {
      const form = new FormData();
      form.append("comments", finalCommentPayload);
      return form;
    })(),
  });

  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(
    qap,
    { status: "level-1", currentLevel: 1 },
    `${label} after final comments`
  );

  await api(`/api/qaps/${qapId}/level-1-review`, {
    method: "POST",
    cookie: cookies.level1,
    json: buildLevel1Payload(qap, `${label} post-final`),
  });
  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "level-2", currentLevel: 2 }, `${label} after post-final L1`);

  const requiredRoles = getRequiredLevel2Roles(qap);
  for (const role of requiredRoles) {
    const reviewer = plantRoles[role];
    assert(reviewer, `${label}: missing reviewer credentials for ${role}`);
    await postLevelResponse(cookies[reviewer.username], qapId, 2, {});
  }
  qap = await fetchQap(cookies.requestor, qapId);

  if (plant === "p4") {
    assertStatus(
      qap,
      { status: "level-3b", currentLevel: 3 },
      `${label} after post-final L2`
    );
    await postLevelResponse(cookies[plantRoles.head.username], qapId, 3, {});
    qap = await fetchQap(cookies.requestor, qapId);
    assertStatus(
      qap,
      { status: "level-4b", currentLevel: 4 },
      `${label} after post-final L3`
    );
  } else {
    assertStatus(
      qap,
      { status: "level-4b", currentLevel: 4 },
      `${label} after post-final L2`
    );
  }

  await postLevelResponse(cookies.technicalHead, qapId, 4, {});
  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "level-5", currentLevel: 5 }, `${label} after post-final L4`);

  await api(`/api/qaps/${qapId}/approve`, {
    method: "POST",
    cookie: cookies.plantHead,
    json: { feedback: `Approved in smoke test ${label}` },
  });

  qap = await fetchQap(cookies.requestor, qapId);
  assert(qap.status === "approved", `${label}: approval did not persist`);
  assert(qap.approver === SHARED_USERS.plantHead.username, `${label}: wrong approver`);
  assert(qap.finalCommentsAt, `${label}: final comments timestamp missing`);

  const approvalsTrail = qap.approvalsTrail || [];
  assert(
    approvalsTrail.some((entry) => entry.level === 1),
    `${label}: Level 1 approval trail entry missing`
  );
  assert(
    approvalsTrail.some((entry) => entry.level === 5),
    `${label}: Level 5 approval trail entry missing`
  );

  const l2Threads = summarizeThreads(qap.levelResponses?.[2] || {});
  assert(
    Object.values(l2Threads).every((count) => count >= 2),
    `${label}: Level 2 responses did not capture both review rounds`
  );

  const l4Threads = summarizeThreads(qap.levelResponses?.[4] || {});
  assert(
    Object.values(l4Threads).every((count) => count >= 2),
    `${label}: Level 4 responses did not capture both review rounds`
  );

  if (plant === "p4") {
    const l3Threads = summarizeThreads(qap.levelResponses?.[3] || {});
    assert(
      Object.values(l3Threads).every((count) => count >= 2),
      `${label}: Level 3 responses did not capture both review rounds`
    );
    assert(
      (qap.timeline || []).some((entry) =>
        String(entry.action || "").includes("Post-final Level 3 completed")
      ),
      `${label}: post-final Level 3 timeline entry missing`
    );
  } else {
    assert(
      (qap.timeline || []).some((entry) =>
        String(entry.action || "").includes("skipped Level 3")
      ),
      `${label}: skip-Level-3 timeline entry missing`
    );
  }

  console.log(`[workflow] completed ${label}: ${qap.id}`);
  return qap.id;
}

async function runWorkflowWithRequestorEdits({
  label,
  cookies,
  salesRequestCookie,
  bomMaster,
  masterSpecs,
}) {
  const plant = "p4";
  console.log(`\n[workflow] starting ${label} (${plant.toUpperCase()})`);

  const salesRequest = await createSalesRequest({
    cookie: salesRequestCookie,
    label,
    plant,
    bomMaster,
  });

  const qapId = await createQap({
    cookie: cookies.requestor,
    label,
    plant,
    salesRequestId: salesRequest.id,
    projectCode: salesRequest.projectCode,
    specs: buildQapSpecs(masterSpecs, label),
  });

  let qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "level-1", currentLevel: 1 }, `${label} created`);
  assertCriteriaLabels(qap, `${label} created`);

  await api(`/api/qaps/${qapId}/level-1-review`, {
    method: "POST",
    cookie: cookies.level1,
    json: buildLevel1Payload(qap, label),
  });

  qap = await fetchQap(cookies.requestor, qapId);
  assertStatus(qap, { status: "level-2", currentLevel: 2 }, `${label} after L1`);
  assertCriteriaLabels(qap, `${label} after L1`);

  qap = await advanceToFinalComments({
    qapId,
    plant,
    cookies,
    level4Cookie: cookies.admin,
    stageLabel: `${label} initial cycle`,
  });
  assert(
    qap.levelResponses?.[4]?.admin,
    `${label}: admin Level 4 response was not recorded`
  );

  qap = await reopenByRequestorHeaderEdit({
    qap,
    cookie: cookies.requestor,
    label,
  });

  qap = await advanceToFinalComments({
    qapId,
    plant,
    cookies,
    level4Cookie: cookies.technicalHead,
    stageLabel: `${label} after requestor header edit`,
  });

  qap = await reopenByRequestorBomEdit({
    qap,
    cookie: cookies.requestor,
    label,
  });

  qap = await advanceToFinalComments({
    qapId,
    plant,
    cookies,
    level4Cookie: cookies.technicalHead,
    stageLabel: `${label} after requestor BOM edit`,
  });

  qap = await submitFinalComments({
    qap,
    cookie: cookies.requestor,
    label,
  });

  qap = await advancePostFinalToLevel5({
    qapId,
    plant,
    cookies,
    level4Cookie: cookies.admin,
    stageLabel: `${label} post-final cycle`,
  });

  await api(`/api/qaps/${qapId}/approve`, {
    method: "POST",
    cookie: cookies.plantHead,
    json: { feedback: `Approved in edit/reset smoke test ${label}` },
  });

  qap = await fetchQap(cookies.requestor, qapId);
  assert(qap.status === "approved", `${label}: approval did not persist`);
  assert(qap.finalCommentsAt, `${label}: final comments timestamp missing`);
  assertCriteriaLabels(qap, `${label} approved`);

  const l2Threads = summarizeThreads(qap.levelResponses?.[2] || {});
  const finalRequiredRoles = getRequiredLevel2Roles(qap);
  assert(
    finalRequiredRoles.every(
      (role) => Number(l2Threads[role] || 0) >= 4
    ),
    `${label}: Level 2 did not preserve all review rounds through resets`
  );

  const l3Threads = summarizeThreads(qap.levelResponses?.[3] || {});
  assert(
    Number(l3Threads.head || 0) >= 4,
    `${label}: Level 3 did not preserve all review rounds through resets`
  );

  assert(
    totalThreadEntries(qap.levelResponses?.[4] || {}) >= 4,
    `${label}: Level 4 did not preserve all review rounds through resets`
  );

  assert(
    (qap.timeline || []).some((entry) =>
      String(entry.action || "").includes("Reopened Level 2 after edit")
    ),
    `${label}: missing requestor edit reset timeline entry`
  );
  assert(
    (qap.timeline || []).some((entry) =>
      String(entry.action || "").includes("BOM updated; reopened Level 2")
    ),
    `${label}: missing BOM reset timeline entry`
  );

  console.log(`[workflow] completed ${label}: ${qap.id}`);
  return qap.id;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const resetOnly = args.has("--reset-only");
  const keepData = args.has("--keep-data");
  const allowDestructiveReset =
    args.has("--allow-destructive-reset") ||
    process.env.ALLOW_DESTRUCTIVE_QAP_RESET === "true";

  if (!allowDestructiveReset) {
    throw new Error(
      "Refusing to reset QAP data without explicit consent. Re-run with --allow-destructive-reset or ALLOW_DESTRUCTIVE_QAP_RESET=true."
    );
  }

  console.log(`[reset] clearing transactional data in ${MSSQL_CONFIG.database}`);
  const resetStart = await resetTransactionalData();
  console.log(
    JSON.stringify(
      { reset: resetStart.beforeCounts, uploadsRemoved: resetStart.uploadsRemoved },
      null,
      2
    )
  );

  if (resetOnly) {
    console.log("[reset] completed");
    return;
  }

  let completedIds = [];

  try {
    const auth = Object.fromEntries(
      await Promise.all(
        Object.entries({
          requestor: SHARED_USERS.requestor,
          level1: SHARED_USERS.level1,
          technicalHead: SHARED_USERS.technicalHead,
          plantHead: SHARED_USERS.plantHead,
          admin: SHARED_USERS.admin,
          ...Object.fromEntries(
            Object.values(PLANT_ROLES)
              .flatMap((roles) => Object.values(roles))
              .map((user) => [user.username, user])
          ),
        }).map(async ([key, user]) => {
          const loggedIn = await login(user);
          return [key, loggedIn.cookie];
        })
      )
    );

    const bomMaster = await api("/api/bom-components", {
      cookie: auth.requestor,
    });
    assert(Array.isArray(bomMaster) && bomMaster.length > 0, "BOM master is empty");

    const masterSpecs = await fetchMasterSpecs();

    completedIds.push(
      await runWorkflowPath({
        label: "P4-APPROVAL",
        plant: "p4",
        cookies: auth,
        salesRequestCookie: auth.admin,
        bomMaster,
        masterSpecs,
      })
    );

    completedIds.push(
      await runWorkflowPath({
        label: "P2-APPROVAL",
        plant: "p2",
        cookies: auth,
        salesRequestCookie: auth.admin,
        bomMaster,
        masterSpecs,
      })
    );

    completedIds.push(
      await runWorkflowWithRequestorEdits({
        label: "P4-EDIT-RESET-APPROVAL",
        cookies: auth,
        salesRequestCookie: auth.admin,
        bomMaster,
        masterSpecs,
      })
    );

    const remainingQaps = await api("/api/qaps", { cookie: auth.requestor });
    assert(
      Array.isArray(remainingQaps) && remainingQaps.length === completedIds.length,
      "Expected only smoke-test QAPs to exist before final cleanup"
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          apiBase: API_BASE,
          completedIds,
        },
        null,
        2
      )
    );
  } finally {
    if (!keepData) {
      console.log("[reset] clearing smoke-test artifacts");
      const resetEnd = await resetTransactionalData();
      console.log(
        JSON.stringify(
          {
            postTestReset: resetEnd.beforeCounts,
            uploadsRemoved: resetEnd.uploadsRemoved,
          },
          null,
          2
        )
      );
    }
  }
}

main().catch((error) => {
  console.error("[workflow] smoke test failed");
  console.error(error?.stack || error);
  process.exit(1);
});
