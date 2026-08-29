import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getDatabasePath } from "./config";

export type MemoStatus = "raw" | "organized";

export interface Memo {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  project: string | null;
  projectRoot: string | null;
  title: string | null;
  summary: string | null;
  status: MemoStatus;
}

interface MemoRow {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  project: string | null;
  project_root: string | null;
  title: string | null;
  summary: string | null;
  status: MemoStatus;
}

export class MemoStore {
  private readonly database: Database;

  constructor(databasePath: string = getDatabasePath()) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.database = new Database(databasePath, { create: true });
    this.initializeSchema();
  }

  create(body: string): Memo {
    if (body.trim().length === 0) {
      throw new Error("Memo body must not be empty");
    }

    const timestamp = new Date().toISOString();
    const result = this.database
      .query(
        `INSERT INTO memos (body, created_at, updated_at)
         VALUES (?, ?, ?)`,
      )
      .run(body, timestamp, timestamp);

    const memo = this.findById(Number(result.lastInsertRowid));

    if (!memo) {
      throw new Error("Saved memo could not be read back");
    }

    return memo;
  }

  findById(id: number): Memo | null {
    const row = this.database
      .query<MemoRow, [number]>(
        `SELECT
           id,
           body,
           created_at,
           updated_at,
           project,
           project_root,
           title,
           summary,
           status
         FROM memos
         WHERE id = ?`,
      )
      .get(id);

    return row ? toMemo(row) : null;
  }

  close(): void {
    this.database.close();
  }

  private initializeSchema(): void {
    this.database.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        body TEXT NOT NULL CHECK (length(trim(body)) > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        project TEXT,
        project_root TEXT,
        title TEXT,
        summary TEXT,
        status TEXT NOT NULL DEFAULT 'raw'
          CHECK (status IN ('raw', 'organized'))
      );
    `);
  }
}

function toMemo(row: MemoRow): Memo {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.project,
    projectRoot: row.project_root,
    title: row.title,
    summary: row.summary,
    status: row.status,
  };
}
