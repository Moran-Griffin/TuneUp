export type ServiceType =
  | 'oil_change'
  | 'inspection'
  | 'emissions_inspection'
  | 'tire_rotation'
  | 'brake_service'
  | 'battery'
  | 'other';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Vehicle {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: string;
  current_mileage: number;
  last_oil_change_date: string | null;
  last_oil_change_mileage: number | null;
  oil_change_interval_miles: number;
  last_inspection_date: string | null;
  inspection_interval_months: number;
  emissions_enabled: boolean;
  last_emissions_date: string | null;
  emissions_interval_months: number;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  user_id: string;
  type: ServiceType;
  date: string;
  mileage: number | null;
  shop_name: string | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  vehicle_id: string;
  user_id: string;
  shop_name: string;
  shop_url: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  service_type: ServiceType;
  status: AppointmentStatus;
  created_at: string;
}

export interface ServiceStatus {
  isDue: boolean;
  isOverdue: boolean;
  noRecord: boolean;
  dueDate: Date | null;
  dueMileage: number | null;
  milesUntilDue: number | null;
  daysUntilDue: number | null;
}

export interface Shop {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  website?: string;
  geometry: { location: { lat: number; lng: number } };
}
