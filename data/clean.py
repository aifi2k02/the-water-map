"""Merge OWID/JMP water data + World Bank population into one tidy JSON.

Outputs data/clean/countries.json:
[
  {
    "code": "KEN", "country": "Kenya",
    "safe_pct": 32.1, "safe_year": 2022,
    "basic_pct": 68.9, "basic_year": 2022,
    "population": 55339000, "population_year": 2023,
    "trend": [ {"year": 2000, "safe": 25.0, "basic": 50.0}, ... ]
  }, ...
]
"""
import csv, json, os, re

RAW = os.path.join(os.path.dirname(__file__), "raw")
OUT = os.path.join(os.path.dirname(__file__), "clean")
os.makedirs(OUT, exist_ok=True)

ISO3 = re.compile(r"^[A-Z]{3}$")  # real countries; excludes OWID_* aggregates


def read_series(fname, valcol):
    """Return {code: {"name": str, "by_year": {year: value}}}."""
    out = {}
    with open(os.path.join(RAW, fname), newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        valkey = [c for c in r.fieldnames if c not in ("entity", "code", "year")][0]
        f.seek(0)
        r = csv.DictReader(f)
        for row in r:
            code = (row.get("code") or "").strip()
            if not ISO3.match(code):
                continue
            try:
                year = int(row["year"])
                val = float(row[valkey])
            except (ValueError, TypeError):
                continue
            d = out.setdefault(code, {"name": row["entity"], "by_year": {}})
            d["by_year"][year] = val
    return out


def latest(by_year):
    if not by_year:
        return None, None
    y = max(by_year)
    return round(by_year[y], 1), y


safe = read_series("safe_water.csv", "wat_sm__residence_total")
basic = read_series("basic_water.csv", "wat_basal__residence_total")
pop = read_series("population.csv", "population_historical")

codes = sorted(set(safe) | set(basic))
countries = []
for code in codes:
    name = (safe.get(code) or basic.get(code))["name"]
    safe_by = safe.get(code, {}).get("by_year", {})
    basic_by = basic.get(code, {}).get("by_year", {})
    pop_by = pop.get(code, {}).get("by_year", {})

    safe_pct, safe_year = latest(safe_by)
    basic_pct, basic_year = latest(basic_by)
    population, pop_year = latest(pop_by)

    years = sorted(set(safe_by) | set(basic_by))
    trend = [
        {
            "year": y,
            "safe": round(safe_by[y], 1) if y in safe_by else None,
            "basic": round(basic_by[y], 1) if y in basic_by else None,
        }
        for y in years
    ]

    countries.append({
        "code": code,
        "country": name,
        "safe_pct": safe_pct,
        "safe_year": safe_year,
        "basic_pct": basic_pct,
        "basic_year": basic_year,
        "population": int(population) if population else None,
        "population_year": pop_year,
        "trend": trend,
    })

with open(os.path.join(OUT, "countries.json"), "w", encoding="utf-8") as f:
    json.dump(countries, f, ensure_ascii=False, indent=1)

with_safe = sum(1 for c in countries if c["safe_pct"] is not None)
with_basic = sum(1 for c in countries if c["basic_pct"] is not None)
print(f"countries: {len(countries)}")
print(f"  with safe-water value: {with_safe}")
print(f"  with basic-water value: {with_basic}")
print(f"  output: {os.path.join(OUT, 'countries.json')}")
print("  sample:", json.dumps(
    {k: v for k, v in countries[0].items() if k != "trend"}, ensure_ascii=False))
