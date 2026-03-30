import { Vehicle, ServiceStatus } from '@/types';
import {
  OIL_CHANGE_WARNING_MILES,
  OIL_CHANGE_MAX_MONTHS,
  INSPECTION_WARNING_DAYS,
} from '@/constants/maintenance';

export function getOilChangeStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_oil_change_date && !vehicle.last_oil_change_mileage) {
    return { isDue: true, isOverdue: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
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
    dueDate = new Date(vehicle.last_oil_change_date);
    dueDate.setMonth(dueDate.getMonth() + OIL_CHANGE_MAX_MONTHS);
    dateOverdue = now > dueDate;
  }

  const isDue = mileageDueSoon || mileageOverdue || dateOverdue;
  const isOverdue = mileageOverdue || dateOverdue;

  return { isDue, isOverdue, dueDate, dueMileage, milesUntilDue, daysUntilDue: null };
}

export function getInspectionStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_inspection_date) {
    return { isDue: true, isOverdue: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  const dueDate = new Date(vehicle.last_inspection_date);
  dueDate.setMonth(dueDate.getMonth() + vehicle.inspection_interval_months);

  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isDue = daysUntilDue <= INSPECTION_WARNING_DAYS;

  return { isDue, isOverdue, dueDate, dueMileage: null, milesUntilDue: null, daysUntilDue };
}
