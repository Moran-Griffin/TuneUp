import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Vehicle } from '@/types';
import { sortVehicles } from '@/lib/vehicleDisplay';
import { resolveSelectedVehicleId } from '@/lib/vehicleSelection';
import { scheduleAllNotifications } from '@/lib/notifications';

export const SELECTED_VEHICLE_KEY = '@tuneup/selected_vehicle_id';

export type VehicleInput = Partial<Omit<Vehicle, 'id' | 'user_id' | 'created_at'>>;
export type HomeView = 'detail' | 'overview';

type VehicleContextValue = {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  selectedId: string | null;
  selectVehicle(id: string): void;
  homeView: HomeView;
  setHomeView(v: HomeView): void;
  loading: boolean;
  refetch(): Promise<void>;
  createVehicle(data: VehicleInput): Promise<Vehicle>;
  updateVehicle(id: string, data: VehicleInput): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<void>;
};

const VehicleContext = createContext<VehicleContextValue | null>(null);

export function VehicleProvider({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [storedId, setStoredId] = useState<string | null>(null);
  const [storedLoaded, setStoredLoaded] = useState(false);
  // Which userId the current `vehicles` were fetched for ({ for: undefined } = signed out),
  // and whether that fetch succeeded. Loading is derived, so a userId change is
  // never mistaken for "loaded with zero vehicles".
  const [loaded, setLoaded] = useState<{ for: string | undefined; ok: boolean } | null>(null);
  const [homeView, setHomeView] = useState<HomeView>('detail');
  const lastScheduledKey = useRef<string | null>(null);
  const userSelected = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_VEHICLE_KEY)
      // A selection made before storage resolves (e.g. a notification tap) wins.
      .then(id => { if (!userSelected.current) setStoredId(id); })
      .catch(() => {})
      .finally(() => setStoredLoaded(true));
  }, []);

  const refetch = useCallback(async () => {
    if (!userId) {
      setVehicles([]);
      setLoaded({ for: undefined, ok: true });
      return;
    }
    const { data, error } = await supabase.from('vehicles').select('*').eq('user_id', userId);
    if (error) {
      // Keep what we had (offline/network blip). Only clear another user's stale list.
      setLoaded(prev => {
        if (prev?.for !== userId) setVehicles([]);
        return { for: userId, ok: prev?.for === userId && prev.ok };
      });
      return;
    }
    setVehicles(sortVehicles(data ?? []));
    setLoaded({ for: userId, ok: true });
  }, [userId]);

  useEffect(() => {
    lastScheduledKey.current = null;
    refetch();
  }, [refetch]);

  const loading = !loaded || loaded.for !== userId;

  const selectedId = resolveSelectedVehicleId(vehicles, storedId);
  const selectedVehicle = vehicles.find(v => v.id === selectedId) ?? null;

  const selectVehicle = useCallback((id: string) => {
    userSelected.current = true;
    setStoredId(id);
    AsyncStorage.setItem(SELECTED_VEHICLE_KEY, id).catch(() => {});
  }, []);

  // Centralized notification rescheduling: only when vehicle data actually changes.
  useEffect(() => {
    if (!userId || loading || !loaded?.ok) return;
    const key = JSON.stringify(vehicles);
    if (key === lastScheduledKey.current) return;
    lastScheduledKey.current = key;
    scheduleAllNotifications(vehicles).catch((e: unknown) => console.warn('Notification scheduling failed:', e));
  }, [userId, loading, loaded, vehicles]);

  const createVehicle = useCallback(async (data: VehicleInput) => {
    const { data: created, error } = await supabase
      .from('vehicles')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    setVehicles(prev => sortVehicles([...prev, created]));
    selectVehicle(created.id);
    return created as Vehicle;
  }, [userId, selectVehicle]);

  const updateVehicle = useCallback(async (id: string, data: VehicleInput) => {
    const { data: updated, error } = await supabase
      .from('vehicles')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    setVehicles(prev => prev.map(v => (v.id === id ? updated : v)));
    return updated as Vehicle;
  }, []);

  const deleteVehicle = useCallback(async (id: string) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
    setVehicles(prev => prev.filter(v => v.id !== id));
  }, []);

  const value = useMemo<VehicleContextValue>(() => ({
    vehicles,
    selectedVehicle,
    selectedId,
    selectVehicle,
    homeView,
    setHomeView,
    loading: loading || !storedLoaded,
    refetch,
    createVehicle,
    updateVehicle,
    deleteVehicle,
  }), [vehicles, selectedVehicle, selectedId, selectVehicle, homeView, loading, storedLoaded, refetch, createVehicle, updateVehicle, deleteVehicle]);

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicles(): VehicleContextValue {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error('useVehicles must be used inside <VehicleProvider>');
  return ctx;
}

/**
 * Local vehicle choice for a form (e.g. Add Entry). Defaults to the selected
 * vehicle only once loading finishes, so a cold start can't latch the fallback car.
 */
export function useDefaultVehicleId(): readonly [string | null, (id: string) => void] {
  const { selectedId, loading } = useVehicles();
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  useEffect(() => {
    if (!loading && vehicleId === null && selectedId) setVehicleId(selectedId);
  }, [loading, vehicleId, selectedId]);
  return [vehicleId, setVehicleId] as const;
}
