import { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { makeVehicle } from './helpers/makeVehicle';

// --- mocks -------------------------------------------------------------
const mockFetchQueue: Array<{ data: any; error: any }> = [];
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(mockFetchQueue.length ? mockFetchQueue.shift() : { data: [], error: null }),
      }),
    }),
  },
}));

const mockSchedule = jest.fn((_: unknown[]) => Promise.resolve());
jest.mock('@/lib/notifications', () => ({
  scheduleAllNotifications: (v: unknown[]) => mockSchedule(v),
}));

let mockStoredValue: string | null = null;
let mockReleaseStorage: (() => void) | null = null;
let mockHoldStorage = false;
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => new Promise(resolve => {
      const done = () => resolve(mockStoredValue);
      if (mockHoldStorage) mockReleaseStorage = done; else done();
    })),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

import { VehicleProvider, useVehicles, useDefaultVehicleId } from '@/hooks/VehicleContext';

const a = makeVehicle({ id: 'a', created_at: '2026-01-01T00:00:00Z' });
const b = makeVehicle({ id: 'b', created_at: '2026-02-01T00:00:00Z', model: 'Accord' });

function wrapperFor(userId: { current: string | undefined }) {
  return ({ children }: { children: ReactNode }) => (
    <VehicleProvider userId={userId.current}>{children}</VehicleProvider>
  );
}

beforeEach(() => {
  mockFetchQueue.length = 0;
  mockSchedule.mockClear();
  mockStoredValue = null;
  mockHoldStorage = false;
  mockReleaseStorage = null;
});

describe('VehicleProvider', () => {
  it('keeps vehicles and reminders when a refetch fails', async () => {
    mockFetchQueue.push({ data: [a], error: null });
    const user = { current: 'u1' as string | undefined };
    const { result } = renderHook(() => useVehicles(), { wrapper: wrapperFor(user) });
    await waitFor(() => expect(result.current.vehicles).toEqual([a]));

    mockFetchQueue.push({ data: null, error: { message: 'Network request failed' } });
    await act(async () => { await result.current.refetch(); });

    expect(result.current.vehicles).toEqual([a]);
    expect(mockSchedule).not.toHaveBeenCalledWith([]);
  });

  it('does not cancel all reminders while the session is still arriving', async () => {
    mockFetchQueue.push({ data: [a], error: null });
    const user = { current: undefined as string | undefined };
    const { result, rerender } = renderHook(() => useVehicles(), { wrapper: wrapperFor(user) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    user.current = 'u1';
    rerender({});
    await waitFor(() => expect(result.current.vehicles).toEqual([a]));
    await waitFor(() => expect(mockSchedule).toHaveBeenCalledWith([a]));

    expect(mockSchedule).not.toHaveBeenCalledWith([]);
  });

  it('keeps a selection made before the stored id finishes loading', async () => {
    mockStoredValue = 'a';
    mockHoldStorage = true;
    mockFetchQueue.push({ data: [a, b], error: null });
    const user = { current: 'u1' as string | undefined };
    const { result } = renderHook(() => useVehicles(), { wrapper: wrapperFor(user) });

    act(() => { result.current.selectVehicle('b'); });
    await act(async () => { mockReleaseStorage?.(); });

    await waitFor(() => expect(result.current.vehicles).toHaveLength(2));
    expect(result.current.selectedId).toBe('b');
  });
});

describe('useDefaultVehicleId', () => {
  it('waits for the stored selection before choosing a default', async () => {
    mockStoredValue = 'b';
    mockHoldStorage = true;
    mockFetchQueue.push({ data: [a, b], error: null });
    const user = { current: 'u1' as string | undefined };
    const { result } = renderHook(() => useDefaultVehicleId(), { wrapper: wrapperFor(user) });

    await waitFor(() => expect(mockFetchQueue).toHaveLength(0));
    await act(async () => { mockReleaseStorage?.(); });

    await waitFor(() => expect(result.current[0]).toBe('b'));
  });
});
