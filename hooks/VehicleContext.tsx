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
  const [loading, setLoading] = useState(true);
  const [homeView, setHomeView] = useState<HomeView>('detail');
  const lastScheduledKey = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_VEHICLE_KEY)
      .then(id => setStoredId(id))
      .catch(() => {})
      .finally(() => setStoredLoaded(true));
  }, []);

  const refetch = useCallback(async () => {
    if (!userId) {
      setVehicles([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('vehicles').select('*').eq('user_id', userId);
    setVehicles(sortVehicles(data ?? []));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    lastScheduledKey.current = null;
    refetch();
  }, [refetch]);

  const selectedId = resolveSelectedVehicleId(vehicles, storedId);
  const selectedVehicle = vehicles.find(v => v.id === selectedId) ?? null;

  const selectVehicle = useCallback((id: string) => {
    setStoredId(id);
    AsyncStorage.setItem(SELECTED_VEHICLE_KEY, id).catch(() => {});
  }, []);

  // Centralized notification rescheduling: only when vehicle data actually changes.
  useEffect(() => {
    if (!userId || loading) return;
    const key = JSON.stringify(vehicles);
    if (key === lastScheduledKey.current) return;
    lastScheduledKey.current = key;
    scheduleAllNotifications(vehicles).catch((e: unknown) => console.warn('Notification scheduling failed:', e));
  }, [userId, loading, vehicles]);

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
