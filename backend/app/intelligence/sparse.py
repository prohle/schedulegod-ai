"""Sparse-matrix primitives: scipy.sparse CSR with string labels.

The intelligence layer stores every entity relationship — rooms x courses,
cohorts x courses, instructors x slots — as a scipy sparse matrix. At seed
scale a dense array would also fit, but the sparse contract is what keeps the
layer honest at department scale (hundreds of rooms/courses, mostly-empty
compatibility grids) and it is the wire format the frontend renders.

LabeledSparse is a thin wrapper that keeps row/column labels alongside a
scipy.sparse.csr_matrix. All algebra (sums, transposes, aggregations) happens
in scipy; labels are carried for reporting and API serialization only.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import scipy.sparse as sp


@dataclass
class LabeledSparse:
    """A scipy CSR matrix plus the labels that give its axes meaning."""

    matrix: sp.csr_matrix
    row_labels: list[str] = field(default_factory=list)
    col_labels: list[str] = field(default_factory=list)
    notes: str = ""

    @staticmethod
    def from_coo(
        shape: tuple[int, int],
        rows: list[int],
        cols: list[int],
        values: list[float],
        row_labels: list[str] | None = None,
        col_labels: list[str] | None = None,
        notes: str = "",
    ) -> LabeledSparse:
        """Build CSR from triplets. Duplicate (row, col) entries are summed
        (scipy semantics), which is exactly what demand aggregation wants."""
        m = sp.coo_matrix(
            (np.asarray(values, dtype=np.float64),
             (np.asarray(rows, dtype=np.int64), np.asarray(cols, dtype=np.int64))),
            shape=shape,
        ).tocsr()
        m.sort_indices()
        return LabeledSparse(m, row_labels or [], col_labels or [], notes)

    @property
    def shape(self) -> tuple[int, int]:
        return (int(self.matrix.shape[0]), int(self.matrix.shape[1]))

    @property
    def nnz(self) -> int:
        return int(self.matrix.nnz)

    @property
    def density(self) -> float:
        cells = self.matrix.shape[0] * self.matrix.shape[1]
        return round(self.nnz / cells, 4) if cells else 0.0

    def to_coo(self) -> tuple[list[int], list[int], list[float]]:
        m = self.matrix.tocoo()
        order = np.lexsort((m.col, m.row))  # deterministic row-major order
        return (m.row[order].tolist(), m.col[order].tolist(),
                [float(v) for v in m.data[order]])

    def row(self, i: int) -> tuple[np.ndarray, np.ndarray]:
        """(col_indices, values) of row i."""
        start, end = self.matrix.indptr[i], self.matrix.indptr[i + 1]
        return self.matrix.indices[start:end], self.matrix.data[start:end]

    def row_value(self, i: int, j: int) -> float:
        return float(self.matrix[i, j])

    def column_sums(self) -> np.ndarray:
        """Aggregate over the row axis (e.g., faculty -> department capacity)."""
        return np.asarray(self.matrix.sum(axis=0)).ravel()
