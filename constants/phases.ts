import type { ShipmentPhase } from '@/types';

export const PHASE_CONFIG: Record<ShipmentPhase, { label: string; bg: string; text: string }> = {
  pickup:            { label: 'Pickup',           bg: '#FFF8E1', text: '#F57F17' },
  transit:           { label: 'In Transit',        bg: '#E3F2FD', text: '#1565C0' },
  handed_to_carrier: { label: 'With Carrier',      bg: '#F3E5F5', text: '#6A1B9A' },
  out_for_delivery:  { label: 'Out for Delivery',  bg: '#FFF8E1', text: '#F57F17' },
  completed:         { label: 'Completed',         bg: '#E8F5E9', text: '#2E7D32' },
};

export const PHASE_BORDER: Record<ShipmentPhase, string> = {
  pickup:            '#F57F17',
  transit:           '#1565C0',
  handed_to_carrier: '#6A1B9A',
  out_for_delivery:  '#F57F17',
  completed:         '#2E7D32',
};

export const PHASE_ORDER: ShipmentPhase[] = [
  'pickup', 'transit', 'handed_to_carrier', 'out_for_delivery', 'completed',
];
