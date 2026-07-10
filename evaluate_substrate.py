"""
Stage 1b: evaluate substrate weighting schemes.

The v1 artifact z-scores every axis equally, which (a) lets the 16-axis work-style
block dominate the 6-axis interest block, and (b) inflates near-constant style axes
(Dependability, Attention to Detail, ...) into full-weight axes, producing occasional
nonsense outliers in neighbor/ranking lists.

Rather than guess a fix, we score candidate weightings against an OUT-OF-MODEL metric:
"neighbor purity" = for each job, what fraction of its top-K cosine neighbors share the
job's SOC major group (2-digit). Higher = more coherent neighborhoods = fewer nonsense
outliers. (Random baseline ~ 1/23 = 4.3%.) We also report the finer minor-group (4-char)
purity for sensitivity.

Usage: python evaluate_substrate.py
"""

import sqlite3
import numpy as np
import build_taste_vectors as bt

NEAR_CONSTANT = {
    "Dependability",
    "Attention to Detail",
    "Integrity",
    "Cooperation",
}


def neighbor_purity(X, groups, k=5):
    """Mean fraction of each row's top-k cosine neighbors sharing its group label."""
    Xn = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-12)
    n = X.shape[0]
    total = 0.0
    # chunk to keep memory sane, though 873x873 is trivial
    S = Xn @ Xn.T
    np.fill_diagonal(S, -np.inf)
    g = np.array(groups)
    for i in range(n):
        nn = np.argpartition(-S[i], k)[:k]
        total += np.mean(g[nn] == g[i])
    return total / n


def main():
    conn = sqlite3.connect("onet.db")
    codes, titles, descs, raw, dropped = bt.load_raw(conn)
    blocks = [b for (_, _, _, _, b) in bt.AXES]
    labels = [l for (_, _, _, l, _) in bt.AXES]
    n, d = raw.shape

    major = [c[:2] for c in codes]
    minor = [c[:4] for c in codes]

    # base z-score
    mean = raw.mean(axis=0)
    std = raw.std(axis=0)
    z = (raw - mean) / np.where(std < 1e-9, 1.0, std)

    block_idx = {}
    for j, b in enumerate(blocks):
        block_idx.setdefault(b, []).append(j)

    def block_balanced(emphasis=None):
        """Per-axis weight so each block contributes equal total variance (1/sqrt(n))."""
        w = np.ones(d)
        for b, idxs in block_idx.items():
            bw = 1.0 / np.sqrt(len(idxs))
            for j in idxs:
                w[j] = bw
        if emphasis:
            for b, idxs in block_idx.items():
                for j in idxs:
                    w[j] *= emphasis.get(b, 1.0)
        return w

    def trim(base_w):
        w = base_w.copy()
        for j, l in enumerate(labels):
            if l in NEAR_CONSTANT:
                w[j] = 0.0
        return w

    schemes = {
        "S0 equal z-score (v1)": np.ones(d),
        "S1 block-balanced": block_balanced(),
        "S2 block-bal + interest 1.5x": block_balanced({"interest": 1.5}),
        "S3 block-bal + interest 2.0x": block_balanced({"interest": 2.0}),
        "S4 block-bal + trim near-const": trim(block_balanced()),
        "S5 block-bal + int1.5 + trim": trim(block_balanced({"interest": 1.5})),
    }

    print(f"{n} jobs, {d} axes. Random-baseline major purity ~ {1/23*100:.1f}%\n")
    print(f"{'scheme':34s}  {'major@5':>8s}  {'minor@5':>8s}")
    print("-" * 56)
    weighted = {}
    for name, w in schemes.items():
        X = z * w
        weighted[name] = X
        pm = neighbor_purity(X, major, k=5) * 100
        pn = neighbor_purity(X, minor, k=5) * 100
        print(f"{name:34s}  {pm:7.1f}%  {pn:7.1f}%")

    # probe: show neighbors for jobs that were noisy before, best scheme vs v1
    def neighbors(X, title, k=5):
        Xn = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-12)
        i = titles.index(title)
        sims = Xn @ Xn[i]
        sims[i] = -np.inf
        order = np.argsort(-sims)[:k]
        return [titles[j] for j in order]

    probes = ["Poets, Lyricists and Creative Writers", "Registered Nurses", "Carpenters"]
    print("\nNeighbor comparison (v1 vs block-bal+int1.5+trim):")
    for t in probes:
        print(f"\n  {t}")
        print("    S0:", ", ".join(neighbors(weighted["S0 equal z-score (v1)"], t)))
        print("    S5:", ", ".join(neighbors(weighted["S5 block-bal + int1.5 + trim"], t)))

    conn.close()


if __name__ == "__main__":
    main()
