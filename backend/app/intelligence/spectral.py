"""Spectral radar over the section-conflict graph.

Graph: nodes = sections. Edges = "cannot share the timetable":
- hard (weight 1.0, kind=cohort): some cohort needs BOTH sections this term
  (the C7 pairs) AND the pair can actually overlap in time — an MWF and a TTh
  section never do (disjoint day sets), mirroring the solver's own C7 logic;
- soft (weight 0.5, kind=instructor): the sections' qualified-instructor pools
  intersect and the patterns can overlap, so one person may end up teaching
  both (C17 potential).

What the spectrum buys us, before CP-SAT even starts:

- connected components (hard subgraph) -> independent scheduling islands; a
  component of size 1 is a free section; islands can be probed in parallel
- algebraic connectivity mu_2 (Laplacian) -> how tightly the largest island is
  coupled: small mu_2 = loose (one bad placement ripples slowly), large mu_2 =
  a rigid core where every slot choice constrains everything else — the
  deadlock-prone region
- Fiedler vector -> spectral ordering of sections (warm-start ordering) and a
  2-way partition of the largest component (the natural split the solver
  should respect)
- Hoffman bound (adjacency spectrum) -> chromatic lower bound: if the conflict
  graph needs more colors than the pattern band has period slots, the
  timetable is structurally infeasible — a deadlock named pre-solve
- max clique (exact Bron-Kerbosch at department scale) -> sections that all
  pairwise conflict; a same-pattern clique larger than the 4-period band is a
  guaranteed deadlock

Deterministic by construction: nodes sorted, eigensolver on a fixed symmetric
matrix, Fiedler sign pinned, every iteration over sorted orders.
"""

from __future__ import annotations

import numpy as np
import scipy.sparse as sp
from scipy.sparse.csgraph import connected_components

from app.models.intelligence import GraphEdge, SpectralReport
from app.models.scenario import BLOCK_DAYS, PATTERN_DAYS, Scenario

HARD_WEIGHT = 1.0
SOFT_WEIGHT = 0.5
PERIODS = 4  # MWF/TTh band size; weekly blocks choose a day among BLOCK_DAYS


def _patterns_overlap(pa: str, pb: str) -> bool:
    """Can the two meeting patterns ever collide in (day, period)?"""
    if pa == "block" or pb == "block":
        return True  # blocks cover periods 2-3 on days 1-3, others meet MWF/TTh
    return bool(set(PATTERN_DAYS[pa]) & set(PATTERN_DAYS[pb]))


def conflict_graph(scenario: Scenario) -> tuple[list[str], list[GraphEdge], sp.csr_matrix]:
    """Nodes (sorted section ids), typed edges, weighted adjacency matrix."""
    nodes = sorted(s.id for s in scenario.sections)
    ix = {s: i for i, s in enumerate(nodes)}
    pattern = {s.id: scenario.course(s.course_id).pattern for s in scenario.sections}
    qual = {i.id: set(i.qualified_courses) for i in scenario.instructors}

    edges: list[GraphEdge] = []
    hard: set[tuple[str, str]] = set()
    # hard: same-cohort demanded pairs (C7), only if they can truly collide
    for sa, sb in scenario.demanded_section_pairs():
        key = tuple(sorted((sa.id, sb.id)))
        if key in hard or not _patterns_overlap(pattern[key[0]], pattern[key[1]]):
            continue
        hard.add(key)
        edges.append(GraphEdge(u=key[0], v=key[1], weight=HARD_WEIGHT, kind="cohort"))
    # soft: qualified-instructor pool intersection (potential C17 clash)
    for i, u in enumerate(nodes):
        for v in nodes[i + 1:]:
            if (u, v) in hard or not _patterns_overlap(pattern[u], pattern[v]):
                continue
            cu, cv = scenario.section_by_id(u).course_id, scenario.section_by_id(v).course_id
            if any(cu in q and cv in q for q in qual.values()):
                edges.append(GraphEdge(u=u, v=v, weight=SOFT_WEIGHT, kind="instructor"))

    n = len(nodes)
    adj = np.zeros((n, n), dtype=np.float64)
    for e in edges:
        adj[ix[e.u], ix[e.v]] = adj[ix[e.v], ix[e.u]] = e.weight
    return nodes, edges, sp.csr_matrix(adj)


def _max_clique(adj: np.ndarray) -> list[int]:
    """Exact Bron-Kerbosch with pivoting (deterministic order) up to 32 nodes,
    greedy beyond. Returns indices into adj."""
    n = len(adj)
    if n > 32:
        order = sorted(range(n), key=lambda v: (-int(adj[v].sum()), v))
        clique: list[int] = []
        for v in order:
            if all(adj[v][u] for u in clique):
                clique.append(v)
        return sorted(clique)

    best: list[int] = []

    def bk(r: list[int], p: list[int], x: list[int]) -> None:
        nonlocal best
        if not p and not x:
            if len(r) > len(best):
                best = list(r)
            return
        if len(r) + len(p) <= len(best):
            return
        pivot = max(p + x, key=lambda u: (sum(1 for w in p if adj[u][w]), -u))
        for v in [w for w in p if not adj[pivot][w]]:
            bk(r + [v], [w for w in p if adj[v][w]], [w for w in x if adj[v][w]])
            p.remove(v)
            x.append(v)

    bk([], list(range(n)), [])
    return best


