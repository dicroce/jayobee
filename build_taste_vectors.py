"""
Stage 1 ETL: build the interpretable "taste" vector matrix for jayobee.

Reads onet.db, pulls the 28 canonical taste axes (RIASEC interests + work values
+ work styles), z-scores each axis across occupations, and emits a static JSON
artifact for the TypeScript runtime to consume.

Also prints diagnostics so we can gut-check the space before building the engine:
  - coverage (how many occupations survive the complete-data filter)
  - per-axis mean/std (catch degenerate near-constant axes)
  - nearest-neighbor sanity for a few well-known jobs
  - PCA: explained variance + top loadings on PC1/PC2 (do People-Things /
    Data-Ideas emerge?)

Usage:  python build_taste_vectors.py
Output: data/taste_vectors.json
"""

import sqlite3
import json
import os
import math
import numpy as np

from load_wages import load_wages

DB = "onet.db"
OUT = os.path.join("data", "taste_vectors.json")

# Axis definitions, in fixed output order. Each entry: (element_id, table, scale, label, block)
# The label disambiguates the two "Independence" elements (a value and a style).
AXES = [
    # RIASEC interests (scale OI)
    ("1.B.1.a", "interests", "OI", "Realistic",       "interest"),
    ("1.B.1.b", "interests", "OI", "Investigative",   "interest"),
    ("1.B.1.c", "interests", "OI", "Artistic",        "interest"),
    ("1.B.1.d", "interests", "OI", "Social",          "interest"),
    ("1.B.1.e", "interests", "OI", "Enterprising",    "interest"),
    ("1.B.1.f", "interests", "OI", "Conventional",    "interest"),
    # Work values (scale EX)
    ("1.B.2.a", "work_values", "EX", "Achievement",         "value"),
    ("1.B.2.b", "work_values", "EX", "Working Conditions",  "value"),
    ("1.B.2.c", "work_values", "EX", "Recognition",         "value"),
    ("1.B.2.d", "work_values", "EX", "Relationships",       "value"),
    ("1.B.2.e", "work_values", "EX", "Support",             "value"),
    ("1.B.2.f", "work_values", "EX", "Independence (Value)","value"),
    # Work styles (scale IM)
    ("1.C.1.a", "work_styles", "IM", "Achievement/Effort",        "style"),
    ("1.C.1.b", "work_styles", "IM", "Persistence",              "style"),
    ("1.C.1.c", "work_styles", "IM", "Initiative",               "style"),
    ("1.C.2.b", "work_styles", "IM", "Leadership",               "style"),
    ("1.C.3.a", "work_styles", "IM", "Cooperation",              "style"),
    ("1.C.3.b", "work_styles", "IM", "Concern for Others",       "style"),
    ("1.C.3.c", "work_styles", "IM", "Social Orientation",       "style"),
    ("1.C.4.a", "work_styles", "IM", "Self-Control",             "style"),
    ("1.C.4.b", "work_styles", "IM", "Stress Tolerance",         "style"),
    ("1.C.4.c", "work_styles", "IM", "Adaptability/Flexibility", "style"),
    ("1.C.5.a", "work_styles", "IM", "Dependability",            "style"),
    ("1.C.5.b", "work_styles", "IM", "Attention to Detail",      "style"),
    ("1.C.5.c", "work_styles", "IM", "Integrity",               "style"),
    ("1.C.6",   "work_styles", "IM", "Independence (Style)",     "style"),
    ("1.C.7.a", "work_styles", "IM", "Innovation",               "style"),
    ("1.C.7.b", "work_styles", "IM", "Analytical Thinking",      "style"),
]

# After z-scoring, axes are reweighted so the three blocks are balanced (each
# contributes equal variance via 1/sqrt(n_axes_in_block)) with interests emphasized
# — RIASEC is the strongest vocational discriminator and, unweighted, the 16-axis
# style block would swamp the 6-axis interest block. Chosen by evaluate_substrate.py:
# lifts neighbor-purity (vs SOC major group) from 44.6% -> 47.1% and tightens rankings.
INTEREST_EMPHASIS = 1.5

SAMPLE_TITLES = [
    "Software Developers",
    "Registered Nurses",
    "Chief Executives",
    "Carpenters",
    "Actors",
    "Accountants and Auditors",
]


def load_raw(conn):
    """Return (codes, titles, descs, raw_matrix) over occupations with COMPLETE data."""
    # occupation metadata
    meta = {}
    for code, title, desc in conn.execute(
        "SELECT onetsoc_code, title, description FROM occupation_data"
    ):
        meta[code] = (title, desc)

    # pull each axis's values keyed by occupation code
    # values[code][axis_index] = data_value
    values = {code: {} for code in meta}
    for j, (eid, table, scale, label, block) in enumerate(AXES):
        q = f'SELECT onetsoc_code, data_value FROM "{table}" WHERE element_id=? AND scale_id=?'
        for code, val in conn.execute(q, (eid, scale)):
            if code in values:
                values[code][j] = val

    # keep only occupations that have all 28 axes
    codes, titles, descs, rows = [], [], [], []
    dropped = 0
    for code in sorted(meta):
        row = values[code]
        if len(row) == len(AXES):
            codes.append(code)
            titles.append(meta[code][0])
            descs.append(meta[code][1])
            rows.append([row[j] for j in range(len(AXES))])
        else:
            dropped += 1
    return codes, titles, descs, np.array(rows, dtype=np.float64), dropped


