"""Backend intelligence services: sparse matrices, spectral radar, AI tightening."""

from app.intelligence.matrices import build_matrices, compute_margins, cohort_pool, depth_rows
from app.intelligence.spectral import analyze, conflict_graph
from app.intelligence.tightener import run_tightener, apply_move, apply_moves

__all__ = [
    "build_matrices", "compute_margins", "cohort_pool", "depth_rows",
    "analyze", "conflict_graph",
    "run_tightener", "apply_move", "apply_moves",
]
