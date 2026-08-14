import {
  flattenLatestProjectionItems,
  hasChunkedProjection,
  reconstructCompactLegacyDocument,
  reconstructLegacyDocument,
} from './firestore-v2-compat.util';

describe('Firestore v2 compatibility reconstruction', () => {
  const path = 'management/location-1';

  it('reconstructs maps and arrays while preserving scalar fields', () => {
    const result: any = reconstructLegacyDocument(path, [{
      items: {
        reserveA: {
          id: 'reserveA', sourcePath: path, field: 'reserve',
          legacyKey: '2026-08-01', fingerprint: 'a', value: 10,
        },
        periodB: {
          id: 'periodB', sourcePath: path, field: 'weeklyPaymentTargetPeriods',
          legacyKey: 'b', fingerprint: 'b', ordinal: 1, value: { id: 'b' },
        },
        periodA: {
          id: 'periodA', sourcePath: path, field: 'weeklyPaymentTargetPeriods',
          legacyKey: 'a', fingerprint: 'c', ordinal: 0, value: { id: 'a' },
        },
      },
    }], { id: 'location-1', label: 'Central', reserve: {} });

    expect(result.label).toBe('Central');
    expect(result.reserve['2026-08-01']).toBe(10);
    expect(result.weeklyPaymentTargetPeriods).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('uses the newest version and applies tombstones', () => {
    const items = flattenLatestProjectionItems(path, [
      { items: { one: {
        id: 'one', sourcePath: path, field: 'expenses', legacyKey: 'day',
        fingerprint: 'old', sourceUpdateTimeMs: 1, value: 5,
      } } },
      { items: { one: {
        id: 'one', sourcePath: path, field: 'expenses', legacyKey: 'day',
        fingerprint: 'new', sourceUpdateTimeMs: 2, deleted: true,
      } } },
    ]);
    expect(items).toEqual([jasmine.objectContaining({ deleted: true })]);
    const result: any = reconstructLegacyDocument(
      path,
      [{ items: Object.fromEntries(items.map((item) => [item.id, item])) }],
      { expenses: { day: 5 } }
    );
    expect(Object.keys(result.expenses)).toEqual([]);
  });

  it('detects chunked payloads so callers fail closed to legacy', () => {
    expect(hasChunkedProjection(path, [{ items: { huge: {
      id: 'huge', sourcePath: path, field: 'reserve', legacyKey: 'huge',
      fingerprint: 'x', payloadEncoding: 'stable-json-chunks-v1',
    } } }])).toBeTrue();
  });

  it('reconstructs the compact read format without repeated item metadata', () => {
    const result: any = reconstructCompactLegacyDocument(path, [{
      maps: { reserve: { day1: 10 } },
      arrays: {
        weeklyPaymentTargetPeriods: {
          second: { ordinal: 1, value: { id: 'b' } },
          first: { ordinal: 0, value: { id: 'a' } },
        },
      },
    }], { id: 'location-1', scalar: true });
    expect(result.reserve).toEqual({ day1: 10 });
    expect(result.weeklyPaymentTargetPeriods).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.scalar).toBeTrue();
  });
});
