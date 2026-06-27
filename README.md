# The Water Map

An interactive world map of access to **safe drinking water**, country by country — an
improved take on the data-visualization idea behind [emptyglassproject.com](https://emptyglassproject.com/).

Click any country to see the share of its population with safely managed drinking water, how many
people that leaves without safe water, and how the figure has changed since 2000. You can search by
name and compare two countries.

**Live site:** _(added after first deploy)_

## How it works

This is a static site — no build step. It's plain HTML + [Tailwind](https://tailwindcss.com/) (via CDN)
and [D3](https://d3js.org/) for the map and charts. That makes it fast and trivial to host on
Cloudflare Pages.

```
site/                 ← the website (this is what gets published)
  index.html          ← the map
  about.html          ← about + data sources
  css/styles.css
  js/app.js           ← map, panel, charts (D3 + topojson)
  data/
    countries.json    ← cleaned per-country water + population data (keyed by ISO alpha-3)
    countries-110m.json ← world map shapes (TopoJSON)
    num2a3.json       ← ISO numeric → alpha-3 lookup for joining shapes to data
data/                 ← data pipeline (not published)
  clean.py            ← merges raw sources into data/clean/countries.json
  build_web.py        ← prepares the files the site loads
  raw/                ← downloaded source CSVs
server.js             ← tiny local dev server (node server.js → http://localhost:4188)
```

## Data sources

- Water access: [WHO/UNICEF Joint Monitoring Programme (JMP)](https://washdata.org/), values to 2024
- Population: [World Bank](https://data.worldbank.org/)
- Standardised via [Our World in Data](https://ourworldindata.org/water-access)

Global figures shown on the map are computed (population-weighted) over the countries that report
safely managed water — about 72% of the world's population; some countries, including China, don't
report this measure.

## Run locally

```bash
node server.js     # then open http://localhost:4188
```

## Refresh the data

```bash
python3 data/clean.py      # rebuild data/clean/countries.json from data/raw/*.csv
python3 data/build_web.py  # copy into site/data/ for the website
```

Not affiliated with WHO, UNICEF, or the World Bank. Map shapes © Natural Earth.
