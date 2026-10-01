import { createEmptyState } from '../../application/state';
import { buildExportPayload, exportFileName, shareJson } from './share-json';

const mockWrite = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache://' },
  File: jest.fn().mockImplementation((dir: string, name: string) => ({ uri: `${dir}${name}`, create: mockCreate, write: mockWrite, delete: mockDelete })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const Sharing = jest.requireMock('expo-sharing') as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };

describe('exportação (BR-ACC-004)', () => {
  it('payload sem identificadores de sessão', () => {
    const state = { ...createEmptyState(), sync: { ...createEmptyState().sync, userId: 'u-1', lastSyncAt: 'ontem' } };
    const payload = JSON.parse(buildExportPayload(state, new Date('2026-10-10T00:00:00Z')));
    expect(payload).toMatchObject({ app: 'manager-money', schemaVersion: 2, sync: { lastSyncAt: 'ontem' } });
    expect(JSON.stringify(payload)).not.toContain('u-1');
    expect(exportFileName(new Date(2026, 9, 10))).toBe('manager-money-2026-10-10.json');
  });

  it('grava no cache e compartilha', async () => {
    await shareJson('a.json', '{}');
    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
    expect(mockWrite).toHaveBeenCalledWith('{}');
    expect(Sharing.shareAsync).toHaveBeenCalledWith('cache://a.json', expect.objectContaining({ mimeType: 'application/json' }));
    expect(mockDelete).toHaveBeenCalled();
  });

  it('falha quando o compartilhamento não existe', async () => {
    Sharing.isAvailableAsync.mockResolvedValueOnce(false);
    mockDelete.mockClear();
    await expect(shareJson('a.json', '{}')).rejects.toThrow('compartilhamento não está disponível');
    expect(mockDelete).toHaveBeenCalled();
  });
});
