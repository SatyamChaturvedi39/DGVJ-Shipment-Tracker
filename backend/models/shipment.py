from pydantic import BaseModel
from typing import Optional, Literal


class ShipmentBase(BaseModel):
    tracking_id: str
    transport_mode: Literal["train", "air"]
    transport_number: str
    origin: str
    destination: str
    eta_date: str
    eta_time: str
    notes: Optional[str] = None


class ShipmentCreate(ShipmentBase):
    pickup_employee_id: Optional[str] = None
    delivery_employee_id: Optional[str] = None


class ShipmentResponse(ShipmentBase):
    id: str
    status: str
    current_phase: Literal["pickup", "transit", "delivery", "completed"]
    pickup_employee_id: Optional[str] = None
    delivery_employee_id: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
