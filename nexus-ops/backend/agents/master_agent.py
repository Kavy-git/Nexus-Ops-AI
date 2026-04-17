"""
Master Agent (Planner)
──────────────────────
Priority chain:
  1. Groq API (FREE — llama-3.1-8b-instant, no credit card needed)
  2. Smart rule-based NLP parser  — works with ZERO API key
  3. Validated safe default        — absolute last resort

After planning:
  - JSON schema validation  (rejects malformed plans)
  - Dependency cycle detection (prevents deadlocks)
  - Parameter sanitisation + safe defaults applied
"""

import json
import os
import re
from typing import Optional

PLAN_SCHEMA_REQUIRED_TOOLS = {"create_storage", "allocate_compute", "deploy_service"}

GROQ_SYSTEM_PROMPT = """You are NEXUS OPS Master Agent, an expert cloud infrastructure planner.

Parse the natural language infrastructure request and return ONLY a valid JSON execution plan.
No markdown, no explanation text, no code fences — raw JSON only.

AVAILABLE TOOLS:
- create_storage    → Creates S3 bucket
- allocate_compute  → Provisions EC2 instance
- deploy_service    → Deploys Docker container

STRICT RULES:
1. Each step maps to exactly ONE tool
2. deploy_service ALWAYS depends on BOTH create_storage AND allocate_compute
3. create_storage and allocate_compute have NO dependencies (run in parallel)
4. Return ONLY raw JSON — no text before or after

OUTPUT FORMAT:
{
  "service_name": "<service-name-kebab-case>",
  "environment": "<production|staging|development>",
  "steps": [
    {
      "step_id": 1,
      "tool": "create_storage",
      "description": "Create S3 bucket for <service> <env>",
      "params": {
        "bucket_name": "<service>-<env>-bucket",
        "region": "us-east-1",
        "access_level": "private"
      },
      "depends_on": []
    },
    {
      "step_id": 2,
      "tool": "allocate_compute",
      "description": "Provision EC2 instance for <service>",
      "params": {
        "instance_type": "t2.medium",
        "cpu": 2,
        "memory_gb": 4,
        "region": "us-east-1"
      },
      "depends_on": []
    },
    {
      "step_id": 3,
      "tool": "deploy_service",
      "description": "Deploy <service> container",
      "params": {
        "service_name": "<service>",
        "image": "<service>:latest",
        "port": 8080,
        "env_vars": {}
      },
      "depends_on": [1, 2]
    }
  ]
}"""


async def plan(ticket_text: str) -> dict:
    """
    Parse ticket → return a validated execution plan dict.
    Never raises — always returns a usable plan.
    """
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_key and not groq_key.startswith("gsk_your"):
        result = await _plan_with_groq(ticket_text, groq_key)
        if result:
            validated = _validate_and_sanitise(result)
            if validated:
                print("[Planner] Using Groq LLM plan")
                return validated

    print("[Planner] Using rule-based plan (no API key or Groq failed)")
    return _rule_based_plan(ticket_text)


# ── Groq planner (free tier) ──────────────────────────────────────────────

