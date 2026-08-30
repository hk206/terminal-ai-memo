import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getDatabasePath } from "./config";
import type {
  ListMemosOptions,
  Memo,
  MemoRepository,
  MemoStatus,
} from "./core/memo";

export type { ListMemosOptions, Memo, MemoStatus } from "./core/memo";

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

export class MemoStore implements MemoRepository {
  private readonly database: Database;

  constructor(
    databasePath: string = getDatabasePath(),
    private readonly now: () => Date = () => new Date(),
  ) {
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

    const timestamp = this.now().toISOString();
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

  list(limit = 20): Memo[] {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("List limit must be a positive integer");
    }

    const rows = this.database
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
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(limit);

    return rows.map(toMemo);
  }

  listByDate(options: ListMemosOptions = {}): Memo[] {
    const limit = options.limit ?? 20;

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("List limit must be a positive integer");
    }

    const createdFrom = options.createdFrom ?? null;
    const createdTo = options.createdTo ?? null;
    const rows = this.database
      .query<
        MemoRow,
        [string | null, string | null, string | null, string | null, number]
      >(
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
         WHERE (? IS NULL OR created_at >= ?)
           AND (? IS NULL OR created_at < ?)
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(createdFrom, createdFrom, createdTo, createdTo, limit);

    return rows.map(toMemo);
  }

  search(query: string, limit = 20): Memo[] {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      throw new Error("Search query must not be empty");
    }

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Search limit must be a positive integer");
    }

    const rows = this.database
      .query<MemoRow, [string, number]>(
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
         WHERE instr(lower(body), lower(?)) > 0
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(normalizedQuery, limit);

    return rows.map(toMemo);
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
