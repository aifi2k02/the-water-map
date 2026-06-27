(async function () {
  const [topo, dataByA3, num2a3] = await Promise.all([
    fetch("data/countries-110m.json").then((r) => r.json()),
    fetch("data/countries.json").then((r) => r.json()),
    fetch("data/num2a3.json").then((r) => r.json()),
  ]);

  const valueOf = (c) => (c && c.safe_pct != null ? c.safe_pct : c && c.basic_pct);

  // colour scale matches the Stitch legend exactly: pale -> primary -> deep navy
  const color = d3.scaleLinear().domain([0, 50, 100]).range(["#E3E9EF", "#0C6EA5", "#042C53"]).clamp(true);
  const NODATA = "#e7eaee";

  const fmt = d3.format(",");
  const abbr = (n) =>
    n == null ? "—"
    : n >= 1e9 ? (n / 1e9).toFixed(2) + "B"
    : n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
    : n >= 1e3 ? (n / 1e3).toFixed(0) + "K"
    : String(n);

  // ---------- headline stats (computed from the real data) ----------
  (function computeStats() {
    let wSum = 0, popSum = 0, w2000 = 0, pop2000 = 0, without = 0;
    Object.values(dataByA3).forEach((c) => {
      if (c.safe_pct != null && c.population) {
        wSum += c.safe_pct * c.population;
        popSum += c.population;
        without += (c.population * (100 - c.safe_pct)) / 100;
        const y2000 = c.trend.find((t) => t.year === 2000 && t.safe != null);
        if (y2000) { w2000 += y2000.safe * c.population; pop2000 += c.population; }
      }
    });
    document.getElementById("stat-global").textContent = popSum ? Math.round(wSum / popSum) + "%" : "—";
    document.getElementById("stat-2000").textContent = pop2000 ? Math.round(w2000 / pop2000) + "%" : "—";
    document.getElementById("stat-without").innerHTML =
      abbr(Math.round(without)) + '<span class="text-xs ml-1 font-normal opacity-70">people</span>';
  })();

  // ---------- map ----------
  const svg = d3.select("#map");
  const W = 980, H = 520;
  svg.attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g");

  const countries = topojson.feature(topo, topo.objects.countries).features;
  const projection = d3.geoNaturalEarth1().fitSize([W, H], { type: "Sphere" });
  const path = d3.geoPath(projection);
  const a3ForFeature = (f) => num2a3[String(+f.id)];

  const tooltip = document.getElementById("tooltip");
  let selectedNode = null;

  g.selectAll("path.country")
    .data(countries)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", (f) => {
      const v = valueOf(dataByA3[a3ForFeature(f)]);
      return v == null ? NODATA : color(v);
    })
    .on("mousemove", (event, f) => {
      const c = dataByA3[a3ForFeature(f)];
      const v = valueOf(c);
      let html = c
        ? `<b>${c.country}</b><br>${v == null ? "no data" : v + "% safely managed"}`
        : `<b>${(f.properties && f.properties.name) || "—"}</b><br>no data`;
      if (c && c.safe_pct != null) {
        const first = c.trend.find((t) => t.safe != null);
        if (first) {
          const d = Math.round(c.safe_pct - first.safe);
          if (d > 0) html += `<br><span class="t-since">+${d}% since ${first.year}</span>`;
        }
      }
      tooltip.innerHTML = html;
      tooltip.style.left = event.clientX + "px";
      tooltip.style.top = event.clientY + "px";
      tooltip.style.opacity = 1;
    })
    .on("mouseleave", () => (tooltip.style.opacity = 0))
    .on("click", (event, f) => {
      const c = dataByA3[a3ForFeature(f)];
      if (c) openPanel(c.code, event.currentTarget);
    });

  // zoom + pan
  const zoom = d3.zoom().scaleExtent([1, 8]).on("zoom", (e) => g.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  document.getElementById("zoom-in").addEventListener("click", () => svg.transition().duration(250).call(zoom.scaleBy, 1.5));
  document.getElementById("zoom-out").addEventListener("click", () => svg.transition().duration(250).call(zoom.scaleBy, 0.66));

  // ---------- compare list ----------
  const all = Object.values(dataByA3).sort((a, b) => a.country.localeCompare(b.country));
  const cmp = document.getElementById("compare");
  all.forEach((c) => cmp.appendChild(Object.assign(document.createElement("option"), { value: c.code, textContent: c.country })));

  // ---------- search autocomplete (custom; reliable on iOS) ----------
  const search = document.getElementById("search");
  const results = document.getElementById("search-results");
  const clearBtn = document.getElementById("search-clear");
  let activeIdx = -1;

  const labelFor = (c) => (c.safe_pct != null ? c.safe_pct + "%" : c.basic_pct != null ? c.basic_pct + "% basic" : "no data");

  function renderResults(q) {
    const query = q.trim().toLowerCase();
    clearBtn.classList.toggle("hidden", q.length === 0);
    if (!query) { hideResults(); return; }
    const starts = [], contains = [];
    for (const c of all) {
      const n = c.country.toLowerCase();
      if (n.startsWith(query)) starts.push(c);
      else if (n.includes(query)) contains.push(c);
    }
    const matches = starts.concat(contains).slice(0, 8);
    results.innerHTML = "";
    activeIdx = -1;
    if (!matches.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No country found";
      results.appendChild(li);
    } else {
      matches.forEach((c, i) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.dataset.code = c.code;
        li.innerHTML = `<span>${c.country}</span><span class="val">${labelFor(c)}</span>`;
        li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(c.code); });
        results.appendChild(li);
      });
    }
    results.hidden = false;
    search.setAttribute("aria-expanded", "true");
  }

  function hideResults() {
    results.hidden = true;
    results.innerHTML = "";
    activeIdx = -1;
    search.setAttribute("aria-expanded", "false");
  }

  function choose(code) {
    search.value = "";
    clearBtn.classList.add("hidden");
    hideResults();
    search.blur();
    openPanel(code);
  }

  function moveActive(delta) {
    const items = [...results.querySelectorAll('li[role="option"]')];
    if (!items.length) return;
    if (activeIdx >= 0) items[activeIdx].classList.remove("active");
    activeIdx = (activeIdx + delta + items.length) % items.length;
    items[activeIdx].classList.add("active");
    items[activeIdx].scrollIntoView({ block: "nearest" });
  }

  search.addEventListener("input", () => renderResults(search.value));
  search.addEventListener("focus", () => { if (search.value.trim()) renderResults(search.value); });
  search.addEventListener("keydown", (e) => {
    const items = [...results.querySelectorAll('li[role="option"]')];
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const pick = activeIdx >= 0 ? items[activeIdx] : items[0];
      if (pick) choose(pick.dataset.code);
    } else if (e.key === "Escape") { hideResults(); }
  });
  clearBtn.addEventListener("click", () => { search.value = ""; hideResults(); clearBtn.classList.add("hidden"); search.focus(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search-results") && e.target !== search) hideResults(); });

  // ---------- panel ----------
  const panel = document.getElementById("panel");
  const scrim = document.getElementById("scrim");
  let currentCode = null;

  function selectMap(code, node) {
    if (selectedNode) selectedNode.classList.remove("selected");
    if (!node) node = g.selectAll("path.country").nodes().find((n) => a3ForFeature(d3.select(n).datum()) === code);
    if (node) { node.classList.add("selected"); selectedNode = node; }
  }

  // glass fill animation, with the % counting up in sync + a settling ripple
  const gWater = document.getElementById("p-water");
  const gSurface = document.getElementById("p-surface");
  const gNum = document.getElementById("p-num");
  const G = { yTop: 54, yBot: 326, span: 272, halfBot: 54, halfTop: 70 };

  function fillGlass(target) {
    if (target == null) {
      gWater.setAttribute("y", 330); gWater.setAttribute("height", 20);
      gSurface.setAttribute("cy", 330); gSurface.setAttribute("ry", 7);
      gNum.textContent = "—";
      return;
    }
    const f = target / 100, dur = 1000, start = performance.now();
    (function tick(now) {
      const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3), cur = f * e;
      const level = G.yBot - cur * G.span;
      gWater.setAttribute("y", level);
      gWater.setAttribute("height", G.yBot - level + 26);
      const half = G.halfBot + cur * (G.halfTop - G.halfBot);
      gSurface.setAttribute("cy", level);
      gSurface.setAttribute("rx", Math.max(8, half - 2));
      gSurface.setAttribute("ry", 7 - cur * 1.5);
      gNum.textContent = (target * e).toFixed(1);
      if (t < 1) requestAnimationFrame(tick);
      else { gNum.textContent = String(target); rippleSurface(level); }
    })(performance.now());
  }

  function rippleSurface(level) {
    const start = performance.now(), dur = 700;
    (function r(now) {
      const t = (now - start) / dur;
      if (t >= 1) { gSurface.setAttribute("ry", 5.5); return; }
      gSurface.setAttribute("ry", 5.5 + 4 * (1 - t) * Math.sin(t * 18));
      requestAnimationFrame(r);
    })(performance.now());
  }

  function openPanel(code, node) {
    const c = dataByA3[code];
    if (!c) return;
    currentCode = code;
    selectMap(code, node);

    document.getElementById("p-name").textContent = c.country;
    const safe = c.safe_pct;
    const shown = safe != null ? safe : c.basic_pct;
    document.getElementById("p-biglabel").textContent =
      safe != null ? "safely managed drinking water" : "at least basic drinking water";
    document.getElementById("p-sub").textContent =
      safe != null ? "Share of population with safely managed water" : "No “safely managed” figure reported — showing basic access";

    fillGlass(shown);
    document.getElementById("p-pct").textContent = "%";

    document.getElementById("p-basic").textContent = c.basic_pct != null ? c.basic_pct + "%" : "—";
    document.getElementById("p-pop").textContent = abbr(c.population);
    document.getElementById("p-pop-full").textContent = c.population != null ? fmt(c.population) : "";
    const without = c.population != null && shown != null ? Math.round((c.population * (100 - shown)) / 100) : null;
    document.getElementById("p-without").textContent = abbr(without);
    document.getElementById("p-year").textContent = c.safe_year || c.basic_year || "—";

    drawTrend(c, null);
    cmp.value = "";
    document.getElementById("key-compare").style.display = "none";

    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    scrim.classList.add("open");
  }

  function closePanel() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    scrim.classList.remove("open");
    if (selectedNode) { selectedNode.classList.remove("selected"); selectedNode = null; }
    currentCode = null;
  }
  document.getElementById("close").addEventListener("click", closePanel);
  scrim.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  // ---------- trend chart ----------
  function drawTrend(c, compareC) {
    const cw = 360, ch = 180, m = { t: 14, r: 12, b: 24, l: 30 };
    const t = d3.select("#trend");
    t.selectAll("*").remove();
    const years = c.trend.map((d) => d.year);
    const x = d3.scaleLinear().domain(d3.extent(years)).range([m.l, cw - m.r]);
    const y = d3.scaleLinear().domain([0, 100]).range([ch - m.b, m.t]);

    [0, 50, 100].forEach((v) => {
      t.append("line").attr("x1", m.l).attr("x2", cw - m.r).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "#eef1f4");
      t.append("text").attr("x", m.l - 6).attr("y", y(v) + 3).attr("text-anchor", "end").attr("font-size", 10).attr("fill", "#9aa7b3").text(v);
    });
    [years[0], years[years.length - 1]].forEach((yr) => {
      t.append("text").attr("x", x(yr)).attr("y", ch - 8).attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#9aa7b3").text(yr);
    });

    const line = (key) => d3.line().defined((d) => d[key] != null).x((d) => x(d.year)).y((d) => y(d[key]));
    function plot(series, key, stroke, width) {
      const p = t.append("path").datum(series).attr("fill", "none").attr("stroke", stroke).attr("stroke-width", width).attr("stroke-linecap", "round").attr("d", line(key));
      const len = p.node().getTotalLength();
      p.attr("stroke-dasharray", len).attr("stroke-dashoffset", len).transition().duration(750).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
    }
    plot(c.trend, "basic", "#92ccff", 1.8);
    plot(c.trend, "safe", "#0C6EA5", 2.6);
    if (compareC) plot(compareC.trend, "safe", "#C98A2B", 2.2);
  }

  cmp.addEventListener("change", () => {
    if (!currentCode) return;
    const other = cmp.value ? dataByA3[cmp.value] : null;
    drawTrend(dataByA3[currentCode], other);
    const key = document.getElementById("key-compare");
    if (other) { key.style.display = ""; document.getElementById("key-compare-name").textContent = other.country; }
    else key.style.display = "none";
  });
})();