async def _plan_with_groq(ticket_text: str, api_key: str) -> Optional[dict]:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                        {"role": "user",   "content": f"Create execution plan for: {ticket_text}"}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 900,
                }
            )
            if resp.status_code != 200:
                print(f"[Groq] HTTP {resp.status_code}")
                return None
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```\s*$", "", raw, flags=re.MULTILINE)
            return json.loads(raw.strip())
    except Exception as e:
        print(f"[Groq] Failed: {e}")
        return None


# ── Rule-based planner (ZERO API key needed) ──────────────────────────────

def _rule_based_plan(ticket_text: str) -> dict:
    text = ticket_text.lower()

    # Service name
    service_name = "service"
    for pat in [
        r'for\s+(?:our\s+|the\s+)?([a-z][a-z0-9\-_]+(?:[-\s]?(?:api|service|app|pipeline|backend))?)',
        r'deploy\s+([a-z][a-z0-9\-_]+)',
        r'([a-z][a-z0-9]+)-(?:api|service|app|backend)',
    ]:
        m = re.search(pat, text)
        if m:
            raw = m.group(1).strip().replace(" ", "-").lower()
            STOP = {"a","an","the","our","my","this","that","new","production","staging","development","docker","container"}
            if raw not in STOP and 2 <= len(raw) <= 40:
                service_name = raw
                break
    service_name = re.sub(r'[^a-z0-9\-]', '', service_name).strip('-') or "nexus-service"

    # Environment
    env = "production" if any(w in text for w in ["production"," prod "]) \
          else "staging" if "staging" in text \
          else "development"

    # Port
    port = 8080
    pm = re.search(r'\bport\s+(\d{2,5})\b', text) or re.search(r'\b(\d{4,5})\b', text)
    if pm:
        pv = int(pm.group(1))
        if 80 <= pv <= 65535:
            port = pv

    # Instance type
    instance_type = "t2.medium"
    im = re.search(r'\b(t[23]\.(nano|micro|small|medium|large|xlarge))\b', text)
    if im:
        instance_type = im.group(1)
    elif any(w in text for w in ["large","heavy","high"]):
        instance_type = "t2.large"
    elif any(w in text for w in ["small","light","mini"]):
        instance_type = "t2.small"

    # CPU / memory
    cpu_m = re.search(r'(\d+)\s*v?cpu', text)
    mem_m = re.search(r'(\d+)\s*gb', text)
    cpu = min(int(cpu_m.group(1)), 16) if cpu_m else 2
    memory_gb = min(int(mem_m.group(1)), 64) if mem_m else 4

    # Region
    region = "us-east-1"
    rm = re.search(r'\b(us-east-[12]|us-west-[12]|eu-west-[123]|ap-south-1)\b', text)
    if rm:
        region = rm.group(1)

    # Docker image
    image = f"{service_name}:latest"
    img_m = re.search(r'\b([a-z][a-z0-9\-_]+:[a-z0-9][a-z0-9\.\-]*)\b', text)
    if img_m and len(img_m.group(1)) <= 60:
        image = img_m.group(1)

    env_short = {"production":"prod","staging":"stg","development":"dev"}.get(env,"dev")
    bucket = f"{service_name}-{env_short}-bucket"

    return {
        "service_name": service_name,
        "environment": env,
        "_planner": "rule-based",
        "steps": [
            {
                "step_id": 1, "tool": "create_storage",
                "description": f"Create S3 bucket for {service_name} {env}",
                "params": {"bucket_name": bucket, "region": region, "access_level": "private"},
                "depends_on": []
            },
            {
                "step_id": 2, "tool": "allocate_compute",
                "description": f"Provision {instance_type} for {service_name}",
                "params": {"instance_type": instance_type, "cpu": cpu, "memory_gb": memory_gb, "region": region},
                "depends_on": []
            },
            {
                "step_id": 3, "tool": "deploy_service",
                "description": f"Deploy {service_name} on port {port}",
                "params": {"service_name": service_name, "image": image, "port": port, "env_vars": {"ENV": env}},
                "depends_on": [1, 2]
            }
        ]
    }


# ── Validation ────────────────────────────────────────────────────────────

def _validate_and_sanitise(plan_data: dict) -> Optional[dict]:
    """Schema check + cycle detection + param sanitisation."""
    # Basic structure
    if not isinstance(plan_data, dict):
        return None
    if "steps" not in plan_data or not isinstance(plan_data["steps"], list):
        return None
    if len(plan_data["steps"]) < 1 or len(plan_data["steps"]) > 10:
        return None

    steps = plan_data["steps"]
    step_ids = set()

    for s in steps:
        if not isinstance(s, dict):
            return None
        if s.get("tool") not in PLAN_SCHEMA_REQUIRED_TOOLS:
            return None
        sid = s.get("step_id")
        if not isinstance(sid, int) or sid < 1:
            return None
        if sid in step_ids:
            return None  # Duplicate step IDs
        step_ids.add(sid)

    # Validate depends_on references
    for s in steps:
        for dep in s.get("depends_on", []):
            if dep not in step_ids:
                return None
            if dep == s["step_id"]:
                return None  # Self-dependency

    # Cycle detection (Kahn's algorithm)
    in_deg = {s["step_id"]: 0 for s in steps}
    adj = {s["step_id"]: [] for s in steps}
    for s in steps:
        for dep in s.get("depends_on", []):
            adj[dep].append(s["step_id"])
            in_deg[s["step_id"]] += 1

    queue = [k for k, v in in_deg.items() if v == 0]
    visited = 0
    while queue:
        node = queue.pop(0)
        visited += 1
        for nb in adj.get(node, []):
            in_deg[nb] -= 1
            if in_deg[nb] == 0:
                queue.append(nb)

    if visited != len(steps):
        return None  # Cycle detected

    # Sanitise string params
    STRIP_PATTERN = re.compile(r'[<>;\|&`$\'"\\]')
    for s in steps:
        for k, v in list(s.get("params", {}).items()):
            if isinstance(v, str):
                v = STRIP_PATTERN.sub('', v).strip()[:128]
                s["params"][k] = v

    # Normalise environment
    env_map = {"prod": "production", "dev": "development", "stg": "staging"}
    raw_env = plan_data.get("environment", "development")
    plan_data["environment"] = env_map.get(raw_env, raw_env)

    return plan_data
