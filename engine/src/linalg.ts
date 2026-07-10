/**
 * Tiny dense linear algebra for the active-learning selector. Matrices are
 * row-major Float64Arrays. Everything here runs on the ~28×28 information matrix,
 * so simple O(n^3) algorithms are far more than fast enough.
 */

/** Invert an n×n matrix via Gauss-Jordan elimination with partial pivoting. */
export function invert(A: Float64Array, n: number): Float64Array {
  const w = 2 * n;
  const M = new Float64Array(n * w);
  // augmented [A | I]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i * w + j] = A[i * n + j];
    M[i * w + n + i] = 1;
  }
  for (let col = 0; col < n; col++) {
    // partial pivot: largest-magnitude entry in this column
    let piv = col;
    let best = Math.abs(M[col * w + col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(M[r * w + col]);
      if (val > best) {
        best = val;
        piv = r;
      }
    }
    if (piv !== col) {
      for (let j = 0; j < w; j++) {
        const t = M[col * w + j];
        M[col * w + j] = M[piv * w + j];
        M[piv * w + j] = t;
      }
    }
    const inv = 1 / M[col * w + col];
    for (let j = 0; j < w; j++) M[col * w + j] *= inv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r * w + col];
      if (f === 0) continue;
      for (let j = 0; j < w; j++) M[r * w + j] -= f * M[col * w + j];
    }
  }
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) out[i * n + j] = M[i * w + n + j];
  return out;
}

/** Quadratic form dᵀ M d for an n×n row-major matrix M. */
export function quadForm(M: Float64Array, d: ArrayLike<number>, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    let row = 0;
    const base = i * n;
    for (let j = 0; j < n; j++) row += M[base + j] * d[j];
    total += d[i] * row;
  }
  return total;
}
