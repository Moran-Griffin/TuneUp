import { Vehicle, ServiceStatus } from '@/types';
import {
  OIL_CHANGE_WARNING_MILES,
  OIL_CHANGE_MAX_MONTHS,
  INSPECTION_WARNING_DAYS,
  EMISSIONS_WARNING_DAYS,
} from '@/constants/maintenance';

export function getOilChangeStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_oil_change_date && !vehicle.last_oil_change_mileage) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  let mileageOverdue = false;
  let mileageDueSoon = false;
  let milesUntilDue: number | null = null;
  let dueMileage: number | null = null;

  if (vehicle.last_oil_change_mileage !== null) {
    dueMileage = vehicle.last_oil_change_mileage + vehicle.oil_change_interval_miles;
    milesUntilDue = dueMileage - vehicle.current_mileage;
    mileageOverdue = milesUntilDue < 0;
    mileageDueSoon = milesUntilDue <= OIL_CHANGE_WARNING_MILES;
  }

  let dateOverdue = false;
  let dueDate: Date | null = null;

  if (vehicle.last_oil_change_date) {
    const [y, m, d] = vehicle.last_oil_change_date.split('-').map(Number);
    dueDate = new Date(y, m - 1, d);
    dueDate.setMonth(dueDate.getMonth() + OIL_CHANGE_MAX_MONTHS);
    dateOverdue = now > dueDate;
  }

  const isDue = mileageDueSoon || mileageOverdue || dateOverdue;
  const isOverdue = mileageOverdue || dateOverdue;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage, milesUntilDue, daysUntilDue: null };
}

export function getInspectionStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_inspection_date) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  const [iy, im, id] = vehicle.last_inspection_date.split('-').map(Number);
  const dueDate = new Date(iy, im - 1, id);
  dueDate.setMonth(dueDate.getMonth() + vehicle.inspection_interval_months);

  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isDue = daysUntilDue <= INSPECTION_WARNING_DAYS;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage: null, milesUntilDue: null, daysUntilDue };
}

export function getEmissionsStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_emissions_date) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  const [ey, em, ed] = vehicle.last_emissions_date.split('-').map(Number);
  const dueDate = new Date(ey, em - 1, ed);
  dueDate.setMonth(dueDate.getMonth() + vehicle.emissions_interval_months);

  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isDue = daysUntilDue <= EMISSIONS_WARNING_DAYS;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage: null, milesUntilDue: null, daysUntilDue };
}
