"""ScheduleGod AI — backend entry point.

Agentic scheduling co-pilot:
    text/voice request -> Muse Spark constraint parsing -> OR-Tools solve
    -> schedule or infeasibility report -> self-healing agent loop.

Skeleton only; built during the Meta Global AI Developer Hackathon.
"""

from fastapi import FastAPI

app = FastAPI(title="ScheduleGod AI", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "schedulegod-ai-backend"}
