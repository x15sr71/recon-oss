import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { CONFIG } from "../config";

const DB_PATH = path.join(CONFIG.dataDir, "repo.db");

let db: any = null;

export async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    createSchema(db);
    console.log("  [db] Created new repo.db.");
  }
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  // Atomic write: write to .tmp first, then rename
  const tmpPath = DB_PATH + ".tmp";
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, DB_PATH);
}

function createSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS issues (
      number INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      state TEXT NOT NULL,
      labels TEXT DEFAULT '[]',
      body_snippet TEXT DEFAULT '',
      comment_count INTEGER DEFAULT 0,
      reactions INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      closed_at TEXT,
      linked_pr_numbers TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS merged_prs (
      number INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      labels TEXT DEFAULT '[]',
      author TEXT,
      merged_at TEXT,
      body_snippet TEXT DEFAULT '',
      changed_areas TEXT DEFAULT '[]',
      linked_issue_ids TEXT DEFAULT '[]',
      key_comment TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);
    CREATE INDEX IF NOT EXISTS idx_issues_updated ON issues(updated_at);
    CREATE INDEX IF NOT EXISTS idx_prs_merged ON merged_prs(merged_at);
  `);
}

// ── Read operations ──────────────────────────────────────────────

export async function getRecentMergedPRs(sinceIso) {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT * FROM merged_prs 
    WHERE merged_at >= ? 
    ORDER BY merged_at DESC
  `);
  stmt.bind([sinceIso]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.map(deserializePR);
}

export async function getIssuesByNumbers(numbers) {
  if (!numbers.length) return [];
  const db = await getDb();
  const placeholders = numbers.map(() => "?").join(",");
  const stmt = db.prepare(`SELECT * FROM issues WHERE number IN (${placeholders})`);
  stmt.bind(numbers);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.map(deserializeIssue);
}

export async function getTrendingOpenIssues(labels = [], limit = 10) {
  const db = await getDb();
  // Get open issues with label overlap + high reactions, updated recently
  let query, params;
  if (labels.length > 0) {
    // Issues where any of the given labels appear in their labels JSON
    const labelConditions = labels.slice(0, 5).map(() => "labels LIKE ?").join(" OR ");
    query = `
      SELECT * FROM issues 
      WHERE state = 'open' AND (${labelConditions})
      ORDER BY reactions DESC, comment_count DESC 
      LIMIT ?
    `;
    params = [...labels.slice(0, 5).map(l => `%${l}%`), limit];
  } else {
    query = `
      SELECT * FROM issues 
      WHERE state = 'open' 
      ORDER BY reactions DESC, comment_count DESC 
      LIMIT ?
    `;
    params = [limit];
  }
  const stmt = db.prepare(query);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.map(deserializeIssue);
}

export async function getSyncState(key) {
  const db = await getDb();
  const stmt = db.prepare("SELECT value FROM sync_state WHERE key = ?");
  stmt.bind([key]);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result?.value ?? null;
}

export async function setSyncState(key, value) {
  const db = await getDb();
  db.run(
    "INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)",
    [key, value]
  );
}

export async function getDbStats() {
  const db = await getDb();
  const openIssues = db.exec("SELECT COUNT(*) FROM issues WHERE state = 'open'")[0]?.values[0][0] ?? 0;
  const totalPRs = db.exec("SELECT COUNT(*) FROM merged_prs")[0]?.values[0][0] ?? 0;
  const lastSync = await getSyncState("last_sync");
  return { openIssues, totalPRs, lastSync };
}

// ── Write operations ─────────────────────────────────────────────

export async function upsertIssue(issue) {
  const db = await getDb();
  db.run(`
    INSERT OR REPLACE INTO issues 
    (number, title, state, labels, body_snippet, comment_count, reactions, created_at, updated_at, closed_at, linked_pr_numbers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    issue.number,
    issue.title,
    issue.state,
    JSON.stringify(issue.labels ?? []),
    issue.body_snippet ?? "",
    issue.comment_count ?? 0,
    issue.reactions ?? 0,
    issue.created_at ?? null,
    issue.updated_at ?? null,
    issue.closed_at ?? null,
    JSON.stringify(issue.linked_pr_numbers ?? []),
  ]);
}

export async function upsertPR(pr) {
  const db = await getDb();
  db.run(`
    INSERT OR REPLACE INTO merged_prs
    (number, title, labels, author, merged_at, body_snippet, changed_areas, linked_issue_ids, key_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    pr.number,
    pr.title,
    JSON.stringify(pr.labels ?? []),
    pr.author ?? "",
    pr.merged_at ?? null,
    pr.body_snippet ?? "",
    JSON.stringify(pr.changed_areas ?? []),
    JSON.stringify(pr.linked_issue_ids ?? []),
    pr.key_comment ?? "",
  ]);
}

// ── Helpers ──────────────────────────────────────────────────────

function deserializeIssue(row) {
  return {
    ...row,
    labels: JSON.parse(row.labels ?? "[]"),
    linked_pr_numbers: JSON.parse(row.linked_pr_numbers ?? "[]"),
  };
}

function deserializePR(row) {
  return {
    ...row,
    labels: JSON.parse(row.labels ?? "[]"),
    changed_areas: JSON.parse(row.changed_areas ?? "[]"),
    linked_issue_ids: JSON.parse(row.linked_issue_ids ?? "[]"),
  };
}