def zscore(mat):
    mean = mat.mean(axis=0)
    std = mat.std(axis=0)
    std_safe = np.where(std < 1e-9, 1.0, std)  # guard degenerate axes
    return (mat - mean) / std_safe, mean, std


def axis_weights():
    """Per-axis multipliers: block-balanced (1/sqrt(n_block)) with interests emphasized."""
    blocks = [b for (_, _, _, _, b) in AXES]
    counts = {b: blocks.count(b) for b in set(blocks)}
    w = np.array([1.0 / math.sqrt(counts[b]) for b in blocks])
    for j, b in enumerate(blocks):
        if b == "interest":
            w[j] *= INTEREST_EMPHASIS
    return w


def nearest(zmat, i, k=5):
    """Cosine nearest neighbors of row i (z-scored space)."""
    v = zmat[i]
    # cosine similarity
    norms = np.linalg.norm(zmat, axis=1)
    sims = (zmat @ v) / (norms * np.linalg.norm(v) + 1e-12)
    order = np.argsort(-sims)
    return [(j, sims[j]) for j in order if j != i][:k]


def main():
    conn = sqlite3.connect(DB)
    codes, titles, descs, raw, dropped = load_raw(conn)
    n, d = raw.shape
    print(f"Occupations kept: {n}  (dropped {dropped} for incomplete data)")
    print(f"Axes: {d}")

    zmat, mean, std = zscore(raw)
    zmat = zmat * axis_weights()  # block-balance + interest emphasis

    # optional salary join (BLS OEWS, by 6-digit SOC = first 7 chars of onetsoc_code)
    wages = load_wages()
    def wage_for(code):
        w = wages.get(code[:7])
        if not w:
            return None
        return {"median": w["median"], "p10": w["p10"], "p90": w["p90"]}
    wage_hits = sum(1 for c in codes if wages.get(c[:7]))
    if wages:
        print(f"Salary: matched {wage_hits}/{n} occupations from OEWS ({len(wages)} SOC codes loaded)")
    else:
        print("Salary: no data/oes_national.xlsx found — skipping wages (jobs get wage=null)")

    # --- diagnostic 1: per-axis mean/std (native units) ---
    print("\nPer-axis native mean / std (spot degenerate axes):")
    for j, (eid, table, scale, label, block) in enumerate(AXES):
        flag = "  <-- LOW VARIANCE" if std[j] < 0.15 else ""
        print(f"  {label:26s} [{block:8s}] mean={mean[j]:5.2f} std={std[j]:4.2f}{flag}")

    # --- diagnostic 2: nearest-neighbor sanity ---
    title_to_idx = {t: i for i, t in enumerate(titles)}
    print("\nNearest-neighbor sanity check (cosine, z-scored space):")
    for t in SAMPLE_TITLES:
        if t not in title_to_idx:
            print(f"  [{t}] not found")
            continue
        i = title_to_idx[t]
        neigh = nearest(zmat, i, k=5)
        print(f"  {t}:")
        for j, s in neigh:
            print(f"       {s:0.3f}  {titles[j]}")

    # --- diagnostic 3: PCA (via SVD) explained variance + top loadings ---
    U, S, Vt = np.linalg.svd(zmat - zmat.mean(axis=0), full_matrices=False)
    var = (S ** 2)
    evr = var / var.sum()
    print("\nPCA explained-variance ratio (first 6):")
    print("   " + ", ".join(f"PC{k+1}={evr[k]*100:4.1f}%" for k in range(6)))
    for pc in range(2):
        load = Vt[pc]
        order = np.argsort(-np.abs(load))
        print(f"\nPC{pc+1} top loadings:")
        for j in order[:8]:
            print(f"   {load[j]:+0.2f}  {AXES[j][3]}")

    # --- emit artifact ---
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    artifact = {
        "meta": {
            "source": "O*NET (onet.db)",
            "n_jobs": n,
            "n_axes": d,
            "normalization": (
                f"z-score per axis, then block-balanced (1/sqrt n_block) "
                f"with interests x{INTEREST_EMPHASIS}"
            ),
        },
        "axes": [
            {"name": label, "block": block} for (_, _, _, label, block) in AXES
        ],
        "jobs": [
            {
                "code": codes[i],
                "title": titles[i],
                "desc": descs[i],
                "v": [round(float(x), 4) for x in zmat[i]],
                "wage": wage_for(codes[i]),
            }
            for i in range(n)
        ],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(artifact, f, ensure_ascii=False)
    size_kb = os.path.getsize(OUT) / 1024
    print(f"\nWrote {OUT}  ({size_kb:.0f} KB, {n} jobs x {d} axes)")

    conn.close()


if __name__ == "__main__":
    main()
