import { Vehicle } from '@/types';
import { useVehicles, VehicleInput } from '@/hooks/VehicleContext';

/** The currently selected vehicle plus mutations bound to it. */
export function useVehicle() {
  const { selectedVehicle, loading, refetch, createVehicle, updateVehicle, deleteVehicle } = useVehicles();
  const id = selectedVehicle?.id;

  return {
    vehicle: selectedVehicle,
    loading,
    refetch,
    createVehicle,
    async updateVehicle(data: VehicleInput): Promise<Vehicle | undefined> {
      if (!id) return undefined;
      return updateVehicle(id, data);
    },
    async deleteVehicle(): Promise<void> {
      if (!id) return;
      await deleteVehicle(id);
    },
  };
}
