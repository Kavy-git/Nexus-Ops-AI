"""
State management using Redis.
Every task is a JSON blob keyed by task_id.
WebSocket subscribers get pushed updates in real-time via pub/sub.
"""

import json
import uuid
from datetime import datetime
from typing import Optional
import redis.asyncio as aioredis
import os

_redis: Optional[aioredis.Redis] = None


async def init_redis():
    global _redis
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    _redis = aioredis.from_url(url, decode_responses=True)


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        await init_redis()
    return _redis


def new_task_id() -> str:
    return f"TK-{str(uuid.uuid4())[:8].upper()}"


async def create_task(ticket_text: str) -> dict:
    task_id = new_task_id()
    task = {
        "task_id": task_id,
        "ticket": ticket_text,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "steps": [],
        "final_report": None,
        "error": None,
        "total_duration_ms": None,
    }
    r = await get_redis()
    await r.set(f"task:{task_id}", json.dumps(task))
    return task


async def get_task(task_id: str) -> Optional[dict]:
    r = await get_redis()
    raw = await r.get(f"task:{task_id}")
    return json.loads(raw) if raw else None


async def update_task(task_id: str, updates: dict):
    """Merge updates into task and broadcast via pub/sub."""
    r = await get_redis()
    raw = await r.get(f"task:{task_id}")
    if not raw:
        return
    task = json.loads(raw)
    task.update(updates)
    await r.set(f"task:{task_id}", json.dumps(task))
    await r.publish(f"task_updates:{task_id}", json.dumps(task))


async def add_step(task_id: str, step: dict):
    """Add or update a step in the task's step list, then broadcast."""
    r = await get_redis()
    raw = await r.get(f"task:{task_id}")
    if not raw:
        return
    task = json.loads(raw)
    steps = task.get("steps", [])
    idx = next((i for i, s in enumerate(steps) if s["step_id"] == step["step_id"]), None)
    if idx is not None:
        steps[idx] = step
    else:
        steps.append(step)
    task["steps"] = steps
    await r.set(f"task:{task_id}", json.dumps(task))
    await r.publish(f"task_updates:{task_id}", json.dumps(task))


async def list_tasks() -> list:
    r = await get_redis()
    keys = await r.keys("task:*")
    tasks = []
    for k in sorted(keys, reverse=True)[:20]:
        raw = await r.get(k)
        if raw:
            tasks.append(json.loads(raw))
    return tasks
