export type UserRole = 'admin' | 'employee' | 'customer';

export type ShipmentPhase = 'pickup' | 'transit' | 'handed_to_carrier' | 'out_for_delivery' | 'completed';

export type TransportMode = 'train' | 'air';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  company_name: string | null;
  firebase_uid: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Shipment {
  id: string;
  tracking_id: string;
  status: string;
  current_phase: ShipmentPhase;
  pickup_employee_id: string | null;
  delivery_employee_id: string | null;
  transport_mode: TransportMode;
  transport_number: string;
  origin: string;
  destination: string;
  goods_description: string | null;
  eta_date: string;
  eta_time: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ShipmentDetail extends Shipment {
  status_events: StatusEvent[];
  customer_ids: string[];
}

export interface ShipmentPermission {
  shipment_id: string;
  customer_user_id: string;
}

export interface LocationUpdate {
  id: string;
  shipment_id: string;
  employee_id: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface StatusEvent {
  id: string;
  shipment_id: string;
  label: string;
  description: string;
  timestamp: string;
  is_completed: boolean;
}

export interface Company {
  id: string;
  name: string;
  contact_phone: string;
}
