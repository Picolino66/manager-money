import { SyncTable } from '../../application/state';
import { RemoteRow, RowByTable, SyncError, SyncRemote } from './types';

type Store = { [T in SyncTable]: RowByTable[T][] };

/**
 * Servidor em memória que reproduz as garantias do schema Supabase relevantes ao sync:
 * isolamento por usuário, `server_updated_at` monotônico, índice único de ciclo ativo e
 * ausência de DELETE físico. Usado nos testes (SPEC-006).
 */
export class MemoryServer {
  private tick = 0;
  readonly data: Record<string, Store> = {};

  nextTimestamp(): string {
    this.tick += 1;
    return new Date(Date.UTC(2030, 0, 1, 0, 0, 0, this.tick)).toISOString();
  }

  store(userId: string): Store {
    this.data[userId] ??= {
      settings: [],
      fixed_expenses: [],
      credit_cards: [],
      cycles: [],
      expenses: [],
      card_purchases: [],
    };
    return this.data[userId];
  }

  clientFor(userId: string): MemoryRemote {
    return new MemoryRemote(this, userId);
  }
}

export class MemoryRemote implements SyncRemote {
  offline = false;
  calls: { op: string; table?: SyncTable; ids?: string[] }[] = [];

  constructor(
    private readonly server: MemoryServer,
    private readonly userId: string,
  ) {}

  private guard() {
    if (this.offline) throw new SyncError('network');
  }

  private key(table: SyncTable, row: RemoteRow) {
    return table === 'settings' ? 'settings' : (row as { id: string }).id;
  }

  async upsert<T extends SyncTable>(table: T, rows: RowByTable[T][]): Promise<void> {
    this.guard();
    this.calls.push({ op: 'upsert', table, ids: rows.map((row) => this.key(table, row)) });
    const store = this.server.store(this.userId);
    const target = store[table] as RemoteRow[];

    // Verificação linha a linha, como o índice único não-deferível do Postgres.
    for (const row of rows) {
      if (row.user_id !== this.userId) throw new SyncError('auth', 'RLS');
      const id = this.key(table, row);
      const index = target.findIndex((existing) => this.key(table, existing) === id);

      if (table === 'cycles') {
        const cycle = row as RowByTable['cycles'];
        const otherActive = (store.cycles as RowByTable['cycles'][]).some(
          (existing) => existing.id !== cycle.id && existing.status === 'active' && existing.deleted_at === null,
        );
        if (cycle.status === 'active' && cycle.deleted_at === null && otherActive) {
          throw new SyncError('conflict-active-cycle');
        }
      }

      const stored = { ...row, server_updated_at: this.server.nextTimestamp() };
      if (index >= 0) target[index] = stored;
      else target.push(stored);
    }
  }

  async pull<T extends SyncTable>(table: T, since: string | null): Promise<RowByTable[T][]> {
    this.guard();
    this.calls.push({ op: 'pull', table });
    return (this.server.store(this.userId)[table] as RowByTable[T][])
      .filter((row) => !since || (row.server_updated_at ?? '') > since)
      .sort((a, b) => (a.server_updated_at ?? '').localeCompare(b.server_updated_at ?? ''))
      .map((row) => ({ ...row }));
  }

  async hasData(): Promise<boolean> {
    this.guard();
    const store = this.server.store(this.userId);
    return [...store.settings, ...store.cycles].some((row) => row.deleted_at === null);
  }

  async markAllDeleted(nowIso: string): Promise<void> {
    this.guard();
    const store = this.server.store(this.userId);
    for (const table of Object.keys(store) as SyncTable[]) {
      store[table] = (store[table] as RemoteRow[]).map((row) =>
        row.deleted_at ? row : { ...row, deleted_at: nowIso, server_updated_at: this.server.nextTimestamp() },
      ) as never;
    }
  }

  async deleteAccount(): Promise<void> {
    this.guard();
    delete this.server.data[this.userId];
  }
}
