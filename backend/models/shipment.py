from pydantic import BaseModel
from typing import Optional, Literal, List


class CreateShipmentRequest(BaseModel):
    origin: str
    destination: str
    transport_mode: Literal["train", "air"]
    transport_number: str
    goods_description: Optional[str] = None
    pickup_employee_id: Optional[str] = None
    delivery_employee_id: Optional[str] = None
    eta_date: Optional[str] = None   # ISO date string: "2026-04-10"
    eta_time: Optional[str] = None   # Time string: "14:30"
    notes: Optional[str] = None
    customer_ids: List[str] = []     # user IDs to grant access


class UpdateShipmentRequest(BaseModel):
    tracking_id: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    transport_mode: Optional[Literal["train", "air"]] = None
    transport_number: Optional[str] = None
    goods_description: Optional[str] = None
    pickup_employee_id: Optional[str] = None
    delivery_employee_id: Optional[str] = None
    eta_date: Optional[str] = None
    eta_time: Optional[str] = None
    notes: Optional[str] = None
    customer_ids: Optional[List[str]] = None


class PhaseTransitionRequest(BaseModel):
    phase: Literal["pickup", "transit", "handed_to_carrier", "out_for_delivery", "completed"]


class AddStatusEventRequest(BaseModel):
    label: str
    description: Optional[str] = None


class LocationUpdateRequest(BaseModel):
    shipment_id: str
    lat: float
    lng: float
