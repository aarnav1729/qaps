#!/usr/bin/env node
// seed_users.cjs
require('dotenv').config();
const mysql = require('mysql2/promise');
const sql = require('mssql');
const { randomUUID } = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// 1) Configs (match server/server.js)
// ─────────────────────────────────────────────────────────────────────────────
const mysqlConfig = {
  host:     process.env.MYSQL_HOST || "localhost",
  port:     Number(process.env.MYSQL_PORT) || 3306,
  user:     process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "Singhcottage@1729",
  database: process.env.MYSQL_DB   || "QAP",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0
};

const mssqlConfig = {
  user:     process.env.MSSQL_USER     || "SPOT_USER",
  password: process.env.MSSQL_PASSWORD || "Marvik#72@",
  server:   process.env.MSSQL_SERVER   || "10.0.40.10",
  port:     Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB       || "QAP",
  options: {
    trustServerCertificate: true,
    encrypt: false
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2) Hard‑coded users
// ─────────────────────────────────────────────────────────────────────────────
const hardcodedUsers = [
  { username: 'praful',   password: 'praful',   role: 'requestor' },
  { username: 'yamini',   password: 'yamini',   role: 'requestor' },
  { username: 'manoj',    password: 'manoj',    role: 'production',    plant: 'p2' },
  { username: 'malik',    password: 'malik',    role: 'production',    plant: 'p4' },
  { username: 'siva',     password: 'siva',     role: 'production',    plant: 'p5' },
  { username: 'abbas',    password: 'abbas',    role: 'quality',       plant: 'p2' },
  { username: 'sriram',   password: 'sriram',   role: 'quality',       plant: 'p4,p5' },
  { username: 'rahul',    password: 'rahul',    role: 'technical',     plant: 'p2' },
  { username: 'ramu',     password: 'ramu',     role: 'technical',     plant: 'p4,p5' },
  { username: 'nrao',     password: 'nrao',     role: 'head',          plant: 'p4,p5' },
  { username: 'jmr',      password: 'jmr',      role: 'technical-head' },
  { username: 'baskara',  password: 'baskara',  role: 'technical-head' },
  { username: 'cmk',      password: 'cmk',      role: 'plant-head' },
  { username: 'aarnav',   password: 'aarnav',   role: 'admin' }
];

;(async () => {
  let mysqlPool, mssqlPool;
  try {
    // ── Connect to MySQL
    mysqlPool = await mysql.createPool(mysqlConfig);
    console.log(`✅ Connected to MySQL → ${mysqlConfig.database}`);

    // ── Connect to MSSQL
    mssqlPool = await sql.connect(mssqlConfig);
    console.log(`✅ Connected to MSSQL → ${mssqlConfig.database}`);

    // ── Ensure MySQL Users table (if you ever run this standalone)
    await mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS Users (
        id           CHAR(36)     NOT NULL PRIMARY KEY,
        username     VARCHAR(50)  NOT NULL UNIQUE,
        passwordHash VARCHAR(200) NOT NULL,
        role         VARCHAR(20)  NOT NULL,
        plant        VARCHAR(100) NULL
      ) ENGINE=InnoDB;
    `);

    // ── (Optional) Ensure MSSQL Users table
    //      if you want the script to create it when missing.
    await mssqlPool.request().batch(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='Users')
      CREATE TABLE Users (
        id           UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        username     NVARCHAR(50)    UNIQUE NOT NULL,
        passwordHash NVARCHAR(200)   NOT NULL,
        role         NVARCHAR(20)    NOT NULL,
        plant        NVARCHAR(100)   NULL
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3) Seed every user
    // ─────────────────────────────────────────────────────────────────────────
    let count = 0;
    for (const u of hardcodedUsers) {
      const id = randomUUID();

      // — MSSQL: only insert if username not already there
      await mssqlPool.request()
        .input('id',       sql.UniqueIdentifier, id)
        .input('username', sql.NVarChar,         u.username)
        .input('password', sql.NVarChar,         u.password)
        .input('role',     sql.NVarChar,         u.role)
        .input('plant',    sql.NVarChar,         u.plant || null)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Users WHERE username=@username)
            INSERT INTO Users (id,username,passwordHash,role,plant)
            VALUES (@id,@username,@password,@role,@plant);
        `);

      // — MySQL: INSERT IGNORE so we only add new rows
      await mysqlPool.execute(
        `INSERT IGNORE INTO Users 
          (id,username,passwordHash,role,plant)
         VALUES (?, ?, ?, ?, ?);`,
        [ id, u.username, u.password, u.role, u.plant || null ]
      );

      count++;
    }

    console.log(`✅ Seeded ${count} users into both MSSQL & MySQL`);
  } catch (err) {
    console.error('❌ Error seeding users:', err);
    process.exit(1);
  } finally {
    if (mysqlPool) await mysqlPool.end();
    if (mssqlPool) await mssqlPool.close();
  }
})();
