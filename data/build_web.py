"""Prepare data files the website loads:
- site/data/countries.json   (the clean country data, indexed by alpha-3)
- site/data/num2a3.json      ({ "404": "KEN", ... } numeric id -> alpha-3)
The world map (TopoJSON) uses numeric country ids; our data uses alpha-3.
"""
import csv, json, os

HERE = os.path.dirname(__file__)
clean = json.load(open(os.path.join(HERE, "clean", "countries.json"), encoding="utf-8"))

# index data by alpha-3 for quick lookup in the browser
by_a3 = {c["code"]: c for c in clean}
json.dump(by_a3, open(os.path.join(HERE, "..", "site", "data", "countries.json"), "w",
                      encoding="utf-8"), ensure_ascii=False)

# numeric ISO id -> alpha-3 (strip leading zeros so "004" -> "4" to match TopoJSON ids)
num2a3 = {}
with open(os.path.join(HERE, "raw", "iso.csv"), newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        num = str(int(row["country-code"]))
        num2a3[num] = row["alpha-3"]
json.dump(num2a3, open(os.path.join(HERE, "..", "site", "data", "num2a3.json"), "w",
                       encoding="utf-8"), ensure_ascii=False)

print(f"countries in web data: {len(by_a3)}")
print(f"numeric->alpha3 entries: {len(num2a3)}")
