import json
import os
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from dependencies import require_role
from database import supabase

router = APIRouter(prefix="/ai", tags=["ai"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL = "llama-3.3-70b-versatile"

def _get_client() -> OpenAI:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI features not configured. Add GROQ_API_KEY to environment variables.")
    return OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")


# ─── Models ───────────────────────────────────────────────────────────────────

class ShipmentContext(BaseModel):
    tracking_id: str
    origin: str
    destination: str
    current_phase: str
    transport_mode: str

class GenerateStatusRequest(BaseModel):
    shipment_context: ShipmentContext
    admin_note: str

class AskRequest(BaseModel):
    question: str
    history: list[dict] = []


# ─── Tool definitions for Llama 3.1 ──────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_active_shipments",
            "description": "Get all currently active (non-completed) shipments with their phase, route, and ETA",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_delayed_shipments",
            "description": "Get shipments that are past their ETA date and have not been delivered yet",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shipment_detail",
            "description": "Get full details of a specific shipment by tracking ID",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_id": {
                        "type": "string",
                        "description": "The shipment tracking ID (e.g. DGVJ-ABC12345)",
                    }
                },
                "required": ["tracking_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_employee_performance",
            "description": "Get delivery statistics for all employees — how many pickups and deliveries each has completed",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_operations_summary",
            "description": "Get a high-level summary: total active shipments, completed today, delayed, and count per phase",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


# ─── Tool execution ───────────────────────────────────────────────────────────

def _execute_tool(name: str, args: dict) -> dict:
    today = date.today().isoformat()

    if name == "get_active_shipments":
        result = (
            supabase.table("shipments")
            .select("tracking_id,current_phase,origin,destination,eta_date,transport_mode,transport_number")
            .neq("current_phase", "completed")
            .order("created_at", desc=True)
            .limit(15)
            .execute()
        )
        return {"active_shipments": result.data, "count": len(result.data)}

    if name == "get_delayed_shipments":
        result = (
            supabase.table("shipments")
            .select("tracking_id,current_phase,origin,destination,eta_date,transport_mode")
            .neq("current_phase", "completed")
            .lt("eta_date", today)
            .execute()
        )
        return {"delayed_shipments": result.data, "count": len(result.data)}

    if name == "get_shipment_detail":
        tracking_id = args.get("tracking_id", "")
        result = supabase.table("shipments").select("*").eq("tracking_id", tracking_id).execute()
        if not result.data:
            return {"error": f"Shipment {tracking_id} not found"}
        shipment = result.data[0]
        events = (
            supabase.table("status_events")
            .select("label,is_completed,sort_order")
            .eq("shipment_id", shipment["id"])
            .order("sort_order")
            .execute()
        )
        shipment["status_events"] = events.data
        return {"shipment": shipment}

    if name == "get_employee_performance":
        users = (
            supabase.table("users")
            .select("id,name")
            .eq("role", "employee")
            .eq("is_active", True)
            .execute()
        )
        stats = []
        for emp in (users.data or []):
            pickup_count = (
                supabase.table("shipments")
                .select("id", count="exact")
                .eq("pickup_employee_id", emp["id"])
                .eq("current_phase", "completed")
                .execute()
            ).count or 0
            delivery_count = (
                supabase.table("shipments")
                .select("id", count="exact")
                .eq("delivery_employee_id", emp["id"])
                .eq("current_phase", "completed")
                .execute()
            ).count or 0
            stats.append({
                "name": emp["name"],
                "completed_pickups": pickup_count,
                "completed_deliveries": delivery_count,
            })
        return {"employees": stats}

    if name == "get_operations_summary":
        all_active = (
            supabase.table("shipments")
            .select("current_phase,eta_date,completed_at")
            .execute()
        )
        rows = all_active.data or []
        by_phase: dict = {}
        completed_today = 0
        delayed = 0
        active = 0
        for s in rows:
            phase = s.get("current_phase", "")
            by_phase[phase] = by_phase.get(phase, 0) + 1
            if phase != "completed":
                active += 1
                eta = s.get("eta_date")
                if eta and eta < today:
                    delayed += 1
            elif s.get("completed_at", "")[:10] == today:
                completed_today += 1
        return {
            "total_shipments": len(rows),
            "active": active,
            "completed_today": completed_today,
            "delayed": delayed,
            "by_phase": by_phase,
        }

    return {"error": f"Unknown tool: {name}"}


# ─── Endpoint 1 — Generate professional status update ────────────────────────

@router.post("/generate-status")
def generate_status(body: GenerateStatusRequest, _user: dict = Depends(require_role("admin"))):
    client = _get_client()
    ctx = body.shipment_context

    phase_labels = {
        "pickup": "awaiting pickup",
        "transit": "in transit to carrier",
        "handed_to_carrier": "with the carrier",
        "out_for_delivery": "out for delivery",
        "completed": "delivered",
    }
    phase_label = phase_labels.get(ctx.current_phase, ctx.current_phase)

    prompt = f"""You are a professional logistics coordinator for Digvijay Express, a B2B courier in Bengaluru, India.

Shipment details:
- Tracking ID: {ctx.tracking_id}
- Route: {ctx.origin} → {ctx.destination}
- Transport: {ctx.transport_mode}
- Current phase: {phase_label}

Admin's note: "{body.admin_note}"

Generate a professional, customer-facing status update. Respond with ONLY valid JSON in this exact format:
{{"label": "<concise title under 60 characters>", "description": "<1-2 sentence update, professional and reassuring tone>"}}"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=200,
        )
        text = response.choices[0].message.content or ""
        # Extract JSON from response
        start = text.find("{")
        end = text.rfind("}") + 1
        parsed = json.loads(text[start:end])
        return {"label": str(parsed.get("label", ""))[:80], "description": str(parsed.get("description", ""))}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI generation failed: {str(e)}")


# ─── Endpoint 2 — AI Operations Copilot (agentic tool use) ───────────────────

COPILOT_SYSTEM = """You are Digi, a friendly operations assistant for Digvijay Express, a logistics company in Bengaluru that ships goods across India by air and train.
You help the branch manager stay on top of their daily operations. Always respond in plain, simple business language — no technical terms, no database field names, no jargon.

How to translate data into plain language:
- current_phase values: "pickup" = "Awaiting Pickup", "transit" = "In Transit to Carrier", "handed_to_carrier" = "With the Carrier", "out_for_delivery" = "Out for Delivery", "completed" = "Delivered"
- eta_date = "expected delivery date"
- transport_mode = "shipped by air" or "shipped by train"
- transport_number = "flight number" or "train number"
- tracking_id = "shipment number"
- Never say "pickup_employee_id", "delivery_employee_id", "current_phase", "eta_date", or any other field name

How to write your responses:
- Use short bullet points or short paragraphs — easy to read at a glance
- Lead with the most important number or fact
- When listing shipments, show: shipment number, route (origin → destination), current status, and expected delivery date
- Round numbers and keep it simple — "3 shipments" not "3 records returned"
- If there is no data, say so warmly and suggest what the manager can do
- Always be warm, clear, and helpful — you are talking to a busy branch manager, not a developer"""

@router.post("/ask")
def ask_copilot(body: AskRequest, _user: dict = Depends(require_role("admin"))):
    client = _get_client()

    messages = [{"role": "system", "content": COPILOT_SYSTEM}]
    # Include conversation history (trim to last 6 turns to stay within context)
    for entry in body.history[-6:]:
        if entry.get("role") in ("user", "assistant"):
            messages.append({"role": entry["role"], "content": entry["content"]})
    messages.append({"role": "user", "content": body.question})

    tools_used: list[str] = []
    max_iterations = 5  # Safety cap to prevent infinite loops

    try:
        for _ in range(max_iterations):
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.2,
                max_tokens=1000,
            )
            msg = response.choices[0].message

            if not msg.tool_calls:
                return {"answer": msg.content or "I couldn't find an answer to that.", "tools_used": tools_used}

            # Append assistant message with tool calls
            messages.append(msg)

            # Execute each tool call and append results
            for call in msg.tool_calls:
                fn_name = call.function.name
                try:
                    fn_args = json.loads(call.function.arguments or "{}")
                except json.JSONDecodeError:
                    fn_args = {}

                if fn_name not in tools_used:
                    tools_used.append(fn_name)

                result = _execute_tool(fn_name, fn_args)
                messages.append({
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result, default=str),
                })

        # If we hit max iterations without a final answer
        return {"answer": "I reached my processing limit. Please try a more specific question.", "tools_used": tools_used}

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {str(e)}")
