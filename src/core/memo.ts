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

export interface ListMemosOptions {
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
}

export interface MemoRepository {
  create(body: string): Memo;
  findById(id: number): Memo | null;
  list(limit?: number): Memo[];
  listByDate(options?: ListMemosOptions): Memo[];
  search(query: string, limit?: number): Memo[];
  close(): void;
}

export interface MemoReader {
  getMemo(id: number): Memo | null;
  listMemosByDate(options?: ListMemosOptions): Memo[];
  searchMemos(query: string, limit?: number): Memo[];
}
