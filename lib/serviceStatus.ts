import { Vehicle, ServiceStatus } from '@/types';
import {
  OIL_CHANGE_WARNING_MILES,
  INSPECTION_WARNING_DAYS,
  EMISSIONS_WARNING_DAYS,
} from '@/constants/maintenance';

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getOilChangeStatus(vehicle: Vehicle): ServiceStatus {
  const hasOverride =
    vehicle.oil_due_mileage_override !== null || vehicle.oil_due_date_override !== null;

  if (!vehicle.last_oil_change_date && !vehicle.last_oil_change_mileage && !hasOverride) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  let mileageOverdue = false;
  let mileageDueSoon = false;
  let milesUntilDue: number | null = null;
  let dueMileage: number | null = null;

  if (vehicle.oil_due_mileage_override !== null) {
    dueMileage = vehicle.oil_due_mileage_override;
  } else if (vehicle.last_oil_change_mileage !== null) {
    dueMileage = vehicle.last_oil_change_mileage + vehicle.oil_change_interval_miles;
  }
  if (dueMileage !== null) {
    milesUntilDue = dueMileage - vehicle.current_mileage;
    mileageOverdue = milesUntilDue < 0;
    mileageDueSoon = milesUntilDue <= OIL_CHANGE_WARNING_MILES;
  }

  let dateOverdue = false;
  let dueDate: Date | null = null;

  if (vehicle.oil_due_date_override !== null) {
    dueDate = parseDate(vehicle.oil_due_date_override);
    dateOverdue = now > dueDate;
  } else if (vehicle.last_oil_change_date) {
    dueDate = parseDate(vehicle.last_oil_change_date);
    dueDate.setMonth(dueDate.getMonth() + vehicle.oil_change_interval_months);
    dateOverdue = now > dueDate;
  }

  const isDue = mileageDueSoon || mileageOverdue || dateOverdue;
  const isOverdue = mileageOverdue || dateOverdue;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage, milesUntilDue, daysUntilDue: null };
}

export function getInspectionStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_inspection_date && !vehicle.inspection_due_date_override) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  let dueDate: Date;
  if (vehicle.inspection_due_date_override) {
    dueDate = parseDate(vehicle.inspection_due_date_override);
  } else {
    dueDate = parseDate(vehicle.last_inspection_date!);
    dueDate.setMonth(dueDate.getMonth() + vehicle.inspection_interval_months);
  }

  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isDue = daysUntilDue <= INSPECTION_WARNING_DAYS;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage: null, milesUntilDue: null, daysUntilDue };
}

export function getEmissionsStatus(vehicle: Vehicle): ServiceStatus {
  if (!vehicle.last_emissions_date && !vehicle.emissions_due_date_override) {
    return { isDue: true, isOverdue: true, noRecord: true, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };
  }

  const now = new Date();
  let dueDate: Date;
  if (vehicle.emissions_due_date_override) {
    dueDate = parseDate(vehicle.emissions_due_date_override);
  } else {
    dueDate = parseDate(vehicle.last_emissions_date!);
    dueDate.setMonth(dueDate.getMonth() + vehicle.emissions_interval_months);
  }

  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isDue = daysUntilDue <= EMISSIONS_WARNING_DAYS;

  return { isDue, isOverdue, noRecord: false, dueDate, dueMileage: null, milesUntilDue: null, daysUntilDue };
}
