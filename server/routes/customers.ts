// src/server/routes/customers.ts
import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Minimal JSON-file persistence to avoid impacting existing infra.
 * - data/customers.json : array of { id, name, createdAt, updatedAt }
 * - data/sales-requests.json : OPTIONAL read-only (for counts). If not present, counts=0.
 *
 * If your app already persists Sales Requests elsewhere, feel free to replace
 * `readSalesRequests()` with your own data access.
 */

type Customer = {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

type SalesRequest = {
  id: string;
  customerName: string;
  createdAt: string;
  // ... other fields are ignored for counts
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const SALES_REQUESTS_FILE = path.join(DATA_DIR, "sales-requests.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(file: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

async function readCustomers(): Promise<Customer[]> {
  return readJsonFile<Customer[]>(CUSTOMERS_FILE, []);
}

async function writeCustomers(customers: Customer[]): Promise<void> {
  await writeJsonFile(CUSTOMERS_FILE, customers);
}

async function readSalesRequests(): Promise<SalesRequest[]> {
  // This file may or may not exist; treat absence as empty.
  return readJsonFile<SalesRequest[]>(SALES_REQUESTS_FILE, []);
}

function nowIso() {
  return new Date().toISOString();
}

const router = Router();

/**
 * GET /api/customers
 * Optional query: includeCounts=1  -> include { salesRequestCount }
 */
router.get("/", async (req, res) => {
  try {
    const includeCounts = String(req.query.includeCounts || "") === "1";
    const customers = await readCustomers();

    if (!includeCounts) {
      return res.json(customers);
    }

    const srs = await readSalesRequests();
    const countMap = new Map<string, number>();
    for (const sr of srs) {
      const key = (sr.customerName || "").trim().toLowerCase();
      if (!key) continue;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const withCounts = customers.map((c) => ({
      ...c,
      salesRequestCount: countMap.get((c.name || "").trim().toLowerCase()) || 0,
    }));
    res.json(withCounts);
  } catch (e: any) {
    res.status(500).send(e?.message || "Failed to fetch customers");
  }
});

/**
 * POST /api/customers
 * body: { name: string }
 */
router.post("/", async (req, res) => {
  try {
    const nameRaw = String((req.body?.name ?? "") as string).trim();
    if (!nameRaw) {
      return res.status(400).send("Name is required");
    }

    const customers = await readCustomers();
    const dupe = customers.find(
      (c) => c.name.trim().toLowerCase() === nameRaw.toLowerCase()
    );
    if (dupe) {
      return res.status(409).send("A customer with this name already exists");
    }

    const customer: Customer = {
      id: randomUUID(),
      name: nameRaw,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    customers.push(customer);
    await writeCustomers(customers);
    res.status(201).json(customer);
  } catch (e: any) {
    res.status(500).send(e?.message || "Failed to create customer");
  }
});

/**
 * GET /api/customers/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const customers = await readCustomers();
    const c = customers.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).send("Customer not found");
    res.json(c);
  } catch (e: any) {
    res.status(500).send(e?.message || "Failed to fetch customer");
  }
});

/**
 * PUT /api/customers/:id
 * body: { name: string }
 */
router.put("/:id", async (req, res) => {
  try {
    const nameRaw = String((req.body?.name ?? "") as string).trim();
    if (!nameRaw) {
      return res.status(400).send("Name is required");
    }

    const customers = await readCustomers();
    const idx = customers.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).send("Customer not found");

    const dupe = customers.find(
      (c) =>
        c.id !== req.params.id &&
        c.name.trim().toLowerCase() === nameRaw.toLowerCase()
    );
    if (dupe) {
      return res.status(409).send("A customer with this name already exists");
    }

    customers[idx] = {
      ...customers[idx],
      name: nameRaw,
      updatedAt: nowIso(),
    };
    await writeCustomers(customers);
    res.json(customers[idx]);
  } catch (e: any) {
    res.status(500).send(e?.message || "Failed to update customer");
  }
});

/**
 * DELETE /api/customers/:id
 * - Does NOT delete sales requests; they remain associated by name.
 */
router.delete("/:id", async (req, res) => {
  try {
    const customers = await readCustomers();
    const idx = customers.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).send("Customer not found");
    customers.splice(idx, 1);
    await writeCustomers(customers);
    res.status(204).send("");
  } catch (e: any) {
    res.status(500).send(e?.message || "Failed to delete customer");
  }
});

export default router;
