import type { ListMemosOptions, Memo, MemoRepository } from "./memo";

export class TeletypeMemoCore {
  constructor(private readonly memos: MemoRepository) {}

  captureMemo(body: string): Memo {
    return this.memos.create(body);
  }

  getMemo(id: number): Memo | null {
    return this.memos.findById(id);
  }

  listMemos(limit = 20): Memo[] {
    return this.memos.list(limit);
  }

  listMemosByDate(options: ListMemosOptions = {}): Memo[] {
    return this.memos.listByDate(options);
  }

  searchMemos(query: string, limit = 20): Memo[] {
    return this.memos.search(query, limit);
  }

  close(): void {
    this.memos.close();
  }
}