def _welsh_powell(order: list[int], adj: np.ndarray) -> dict[int, int]:
    """Greedy coloring in the given node order (smallest feasible color)."""
    color: dict[int, int] = {}
    for v in order:
        used = {color[u] for u in order if u in color and adj[v][u]}
        color[v] = next(k for k in range(len(order)) if k not in used)
    return color


def analyze(scenario: Scenario) -> SpectralReport:
    nodes, edges, adj_sp = conflict_graph(scenario)
    ix = {s: i for i, s in enumerate(nodes)}
    pattern = {s.id: scenario.course(s.course_id).pattern for s in scenario.sections}
    adj = adj_sp.toarray()

    warnings: list[str] = []

    # --- islands: connected components of the HARD subgraph ------------------
    hard_only = np.where(adj >= HARD_WEIGHT, adj, 0.0)
    n_comp, labels = connected_components(sp.csr_matrix(hard_only), directed=False)
    comps: dict[int, list[int]] = {}
    for i, lab in enumerate(labels):
        comps.setdefault(int(lab), []).append(i)
    ordered = sorted(comps.values(), key=lambda c: (-len(c), nodes[c[0]]))
    components = [[nodes[i] for i in sorted(c)] for c in ordered]
    for c in components:
        if len(c) == 1:
            warnings.append(
                f"{c[0]} is a free section (no cohort time-conflicts) — schedulable anywhere.")

    # --- spectrum of the largest island (where the tension lives) ------------
    main = ordered[0]
    sub = adj[np.ix_(main, main)]
    lap = np.diag(sub.sum(axis=1)) - sub
    eigvals, eigvecs = np.linalg.eigh(lap)  # symmetric => ascending, deterministic
    fiedler = eigvecs[:, 1] if len(main) > 1 else np.zeros(len(main))
    anchor = int(np.argmax(np.abs(fiedler)))
    if fiedler[anchor] < 0:
        fiedler = -fiedler  # pin the sign: largest-magnitude entry positive
    algebraic = float(max(0.0, eigvals[1])) if len(main) > 1 else 0.0

    # Hoffman chromatic lower bound from the adjacency spectrum
    a_eigs = np.linalg.eigvalsh(sub)
    lam_max, lam_min = float(a_eigs[-1]), float(a_eigs[0])
    hoffman = 1.0 if lam_max <= 0 else (
        2.0 if lam_min >= -1e-12 else 1.0 + lam_max / abs(lam_min))

    # --- clique + structural deadlock rules ----------------------------------
    clique_ix = _max_clique((sub > 0).astype(int))
    clique_nodes = [nodes[main[i]] for i in clique_ix]
    if len(clique_nodes) > 1:
        pats = {pattern[s] for s in clique_nodes}
        if pats == {"block"} and len(clique_nodes) > len(BLOCK_DAYS):
            warnings.append(
                f"Structural deadlock: block sections {'; '.join(clique_nodes)} all "
                f"conflict, but only {len(BLOCK_DAYS)} block days exist.")
        elif pats <= {"MWF", "TTh"} and len(pats) == 1 and len(clique_nodes) > PERIODS:
            warnings.append(
                f"Structural deadlock: {len(clique_nodes)} mutually-conflicting "
                f"{pats.pop()} sections ({', '.join(clique_nodes)}) need more slots "
                f"than the {PERIODS} periods the pattern band has.")

    # --- spectral ordering, partition, coloring hints -------------------------
    main_order = [nodes[main[i]] for i in np.argsort(fiedler, kind="stable")]
    fiedler_rank = {s: k for k, s in enumerate(main_order)}
    partition_a = sorted(nodes[main[i]] for i in range(len(main)) if fiedler[i] >= 0)
    partition_b = sorted(nodes[main[i]] for i in range(len(main)) if fiedler[i] < 0)

    slot_hints: dict[str, int] = {}
    for comp in ordered:
        band = [i for i in comp if pattern[nodes[i]] in PATTERN_DAYS]
        if not band:
            continue
        b_adj = np.zeros((len(band), len(band)), dtype=np.float64)
        for a_pos, a in enumerate(band):
            for b_pos, b in enumerate(band):
                if a != b and adj[a, b] >= HARD_WEIGHT:
                    b_adj[a_pos, b_pos] = 1.0
        order = sorted(range(len(band)), key=lambda p: (
            -int(b_adj[p].sum()), fiedler_rank.get(nodes[band[p]], len(nodes)),
            nodes[band[p]]))
        coloring = _welsh_powell(order, b_adj)
        for pos, c in coloring.items():
            node = nodes[band[pos]]
            if c >= PERIODS:
                warnings.append(
                    f"Band pressure: {node} would need slot #{c + 1} — more "
                    f"mutually-conflicting sections than the {PERIODS} periods available.")
            elif b_adj[pos].sum() >= 1:  # hint only edge-participating sections
                slot_hints[node] = c

    return SpectralReport(
        node_labels=nodes,
        edges=edges,
        laplacian_eigenvalues=[round(float(v), 6) for v in eigvals],
        algebraic_connectivity=round(algebraic, 6),
        largest_laplacian_eigenvalue=round(float(eigvals[-1]), 6),
        hoffman_chromatic_lower_bound=round(hoffman, 3),
        max_clique=clique_nodes,
        fiedler_vector=[round(float(v), 6) for v in fiedler],
        spectral_order=main_order,
        components=components,
        spectral_partition=(partition_a, partition_b),
        deadlock_warnings=warnings,
        slot_hints=slot_hints,
    )
