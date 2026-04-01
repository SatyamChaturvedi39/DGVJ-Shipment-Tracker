# WebSocket handler for real-time GPS location streaming.
# Will be implemented in Phase 2.
#
# Planned endpoints:
#   ws://host/ws/location/{shipment_id}
#     - Employee sends: { lat, lng, timestamp }
#     - Customer receives: live location updates during pickup/delivery phases
