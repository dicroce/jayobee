"""
Parse the BLS OEWS national occupational wage file into a { SOC -> wages } dict,
so the ETL can attach salary to each occupation by SOC code.

Expects the official national XLSX at data/oes_national.xlsx (download from
https://www.bls.gov/oes/tables.htm -> latest year -> National -> XLSX, unzip,
and copy the national_M20XX_dl.xlsx here). Wages are BLS OEWS, public domain.

Salary is a *display/filter* field, NOT a taste axis — it never enters the
preference vector (people don't "prefer" a wage the way they prefer a work style).
"""

import os
import glob
import openpyxl


def _find_wage_file():
    """Locate the OEWS national xlsx by any of its common names in data/."""
    candidates = [os.path.join("data", "oes_national.xlsx")]
    candidates += sorted(glob.glob(os.path.join("data", "national_M*_dl.xlsx")), reverse=True)
    return next((p for p in candidates if os.path.exists(p)), candidates[0])


DEFAULT_PATH = _find_wage_file()


def _num(v):
    """BLS wage cell -> float or None. '*' = not available; '#' = top-coded (>= $239,200/yr)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "").replace("$", "")
    if s in ("", "*", "**", "N/A"):
        return None
    if s == "#":  # annual wage top-code floor
        return 239200.0
    try:
        return float(s)
    except ValueError:
        return None


def load_wages(path=DEFAULT_PATH):
    """Return { '15-1252': {'median':..., 'p10':..., 'p90':..., 'mean':...}, ... } or {} if no file."""
    if not os.path.exists(path):
        return {}

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip().upper() if h is not None else "" for h in next(rows)]
    idx = {name: i for i, name in enumerate(header)}

    def col(*names):
        for n in names:
            if n in idx:
                return idx[n]
        return None

    c_occ = col("OCC_CODE")
    c_grp = col("O_GROUP", "OCC_GROUP")  # 'detailed' rows are the 6-digit SOC occupations
    c_med = col("A_MEDIAN")
    c_p10 = col("A_PCT10")
    c_p90 = col("A_PCT90")
    c_mean = col("A_MEAN")
    if c_occ is None or c_med is None:
        raise ValueError(f"Unexpected OEWS columns: {header[:12]}")

    wages = {}
    for row in rows:
        soc = row[c_occ]
        if not soc:
            continue
        if c_grp is not None and row[c_grp] is not None:
            if str(row[c_grp]).strip().lower() != "detailed":
                continue
        median = _num(row[c_med])
        if median is None:
            continue
        wages[str(soc).strip()] = {
            "median": median,
            "p10": _num(row[c_p10]) if c_p10 is not None else None,
            "p90": _num(row[c_p90]) if c_p90 is not None else None,
            "mean": _num(row[c_mean]) if c_mean is not None else None,
        }
    wb.close()
    return wages
