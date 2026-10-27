import os

# --- Meta Model API ---------------------------------------------------------
# OpenAI-compatible endpoint. Auth: https://dev.meta.ai dashboard -> API keys.
MUSE_BASE_URL = os.getenv("MUSE_BASE_URL", "https://api.meta.ai/v1")
MUSE_API_KEY = os.getenv("MODEL_API_KEY")

# Contributor mode = same model, lower price; content may train future Meta
# models. Fine for synthetic demo data. For a real hospital deployment, switch
# to "muse-spark-1.3" (Standard mode) so no staff data ever trains Meta models.
MUSE_MODEL = os.getenv("MUSE_MODEL", "muse-spark-1.3-contributor")

# Parsing is not a deep-reasoning task; low effort keeps token spend down.
MUSE_REASONING_EFFORT = os.getenv("MUSE_REASONING_EFFORT", "low")

# --- Data --------------------------------------------------------------------
SEED_SCENARIO_PATH = os.path.join(os.path.dirname(__file__), "data", "seed_scenario.json")

SOLVER_TIME_LIMIT_S = float(os.getenv("SOLVER_TIME_LIMIT_S", "10"))
