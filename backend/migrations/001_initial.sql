-- Digvijay BLR — Initial Schema
-- Paste this entire file into Supabase SQL Editor and click Run

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'customer')),
  company_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL,
  current_phase TEXT NOT NULL DEFAULT 'pickup'
    CHECK (current_phase IN ('pickup', 'transit', 'delivery', 'completed')),
  transport_mode TEXT CHECK (transport_mode IN ('train', 'air')),
  transport_number TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  goods_description TEXT,
  pickup_employee_id UUID REFERENCES users(id),
  delivery_employee_id UUID REFERENCES users(id),
  eta_date DATE,
  eta_time TIME,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS shipment_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  customer_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(shipment_id, customer_user_id)
);

CREATE TABLE IF NOT EXISTS status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_shipments_phase ON shipments(current_phase);
CREATE INDEX IF NOT EXISTS idx_shipments_pickup_emp ON shipments(pickup_employee_id);
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_emp ON shipments(delivery_employee_id);
CREATE INDEX IF NOT EXISTS idx_permissions_customer ON shipment_permissions(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_shipment ON shipment_permissions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_status_events_shipment ON status_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_location_shipment ON location_updates(shipment_id);
CREATE INDEX IF NOT EXISTS idx_location_created ON location_updates(created_at DESC);
