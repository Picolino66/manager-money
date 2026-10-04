import { createEmptyState } from './state';
import { buildExportPayload, exportFileName } from './export-data';

describe('exportação', () => {
  it('não leva sessão: só a data da última sincronização', () => {
    const state = createEmptyState();
    state.sync = { ...state.sync, userId: 'user-secreto', lastSyncAt: '2026-10-04T10:00:00.000Z' };
    const payload = JSON.parse(buildExportPayload(state, new Date('2026-10-04T12:00:00Z')));

    expect(payload.app).toBe('manager-money');
    expect(payload.sync).toEqual({ lastSyncAt: '2026-10-04T10:00:00.000Z' });
    expect(JSON.stringify(payload)).not.toContain('user-secreto');
    expect(exportFileName(new Date(2026, 9, 4, 12))).toBe('manager-money-2026-10-04.json');
  });
});
