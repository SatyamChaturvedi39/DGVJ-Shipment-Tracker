import axios from 'axios';
import { Config } from '@/constants/config';
import { getIdToken } from './auth';
import type { User, UserRole, Shipment, ShipmentDetail, ShipmentPhase, StatusEvent, LocationUpdate } from '@/types';

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await getIdToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('[API] Could not get auth token:', e);
  }
  return config;
});

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  const { data } = await api.get('/users/me');
  return data;
}

export async function updateMe(payload: { name?: string; company_name?: string }): Promise<User> {
  const { data } = await api.put('/users/me', payload);
  return data;
}

export async function getEmployees(): Promise<User[]> {
  const { data } = await api.get('/users/employees');
  return data ?? [];
}

export async function getCustomers(): Promise<User[]> {
  const { data } = await api.get('/users/customers');
  return data ?? [];
}

export async function getAllUsers(): Promise<User[]> {
  const { data } = await api.get('/users');
  return data ?? [];
}

export async function createUser(payload: {
  name: string;
  phone: string;
  role: UserRole;
  company_name?: string;
  pin?: string;
}): Promise<User> {
  const { data } = await api.post('/users', payload);
  return data;
}

export async function updateUser(
  id: string,
  payload: { name?: string; role?: UserRole; company_name?: string; is_active?: boolean; pin?: string }
): Promise<User> {
  const { data } = await api.put(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

// ─── Shipments ───────────────────────────────────────────────────────────────

export interface CreateShipmentPayload {
  origin: string;
  destination: string;
  transport_mode: 'train' | 'air';
  transport_number: string;
  goods_description?: string;
  pickup_employee_id?: string;
  delivery_employee_id?: string;
  eta_date?: string;
  eta_time?: string;
  notes?: string;
  customer_ids: string[];
}

export async function getShipments(): Promise<Shipment[]> {
  const { data } = await api.get('/shipments');
  return data ?? [];
}

export async function getShipment(id: string): Promise<ShipmentDetail> {
  const { data } = await api.get(`/shipments/${id}`);
  return data;
}

export async function createShipment(payload: CreateShipmentPayload): Promise<Shipment> {
  const { data } = await api.post('/shipments', payload);
  return data;
}

export async function updateShipment(
  id: string,
  payload: Partial<CreateShipmentPayload> & { tracking_id?: string }
): Promise<Shipment> {
  const { data } = await api.put(`/shipments/${id}`, payload);
  return data;
}

export async function deleteShipment(id: string): Promise<void> {
  await api.delete(`/shipments/${id}`);
}

// ─── Tracking ────────────────────────────────────────────────────────────────

export async function transitionPhase(
  shipmentId: string,
  phase: ShipmentPhase
): Promise<{ phase: ShipmentPhase }> {
  const { data } = await api.put(`/shipments/${shipmentId}/phase`, { phase });
  return data;
}

export async function addStatusEvent(
  shipmentId: string,
  payload: { label: string; description?: string }
): Promise<StatusEvent> {
  const { data } = await api.post(`/shipments/${shipmentId}/status-event`, payload);
  return data;
}

// ─── Location ────────────────────────────────────────────────────────────────

export async function updateLocation(payload: {
  shipment_id: string;
  lat: number;
  lng: number;
}): Promise<void> {
  await api.post('/location/update', payload);
}

export async function getLatestLocation(shipmentId: string): Promise<LocationUpdate | null> {
  const { data } = await api.get(`/location/${shipmentId}/latest`);
  return data;
}

export default api;
