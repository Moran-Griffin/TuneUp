import { ServiceType } from '@/types';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  oil_change: 'Oil Change',
  inspection: 'Inspection',
  emissions_inspection: 'Emissions Test',
  tire_rotation: 'Tire Rotation',
  brake_service: 'Brake Service',
  battery: 'Battery',
  other: 'Other',
};

export const OIL_CHANGE_WARNING_MILES = 500;
export const OIL_CHANGE_MAX_MONTHS = 6;
export const INSPECTION_WARNING_DAYS = 30;
export const EMISSIONS_WARNING_DAYS = 30;
