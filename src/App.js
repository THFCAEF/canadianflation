import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
  BarChart, Bar,
} from "recharts";

// ── Favicon: red dollar sign ─────────────────────────────────────────────────
(function setFavicon() {
  if (typeof document === "undefined") return;
  document.title = "Canadianflation — Canadian CPI Tracker";
  try {
    const sz = 64, cv = document.createElement("canvas");
    cv.width = cv.height = sz;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#E05A4A";
    ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 32, 34);
    const ico = document.querySelector("link[rel~='icon']") || document.createElement("link");
    ico.rel = "icon"; ico.href = cv.toDataURL();
    if (!ico.parentNode) document.head.appendChild(ico);
  } catch(e) {
    const ico = document.querySelector("link[rel~='icon']") || document.createElement("link");
    ico.rel = "icon"; ico.type = "image/svg+xml";
    ico.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%23E05A4A'/%3E%3Ctext x='32' y='46' font-size='42' font-weight='bold' text-anchor='middle' font-family='Arial' fill='%23fff'%3E%24%3C/text%3E%3C/svg%3E";
    if (!ico.parentNode) document.head.appendChild(ico);
  }
  [
    { property: "og:title",       content: "Canadianflation — Canadian CPI Tracker" },
    { property: "og:description", content: "Track Canadian inflation in real time. Live CPI data by category and province, sourced directly from Statistics Canada and the Bank of Canada." },
    { property: "og:image",       content: "https://www.canadianflation.ca/social-preview.png" },
    { property: "og:url",         content: "https://www.canadianflation.ca" },
    { name: "twitter:card",       content: "summary_large_image" },
  ].forEach(attrs => {
    const sel = attrs.property ? `meta[property="${attrs.property}"]` : `meta[name="${attrs.name}"]`;
    const el = document.querySelector(sel) || document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (!el.parentNode) document.head.appendChild(el);
  });
  // Remove PWA manifest link to prevent "Install app" prompt
  document.querySelectorAll("link[rel='manifest']").forEach(el => el.remove());
})();

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  bg:            "#000000",
  surface:       "#0F0F0F",
  surface2:      "#1A1A1A",
  border:        "#222222",
  border2:       "#2E2E2E",
  textPrimary:   "#F5F5F5",
  textSecondary: "#888888",
  textMuted:     "#444444",
  red:           "#E05A4A",
  redBg:         "rgba(224,90,74,0.13)",
  yellow:        "#F5C842",
  yellowBg:      "rgba(245,200,66,0.12)",
  green:         "#3ECFA0",
  greenBg:       "rgba(62,207,160,0.11)",
  blue:          "#6B9FE4",
  blueBg:        "rgba(107,159,228,0.12)",
  purple:        "#B07FE8",
  white:         "#F5F5F5",
};

function valColor(v) { return v > 2 ? C.red : v > 0 ? C.yellow : C.green; }
function valBg(v)    { return v > 2 ? C.redBg : v > 0 ? C.yellowBg : C.greenBg; }
function cumColor(v) { return v > 50 ? C.red : v > 20 ? C.yellow : C.green; }
function cumBg(v)    { return v > 50 ? C.redBg : v > 20 ? C.yellowBg : C.greenBg; }

// ── StatCan vector IDs — table 18-10-0004-01 ─────────────────────────────────
// All categories and provinces from the SAME table → snapshot list and chart
// always show the same source. "Recreation & Education" (v41691170) covers
// recreation, education, and reading as StatCan groups them.
const CAT_VECTORS = {
  "Food":                   41690974,
  "Shelter":                41691050,
  "Household":              41691067,
  "Clothing":               41691108,
  "Transport":              41691128,
  "Health":                 41691153,
  "Recreation & Education": 41691170,
  "Alcohol & Tobacco":      41691206,
};
const PROV_VECTORS = {
  NL: 41691244, PE: 41691379, NS: 41691513, NB: 41691648,
  QC: 41691783, ON: 41691919, MB: 41692055, SK: 41692191,
  AB: 41692327, BC: 41692462,
};

const CAT_KEYS  = ["Shelter","Food","Transport","Health","Recreation & Education","Household","Clothing","Alcohol & Tobacco"];
const PROV_KEYS = ["BC","AB","SK","MB","ON","QC","NB","NS","PE","NL"];

const CAT_COLORS = {
  "Shelter":               "#E05A4A",
  "Food":                  "#F5C842",
  "Transport":             "#3ECFA0",
  "Health":                "#6B9FE4",
  "Recreation & Education":"#B07FE8",
  "Household":             "#F0814A",
  "Clothing":              "#4AC8E8",
  "Alcohol & Tobacco":     "#E8A23A",
};
const PROV_COLORS = {
  BC:"#E05A4A", AB:"#F5C842", SK:"#3ECFA0", MB:"#6B9FE4",
  ON:"#B07FE8", QC:"#F0814A", NB:"#4AC8E8", NS:"#E8A23A",
  PE:"#A0C878", NL:"#E87AB0",
};
const CAT_META = {
  "Shelter":               { label:"Shelter",                icon:"🏠" },
  "Food":                  { label:"Food",                   icon:"🥦" },
  "Transport":             { label:"Transport",              icon:"🚗" },
  "Health":                { label:"Health & Personal",      icon:"💊" },
  "Recreation & Education":{ label:"Recreation & Education", icon:"📚" },
  "Household":             { label:"Household",              icon:"🛋️" },
  "Clothing":              { label:"Clothing",               icon:"👗" },
  "Alcohol & Tobacco":     { label:"Alcohol & Tobacco",      icon:"🍺" },
};
const PROV_META = [
  { code:"BC", name:"British Columbia", key:"BC" },
  { code:"AB", name:"Alberta",          key:"AB" },
  { code:"SK", name:"Saskatchewan",     key:"SK" },
  { code:"MB", name:"Manitoba",         key:"MB" },
  { code:"ON", name:"Ontario",          key:"ON" },
  { code:"QC", name:"Québec",           key:"QC" },
  { code:"NB", name:"New Brunswick",    key:"NB" },
  { code:"NS", name:"Nova Scotia",      key:"NS" },
  { code:"PE", name:"P.E.I.",           key:"PE" },
  { code:"NL", name:"Newfoundland",     key:"NL" },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const STATCAN_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";
// Annual CPI table 18-10-0005-01, Canada, All-items (coordinate 1.1)
// Goes back to 1914 — used solely for purchasing power chart
const STATCAN_ANNUAL_CPI_URL = `${STATCAN_BASE}/getDataFromCubePidCoord/18100005/1.1.0.0.0.0.0.0.0.0`;
// BoC Valet JSON endpoint — more reliable than CSV
const BOC_VALET_JSON = "https://www.bankofcanada.ca/valet/observations/STATIC_ATABLE_V39079/json?start_date=1994-01-01";
const CPI_VECTOR   = 41690973;
const BOC_TARGET   = 2.0;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const RANGES = { "2Y":24, "5Y":60, "10Y":120, "25Y":300, "All":99999 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  const d = new Date(iso.slice(0,10) + "T12:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Build monthly YoY % array from raw [[dateStr, indexValue], ...]
function computeYoY(raw) {
  const map = {};
  raw.forEach(([d, v]) => { map[d.slice(0,7)] = v; });
  return Object.keys(map).sort().reduce((acc, k) => {
    const [y, m] = k.split("-").map(Number);
    const pk = `${y-1}-${String(m).padStart(2,"0")}`;
    if (map[pk] != null)
      acc.push({
        date:  fmtDate(k + "-01"),
        iso:   k + "-01",
        value: +((map[k] - map[pk]) / map[pk] * 100).toFixed(2),
      });
    return acc;
  }, []);
}

// Build annual Jan-over-Jan YoY history from batch StatCan response
// rawMap: { vectorId -> [[dateStr, value], ...] }
function buildAnnualHistory(rawMap, keys, vectorMap) {
  const seriesMap = {};
  keys.forEach(k => {
    const raw = rawMap[vectorMap[k]];
    if (!raw) return;
    const byMonth = {};
    raw.forEach(([d, v]) => { byMonth[d.slice(0,7)] = v; });
    seriesMap[k] = {};
    Object.keys(byMonth).sort().forEach(ym => {
      const [y, m] = ym.split("-").map(Number);
      if (m !== 1) return;
      const prev = `${y-1}-01`;
      if (byMonth[prev] != null && byMonth[prev] !== 0)
        seriesMap[k][y] = +((byMonth[ym] - byMonth[prev]) / byMonth[prev] * 100).toFixed(2);
    });
  });
  const allYears = [...new Set(keys.flatMap(k => Object.keys(seriesMap[k] || {})))].sort();
  return allYears.map(y => {
    const row = { year: String(y) };
    keys.forEach(k => { if (seriesMap[k]?.[y] != null) row[k] = seriesMap[k][y]; });
    return row;
  }).filter(row => keys.some(k => row[k] != null));
}

function computeCumulative(history, keys) {
  const acc = {};
  keys.forEach(k => { acc[k] = 1.0; });
  return history.map(row => {
    const out = { year: row.year };
    keys.forEach(k => {
      if (row[k] != null) acc[k] *= (1 + row[k] / 100);
      out[k] = +((acc[k] - 1) * 100).toFixed(1);
    });
    return out;
  });
}

// Build purchasing power from raw CPI index values.
// Merges fallback (1914+) with live API data, anchors $1.00 at first datapoint.
function computeCadDevaluation(rawCpi) {
  if (!rawCpi?.length) return [];
  const map = {};
  rawCpi.forEach(([d, v]) => { map[d.slice(0,7)] = v; });
  const sorted = Object.keys(map).sort();
  const base = map[sorted[0]];
  if (!base) return [];
  return sorted.map(ym => {
    const v = map[ym];
    const cadValue = +(base / v).toFixed(4);
    return {
      date:     fmtDate(ym + "-01"),
      iso:      ym + "-01",
      cadValue: Math.max(cadValue, 0.001),
      lostPct:  +((1 - Math.max(cadValue, 0)) * 100).toFixed(1),
    };
  });
}

// Parse StatCan batch WDS response → { vectorId -> [[date, val], ...] }
// Security: validates structure, types, and value ranges before use
function parseBatchWDS(json) {
  const out = {};
  if (!Array.isArray(json) || json.length > 200) return out;
  json.forEach(item => {
    try {
      const vid = item.object?.vectorId;
      const pts = item.object?.vectorDataPoint;
      if (!Number.isInteger(vid) || !Array.isArray(pts)) return;
      out[vid] = pts
        .filter(p => typeof p.refPer === "string" && /^\d{4}-\d{2}/.test(p.refPer) && typeof p.value === "number" && isFinite(p.value) && Math.abs(p.value) < 100000)
        .map(p => [p.refPer, p.value]);
    } catch {}
  });
  return out;
}

// Parse StatCan annual CPI cube response → [[dateStr, value], ...]
function parseAnnualCPI(json) {
  try {
    const pts = json?.[0]?.object?.vectorDataPoint;
    if (!Array.isArray(pts)) return [];
    return pts
      .map(p => [p.refPer, parseFloat(p.value)])
      .filter(([, v]) => !isNaN(v));
  } catch { return []; }
}

// Parse BoC Valet JSON response → [{ date, iso, rate }, ...]
// Security: validates date format and rate is a plausible interest rate
function parseBoCValetJSON(json) {
  try {
    const obs = json.observations;
    if (!Array.isArray(obs) || obs.length > 5000) return [];
    return obs.map(o => {
      const date = o.d;
      const rate = parseFloat(o.STATIC_ATABLE_V39079?.v);
      if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      if (isNaN(rate) || rate < 0 || rate > 50) return null;
      return { date: fmtDate(date), iso: date, rate };
    }).filter(Boolean);
  } catch { return []; }
}

// Taylor Rule (simplified Taylor 1993):
// i = 1.5 * π + 1.0
// (assumes output gap = 0, neutral real rate r* = 0.5%, inflation target = 2%)
function taylorRate(inflation) {
  return +(1.5 * inflation + 1.0).toFixed(2);
}



// ── Shared UI ─────────────────────────────────────────────────────────────────
function FilterPill({ label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", gap:5,
      background: active ? `${color}1A` : "transparent",
      border: `1px solid ${active ? color : C.border2}`,
      color: active ? color : C.textMuted,
      borderRadius:100, padding:"4px 11px", fontSize:11, fontWeight:600,
      cursor:"pointer", fontFamily:"inherit", transition:"all .15s",
      WebkitTapHighlightColor:"transparent",
    }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:active?color:C.textMuted, flexShrink:0 }}/>
      {label}
    </button>
  );
}

const MultiTip = ({ active, payload, label, suffix="%" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, padding:"12px 16px", boxShadow:"0 8px 32px rgba(0,0,0,.8)", fontFamily:"inherit", minWidth:170, maxWidth:240 }}>
      <div style={{ fontSize:11, fontWeight:600, color:C.textSecondary, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>{label}</div>
      {payload.slice(0,8).map((p,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:p.color, flexShrink:0 }}/>
          <span style={{ fontSize:11, color:C.textSecondary, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
          <span style={{ fontSize:13, fontWeight:700, color:p.color, fontFamily:"'Barlow Condensed',sans-serif", marginLeft:4, whiteSpace:"nowrap" }}>
            {p.value > 0 ? "+" : ""}{p.value?.toFixed(2)}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
};

const SingleTip = ({ active, payload, label, prefix="", suffix="%", note }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, padding:"12px 16px", boxShadow:"0 8px 32px rgba(0,0,0,.8)", fontFamily:"inherit" }}>
      <div style={{ fontSize:11, fontWeight:600, color:C.textSecondary, textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color:payload[0].color||C.yellow, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"-.5px", lineHeight:1 }}>
        {prefix}{v?.toFixed(2)}{suffix}
      </div>
      {note && <div style={{ fontSize:11, color:C.textMuted, marginTop:5 }}>{note(v)}</div>}
    </div>
  );
};

// ── Homepage Hero ─────────────────────────────────────────────────────────────
function HomepageHero({ navigate, cur }) {
  const rate = cur?.value;
  const rateColor = rate != null ? valColor(rate) : C.yellow;
  const rateBg    = rate != null ? valBg(rate)    : C.yellowBg;

  const LINKS = [
    { label:"Inflation Rates",    desc:"Track CPI by category and province in real time.",         path:"/inflation-rates",     idx:0, icon:"📊" },
    { label:"Purchasing Power",   desc:"How much value has your dollar lost?",                        path:"/purchasing-power",    idx:1, icon:"💸" },
    { label:"Taylor Rule",        desc:"Is the Bank of Canada ahead or behind the curve?",          path:"/taylor-rule",         idx:2, icon:"📐" },
    { label:"Interest Calculator",desc:"Model how compound interest grows your savings.",           path:"/interest-calculator", idx:3, icon:"📈" },
    { label:"Mortgage Calculator",desc:"Model payments, transfer tax, and borrowing power.",        path:"/mortgage-calculator", idx:4, icon:"🏠" },
  ];

  return (
    <div style={{ marginBottom:32 }}>
      {/* Hero headline */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:"40px 32px 36px", marginBottom:16, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, right:0, width:300, height:300, background:`radial-gradient(circle at top right, ${rateColor}08, transparent 70%)`, pointerEvents:"none" }}/>
        
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".14em", marginBottom:16 }}>
          Canada's Independent Inflation Tracker
        </div>

        <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(36px,7vw,64px)", fontWeight:700, lineHeight:1.05, letterSpacing:"-1px", color:C.white, marginBottom:16, margin:"0 0 16px" }}>
          Understand How Inflation Is<br/>
          <span style={{ color:C.yellow }}>Affecting Your Money</span>
        </h1>

        <p style={{ fontSize:15, color:C.textSecondary, lineHeight:1.7, maxWidth:580, margin:"0 0 28px" }}>
          Access live data from Statistics Canada and the Bank of Canada.
        </p>

        {rate != null && (
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:28 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:rateBg, border:`1px solid ${rateColor}30`, borderRadius:12, padding:"10px 18px" }}>
              <span style={{ fontSize:11, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em" }}>Current CPI</span>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:700, color:rateColor, letterSpacing:"-1px", lineHeight:1 }}>{rate.toFixed(1)}%</span>
              <span style={{ fontSize:11, color:C.textMuted }}>year-over-year · {cur.date}</span>
            </div>
            <div style={{ fontSize:10, color:C.textMuted, display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:C.green }}></span>
              March data releases April 20
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={() => navigate("/inflation-rates", 0)} style={{ background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px 24px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            View Live Inflation Data
          </button>
        </div>
      </div>

      {/* Mission statement */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 28px", marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:700, color:C.white, marginBottom:10, letterSpacing:"-.3px" }}>
          Financial literacy is a right, not a privilege.
        </h2>
        <p style={{ fontSize:13, color:C.textSecondary, lineHeight:1.8, maxWidth:680, margin:"0 0 12px" }}>
          Most Canadians experience inflation every day — at the grocery store, on their mortgage statement, in their paycheque — but have no easy way to see the full picture. Canadianflation exists to change that.
        </p>
        <p style={{ fontSize:13, color:C.textSecondary, lineHeight:1.8, maxWidth:680, margin:0 }}>
          We built a free, source-cited tool that puts real data in front of anyone who wants it,
          presented the way it deserves to be: clearly, honestly, and without spin.
        </p>
      </div>

      {/* Navigation cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 }}>
        {LINKS.map((link, i) => (
          <button key={i} onClick={() => navigate(link.path, link.idx)} style={{
            background:C.surface, border:`1px solid ${C.border}`, borderRadius:14,
            padding:"20px 18px", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
            transition:"border-color .15s, background .15s", WebkitTapHighlightColor:"transparent",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.yellow; e.currentTarget.style.background = C.surface2; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
            <div style={{ fontSize:22, marginBottom:10 }}>{link.icon}</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:5 }}>{link.label}</div>
            <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.6 }}>{link.desc}</div>
            <div style={{ fontSize:11, color:C.yellow, marginTop:10, fontWeight:600 }}>Explore →</div>
          </button>
        ))}
      </div>

      {/* How it works */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 28px", marginTop:14 }}>
        <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, color:C.white, marginBottom:10, letterSpacing:"-.3px" }}>
          How it works
        </h2>
        <p style={{ fontSize:13, color:C.textSecondary, lineHeight:1.8, maxWidth:680, margin:0 }}>
          Canadianflation is a free Canadian inflation calculator that fetches live data directly from
          Statistics Canada's Web Data Service (table 18-10-0004-01) and the Bank of Canada Valet API on every page load —
          similar to the Bank of Canada inflation calculator, but with a broader set of tools built for everyday Canadians.
          Every number you see traces to an official government source, updated monthly when Statistics Canada publishes new CPI data.
        </p>
        <div style={{ display:"flex", gap:16, marginTop:14, flexWrap:"wrap" }}>
          <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401" target="_blank" rel="noopener noreferrer"
            style={{ fontSize:11, color:C.textMuted, textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ color:C.green }}>↗</span> Statistics Canada — Table 18-10-0004-01
          </a>
          <a href="https://www.bankofcanada.ca/valet/docs" target="_blank" rel="noopener noreferrer"
            style={{ fontSize:11, color:C.textMuted, textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ color:C.green }}>↗</span> Bank of Canada Valet API
          </a>
        </div>
      </div>
    </div>
  );
}

// ── TAB 1: Inflation Rates ────────────────────────────────────────────────────
function RatesTab({ data, vis, catHistory, provHistory }) {
  const [range, setRange]            = useState("10Y");
  const [activeCats, setActiveCats]  = useState(Object.fromEntries(CAT_KEYS.map(k => [k, true])));
  const [activeProvs, setActiveProvs]= useState(Object.fromEntries(PROV_KEYS.map(k => [k, true])));

  // Snapshot list and chart both derive from the same catHistory/provHistory props
  const latestCatRow  = catHistory?.[catHistory.length - 1]  || {};
  const latestProvRow = provHistory?.[provHistory.length - 1] || {};
  const COMPONENTS = CAT_KEYS
    .map(k => ({ key:k, label:CAT_META[k].label, icon:CAT_META[k].icon, value:latestCatRow[k] ?? 0 }))
    .sort((a,b) => b.value - a.value);
  const PROVINCES = PROV_META
    .map(p => ({ ...p, value:latestProvRow[p.key] ?? 0 }))
    .sort((a,b) => b.value - a.value);

  const chart   = data ? data.slice(-Math.min(RANGES[range], data.length)) : [];
  const cur     = data?.[data.length - 1];
  const prev    = data?.[data.length - 2];
  const peak    = data?.reduce((a,b) => b.value > a.value ? b : a);
  const l12     = data?.slice(-12) ?? [];
  const lo12    = l12.length ? Math.min(...l12.map(d => d.value)) : 0;
  const hi12    = l12.length ? Math.max(...l12.map(d => d.value)) : 0;
  const startYr = data?.[0]?.iso ? new Date(data[0].iso).getFullYear() : "—";
  const delta   = cur && prev ? +(cur.value - prev.value).toFixed(1) : 0;
  const ti = range==="2Y"?2:range==="5Y"?5:range==="10Y"?11:range==="25Y"?28:Math.max(1,Math.floor(chart.length/11));
  const catStartYr  = catHistory?.[0]?.year;
  const catEndYr    = catHistory?.[catHistory.length-1]?.year;
  const provStartYr = provHistory?.[0]?.year;
  const provEndYr   = provHistory?.[provHistory.length-1]?.year;

  return (<>
    {/* Hero */}
    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, marginBottom:16, overflow:"hidden" }}>
      <div style={{ padding:"28px 24px 0" }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".12em", marginBottom:12 }}>
          Canada · All-Items CPI · Year-over-Year · {cur?.date}
        </div>
        <div style={{ fontSize:10, fontWeight:600, color:C.textMuted, marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:C.green }}></span>
          Live StatCan data · March 2026 figures release April 20
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap", marginBottom:20 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(60px,12vw,96px)", fontWeight:700, lineHeight:1, letterSpacing:"-2px", color:valColor(cur?.value ?? 0) }}>
            {cur?.value.toFixed(1)}%
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7, paddingBottom:8 }}>
            {prev && (
              <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:valBg(delta), color:valColor(delta), borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:700, border:`1px solid ${valColor(delta)}25`, width:"fit-content" }}>
                {delta>0?"▲":delta<0?"▼":"—"} {Math.abs(delta).toFixed(1)}pp vs {prev.date}
              </span>
            )}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[`BoC target ${BOC_TARGET}%`, peak?`Peak ${peak.value.toFixed(1)}% · ${peak.date}`:null, `${data?.length} months · ${startYr}–present`].filter(Boolean).map((t,i) => (
                <span key={i} style={{ fontSize:10, fontWeight:600, color:C.textMuted, background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, padding:"3px 8px" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderTop:`1px solid ${C.border}` }}>
        {[
          { label:"vs. BoC",    val:`${(cur?.value??0)>BOC_TARGET?"+":""}${((cur?.value??0)-BOC_TARGET).toFixed(1)}pp`, color:valColor(cur?.value??0) },
          { label:"Prior Month",val:`${prev?.value.toFixed(1)}%`,  color:C.white },
          { label:"12-Mo Low",  val:`${lo12.toFixed(1)}%`,         color:C.green },
          { label:"12-Mo High", val:`${hi12.toFixed(1)}%`,         color:C.red   },
        ].map((s,i) => (
          <div key={i} style={{ padding:"14px 16px", borderRight:i<3?`1px solid ${C.border}`:"none" }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>

    {/* History chart */}
    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"22px 20px 16px", marginBottom:16, transitionDelay:".06s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ fontSize:14, fontWeight:700, margin:0 }}>Inflation History</h2>
          <div style={{ fontSize:10, color:C.textSecondary, marginTop:2 }}>Year-over-year · {chart[0]?.date} – {chart[chart.length-1]?.date}</div>
        </div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {Object.keys(RANGES).map(r => <button key={r} className={`rb ${range===r?"on":""}`} onClick={() => setRange(r)}>{r}</button>)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chart} margin={{ top:4, right:4, left:-24, bottom:0 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"   stopColor={C.yellow} stopOpacity={0.15}/>
              <stop offset="95%"  stopColor={C.yellow} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={C.red}/>
              <stop offset="50%"  stopColor={C.yellow}/>
              <stop offset="100%" stopColor={C.green}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti} minTickGap={50}/>
          <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={["auto","auto"]}/>
          <Tooltip content={<SingleTip suffix="%" note={v=>`${v>BOC_TARGET?`+${(v-BOC_TARGET).toFixed(1)}pp above`:`${(BOC_TARGET-v).toFixed(1)}pp below`} BoC target`}/>}/>
          <ReferenceLine y={BOC_TARGET} stroke={C.border2} strokeDasharray="4 3" label={{ value:"BoC 2%", fill:C.textMuted, fontSize:9, position:"insideTopRight" }}/>
          <ReferenceLine y={0} stroke={C.border}/>
          <Area type="monotone" dataKey="value" stroke="url(#lineGrad)" strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r:4, fill:C.yellow, stroke:C.surface, strokeWidth:2 }}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>

    {/* Snapshot lists */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14, marginBottom:16 }}>
      <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", transitionDelay:".11s" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>By Category</div>
        <div style={{ fontSize:10, color:C.textSecondary, marginBottom:14 }}>Year-over-year change · latest available data</div>
        {COMPONENTS.map((comp, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:i<COMPONENTS.length-1?`1px solid ${C.border}`:"none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <span style={{ width:28, height:28, borderRadius:7, background:valBg(comp.value), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>{comp.icon}</span>
              <span style={{ fontSize:12, fontWeight:600, color:C.textPrimary }}>{comp.label}</span>
            </div>
            <span style={{ fontSize:14, fontWeight:700, color:valColor(comp.value), fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"-.3px", flexShrink:0 }}>
              {comp.value >= 0 ? "+" : ""}{comp.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", transitionDelay:".15s" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>By Province</div>
        <div style={{ fontSize:10, color:C.textSecondary, marginBottom:14 }}>Year-over-year change · latest available data</div>
        {PROVINCES.map((p, i) => {
          const clr = valColor(p.value);
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:i<PROVINCES.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <span style={{ width:28, height:28, borderRadius:7, background:valBg(p.value), display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:clr, flexShrink:0 }}>{p.code}</span>
                <span style={{ fontSize:12, fontWeight:500, color:C.textPrimary }}>{p.name}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:clr, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"-.3px", flexShrink:0 }}>
                {p.value.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>

    {/* Category trend chart */}
    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", marginBottom:16, transitionDelay:".18s" }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Category Trends</div>
      <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>
        Annual year-over-year % · {catStartYr}–{catEndYr} · Data: Statistics Canada
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:16 }}>
        {CAT_KEYS.map(k => <FilterPill key={k} label={k} color={CAT_COLORS[k]} active={activeCats[k]} onClick={() => setActiveCats(p => ({ ...p, [k]:!p[k] }))}/>)}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={catHistory} margin={{ top:4, right:8, left:-24, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
          <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
          <Tooltip content={<MultiTip/>}/>
          <ReferenceLine y={BOC_TARGET} stroke={C.border2} strokeDasharray="4 3"/>
          <ReferenceLine y={0} stroke={C.border}/>
          {CAT_KEYS.map(k => activeCats[k] ? <Line key={k} type="monotone" dataKey={k} stroke={CAT_COLORS[k]} strokeWidth={2} dot={false} name={k} activeDot={{ r:3, stroke:C.surface, strokeWidth:2 }}/> : null)}
        </LineChart>
      </ResponsiveContainer>
    </div>

    {/* Province trend chart */}
    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", marginBottom:4, transitionDelay:".22s" }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Provincial Trends</div>
      <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>
        Annual year-over-year % · {provStartYr}–{provEndYr} · Data: Statistics Canada
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:16 }}>
        {PROVINCES.map(p => <FilterPill key={p.key} label={p.code} color={PROV_COLORS[p.key]} active={activeProvs[p.key]} onClick={() => setActiveProvs(prev => ({ ...prev, [p.key]:!prev[p.key] }))}/>)}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={provHistory} margin={{ top:4, right:8, left:-24, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
          <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
          <Tooltip content={<MultiTip/>}/>
          <ReferenceLine y={BOC_TARGET} stroke={C.border2} strokeDasharray="4 3"/>
          {PROV_KEYS.map(k => activeProvs[k] ? <Line key={k} type="monotone" dataKey={k} stroke={PROV_COLORS[k]} strokeWidth={2} dot={false} name={k} activeDot={{ r:3, stroke:C.surface, strokeWidth:2 }}/> : null)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </>);
}

// ── TAB 2: Purchasing Power ───────────────────────────────────────────────────
function CumulativeTab({ data, vis, rawCpi, catHistory, provHistory }) {
  const [range, setRange]              = useState("All");
  const [activeCats, setActiveCats]    = useState(Object.fromEntries(CAT_KEYS.map(k => [k, true])));
  const [activeProvs, setActiveProvs]  = useState(Object.fromEntries(PROV_KEYS.map(k => [k, true])));

  const catCumHistory  = useMemo(() => computeCumulative(catHistory,  CAT_KEYS),  [catHistory]);
  const provCumHistory = useMemo(() => computeCumulative(provHistory, PROV_KEYS), [provHistory]);
  const cadData  = useMemo(() => computeCadDevaluation(rawCpi), [rawCpi]);
  const chart    = cadData.slice(-Math.min(RANGES[range], cadData.length));
  const latest   = cadData[cadData.length - 1];
  const startYr  = cadData[0]?.iso ? new Date(cadData[0].iso).getFullYear() : "1976";
  const totalLost = latest ? latest.lostPct : 0;
  const ti = range==="2Y"?2:range==="5Y"?5:range==="10Y"?11:range==="25Y"?28:Math.max(1,Math.floor(chart.length/11));

  const latestCatCum  = catCumHistory[catCumHistory.length - 1]  || {};
  const latestProvCum = provCumHistory[provCumHistory.length - 1] || {};
  const sortedCat  = CAT_KEYS.map(k => ({ key:k, label:CAT_META[k].label, icon:CAT_META[k].icon, cumValue:latestCatCum[k]??0 })).sort((a,b) => b.cumValue - a.cumValue);
  const sortedProv = PROV_META.map(p => ({ ...p, cumValue:latestProvCum[p.key]??0 })).sort((a,b) => b.cumValue - a.cumValue);
  const multiplier = latest ? (1 / latest.cadValue).toFixed(2) : "—";
  const cagr = latest ? ((Math.pow(1/latest.cadValue, 1/((cadData.length||12)/12))-1)*100).toFixed(1) : "—";

  return (<>
    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, marginBottom:16, overflow:"hidden" }}>
      <div style={{ padding:"28px 24px 0" }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".12em", marginBottom:12 }}>
          CAD Purchasing Power · {startYr}–Present · Compound Erosion
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap", marginBottom:20 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(60px,12vw,96px)", fontWeight:700, lineHeight:1, letterSpacing:"-2px", color:C.red }}>
            −{totalLost.toFixed(1)}%
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7, paddingBottom:8 }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.redBg, color:C.red, borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:700, border:`1px solid ${C.red}25`, width:"fit-content" }}>
              $1.00 in {startYr} → ${latest?.cadValue.toFixed(2)} today
            </span>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[`${Math.round(totalLost)}¢ lost per dollar`, `Over ${data?.length||0} months`, `Avg ~${cagr}%/yr erosion`].map((t,i) => (
                <span key={i} style={{ fontSize:10, fontWeight:600, color:C.textMuted, background:C.surface2, border:`1px solid ${C.border}`, borderRadius:5, padding:"3px 8px" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderTop:`1px solid ${C.border}` }}>
        {[
          { label:"Purchasing Power", val:`${latest?.cadValue.toFixed(2)}¢`, color:C.red    },
          { label:"Total Lost",       val:`${totalLost.toFixed(1)}%`,         color:C.red    },
          { label:"Cost Multiplier",  val:`${multiplier}×`,                   color:C.yellow },
          { label:"Period",           val:`${startYr}–Now`,                   color:C.white  },
        ].map((s,i) => (
          <div key={i} style={{ padding:"14px 16px", borderRight:i<3?`1px solid ${C.border}`:"none" }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"-.3px" }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>

    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"22px 20px 16px", marginBottom:16, transitionDelay:".06s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>Purchasing Power of $1.00</div>
          <div style={{ fontSize:10, color:C.textSecondary, marginTop:2 }}>Real value — compound erosion since {startYr}</div>
        </div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {Object.keys(RANGES).map(r => <button key={r} className={`rb ${range===r?"on":""}`} onClick={() => setRange(r)}>{r}</button>)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chart} margin={{ top:4, right:4, left:-10, bottom:0 }}>
          <defs>
            <linearGradient id="cadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.red} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti} minTickGap={50}/>
          <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v.toFixed(2)}`} domain={["auto","auto"]}/>
          <Tooltip content={<SingleTip prefix="$" suffix="" note={v=>`Lost ${((1-v)*100).toFixed(1)}¢ of every dollar`}/>}/>
          <ReferenceLine y={1} stroke={C.border2} strokeDasharray="4 3" label={{ value:"$1.00 baseline", fill:C.textMuted, fontSize:9, position:"insideTopRight" }}/>
          <Area type="monotone" dataKey="cadValue" stroke={C.red} strokeWidth={2} fill="url(#cadGrad)" dot={false} activeDot={{ r:4, fill:C.red, stroke:C.surface, strokeWidth:2 }}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14, marginBottom:16 }}>
      <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", transitionDelay:".11s" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Cumulative by Category</div>
        <div style={{ fontSize:10, color:C.textSecondary, marginBottom:14 }}>Compound total since {catCumHistory?.[0]?.year}</div>
        {sortedCat.map((comp, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:i<sortedCat.length-1?`1px solid ${C.border}`:"none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <span style={{ width:28, height:28, borderRadius:7, background:cumBg(comp.cumValue), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>{comp.icon}</span>
              <span style={{ fontSize:12, fontWeight:600, color:C.textPrimary }}>{comp.label}</span>
            </div>
            <span style={{ fontSize:14, fontWeight:700, color:cumColor(comp.cumValue), fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"-.3px", flexShrink:0 }}>
              {comp.cumValue >= 0 ? "+" : ""}{comp.cumValue.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", transitionDelay:".15s" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Cumulative by Province</div>
        <div style={{ fontSize:10, color:C.textSecondary, marginBottom:14 }}>Compound total since {provCumHistory?.[0]?.year}</div>
        {sortedProv.map((p, i) => {
          const clr = cumColor(p.cumValue);
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:i<sortedProv.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <span style={{ width:28, height:28, borderRadius:7, background:cumBg(p.cumValue), display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:clr, flexShrink:0 }}>{p.code}</span>
                <span style={{ fontSize:12, fontWeight:500, color:C.textPrimary }}>{p.name}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:clr, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"-.3px", flexShrink:0 }}>
                +{p.cumValue.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>

    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", marginBottom:16, transitionDelay:".18s" }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Cumulative Category Inflation</div>
      <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>Compounded total since {catCumHistory?.[0]?.year} · each year builds on the last</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:16 }}>
        {CAT_KEYS.map(k => <FilterPill key={k} label={k} color={CAT_COLORS[k]} active={activeCats[k]} onClick={() => setActiveCats(p => ({ ...p, [k]:!p[k] }))}/>)}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={catCumHistory} margin={{ top:4, right:8, left:-10, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
          <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`+${v}%`}/>
          <Tooltip content={<MultiTip suffix="%"/>}/>
          <ReferenceLine y={0} stroke={C.border}/>
          {CAT_KEYS.map(k => activeCats[k] ? <Line key={k} type="monotone" dataKey={k} stroke={CAT_COLORS[k]} strokeWidth={2} dot={false} name={k} activeDot={{ r:3, stroke:C.surface, strokeWidth:2 }}/> : null)}
        </LineChart>
      </ResponsiveContainer>
    </div>

    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", marginBottom:4, transitionDelay:".22s" }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Cumulative Provincial Inflation</div>
      <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>Compounded total since {provCumHistory?.[0]?.year} · each year builds on the last</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:16 }}>
        {PROV_META.map(p => <FilterPill key={p.key} label={p.code} color={PROV_COLORS[p.key]} active={activeProvs[p.key]} onClick={() => setActiveProvs(prev => ({ ...prev, [p.key]:!prev[p.key] }))}/>)}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={provCumHistory} margin={{ top:4, right:8, left:-10, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
          <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`+${v}%`}/>
          <Tooltip content={<MultiTip suffix="%"/>}/>
          {PROV_KEYS.map(k => activeProvs[k] ? <Line key={k} type="monotone" dataKey={k} stroke={PROV_COLORS[k]} strokeWidth={2} dot={false} name={k} activeDot={{ r:3, stroke:C.surface, strokeWidth:2 }}/> : null)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </>);
}

// ── TAB 3: Taylor Rule ────────────────────────────────────────────────────────
function TaylorTab({ data, vis, rateData }) {
  const [range, setRange] = useState("10Y");

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    const cpiByMonth = {};
    data.forEach(pt => { cpiByMonth[pt.iso.slice(0,7)] = pt.value; });
    const rateByMonth = {};
    rateData.forEach(pt => { rateByMonth[pt.iso.slice(0,7)] = pt.rate; });
    const allMonths = [...new Set([...Object.keys(cpiByMonth), ...Object.keys(rateByMonth)])].sort();
    return allMonths.map(ym => {
      const cpi    = cpiByMonth[ym] ?? null;
      const actual = rateByMonth[ym] ?? null;
      const taylor = cpi != null ? taylorRate(cpi) : null;
      const gap    = actual != null && taylor != null ? +(actual - taylor).toFixed(2) : null;
      return { date:fmtDate(ym+"-01"), iso:ym+"-01", cpi, actual, taylor, gap };
    }).filter(r => r.cpi != null || r.actual != null);
  }, [data, rateData]);

  const sliced  = chartData.slice(-Math.min(RANGES[range], chartData.length));
  const ti = range==="2Y"?2:range==="5Y"?5:range==="10Y"?11:range==="25Y"?28:Math.max(1,Math.floor(sliced.length/11));

  const noRateData = rateData.length === 0;

  return (<>
    {/* Main comparison chart */}
    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"22px 20px 16px", marginBottom:16, transitionDelay:".06s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>BoC Rate vs Taylor Rule Prescription</div>
          <div style={{ fontSize:10, color:C.textSecondary, marginTop:2 }}>
            {noRateData ? "Taylor Rule prescription from live CPI · BoC rate unavailable" : "Actual overnight rate (blue) vs Taylor Rule (purple) · Source: Bank of Canada Valet API"}
          </div>
        </div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {Object.keys(RANGES).map(r => <button key={r} className={`rb ${range===r?"on":""}`} onClick={() => setRange(r)}>{r}</button>)}
        </div>
      </div>
      <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap" }}>
        {[
          { color:C.blue,   label:"Actual BoC Rate",         show:!noRateData },
          { color:C.purple, label:"Taylor Rule Prescription", show:true },
          { color:C.yellow, label:"CPI Inflation",            show:true },
        ].filter(l => l.show).map((l,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.textSecondary }}>
            <span style={{ width:20, height:2, background:l.color, borderRadius:1, display:"inline-block" }}/>
            {l.label}
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={sliced} margin={{ top:4, right:8, left:-20, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti} minTickGap={50}/>
          <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={["auto","auto"]}/>
          <Tooltip content={<MultiTip suffix="%"/>}/>
          <ReferenceLine y={BOC_TARGET} stroke={C.border2} strokeDasharray="4 3" label={{ value:"2% target", fill:C.textMuted, fontSize:9, position:"insideTopRight" }}/>
          {!noRateData && <Line type="monotone" dataKey="actual" stroke={C.blue}   strokeWidth={2.5} dot={false} name="BoC Rate"     activeDot={{ r:4, fill:C.blue,   stroke:C.surface, strokeWidth:2 }}/>}
          <Line type="monotone" dataKey="taylor" stroke={C.purple} strokeWidth={2}   dot={false} name="Taylor Rule"  strokeDasharray="5 3" activeDot={{ r:4, fill:C.purple, stroke:C.surface, strokeWidth:2 }}/>
          <Line type="monotone" dataKey="cpi"    stroke={C.yellow} strokeWidth={1.5} dot={false} name="CPI Inflation" activeDot={{ r:3, fill:C.yellow, stroke:C.surface, strokeWidth:2 }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>

    {/* Gap chart */}
    {!noRateData && (
      <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", marginBottom:16, transitionDelay:".12s" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Policy Gap</div>
        <div style={{ fontSize:10, color:C.textSecondary, marginBottom:16 }}>
          BoC rate minus Taylor Rule — positive = BoC tighter than Taylor suggests, negative = easier
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={sliced} margin={{ top:4, right:8, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.green} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={C.green} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
            <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti} minTickGap={50}/>
            <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}pp`}/>
            <Tooltip content={<SingleTip suffix="pp" note={v => v > 0 ? "BoC tighter than Taylor suggests" : "BoC easier than Taylor suggests"}/>}/>
            <ReferenceLine y={0} stroke={C.border2} strokeDasharray="4 3"/>
            <Area type="monotone" dataKey="gap" stroke={C.green} strokeWidth={2} fill="url(#gapGrad)" dot={false} name="Policy Gap" activeDot={{ r:4, fill:C.green, stroke:C.surface, strokeWidth:2 }}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}

    {/* Explainer */}
    <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px", marginBottom:4, transitionDelay:".18s" }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>About the Taylor Rule</div>
      {[
        ["Formula used",       "i = 1.5π + 1.0  (simplified from Taylor 1993, output gap = 0)"],
        ["What it means",      "For every 1pp CPI rises above 2%, the rule suggests raising rates 1.5pp"],
        ["Neutral real rate",  "r* ≈ 0.5% (Bank of Canada's current estimate for Canada)"],
        ["Output gap",         "Assumed neutral (0) here — adding real GDP data would sharpen the estimate"],
        ["Original Taylor '93","r = p + 0.5·y + 0.5·(p − 2%) + 2% — assumes US neutral rate of 2%"],
        ["Why it differs",     "BoC uses its own models and mandate; Taylor Rule is a useful benchmark, not their actual rule"],
        ["Rate data source",   "Bank of Canada Valet API · series STATIC_ATABLE_V39079 (overnight target rate)"],
        ["CPI data source",    "Statistics Canada · table 18-10-0004-01 · vector v41690973"],
      ].map(([label, val], i, arr) => (
        <div key={i} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:C.textSecondary, minWidth:150, flexShrink:0 }}>{label}</span>
          <span style={{ fontSize:11, color:C.textPrimary, flex:1 }}>{val}</span>
        </div>
      ))}
    </div>
  </>);
}

// ── Shared input field (defined outside components to avoid remount glitch) ──
// Format number string progressively with commas as user types
// Preserves trailing decimal point and decimal digits while typing
function fmtInput(v) {
  if (v === "" || v == null) return "";
  const s = String(v).replace(/,/g, "");
  const trailingDot = s.endsWith(".");
  const parts = s.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decPart = parts.length > 1 ? "." + parts[1] : "";
  const result = intPart + decPart + (trailingDot && parts.length === 1 ? "." : "");
  return result;
}

function parseInput(v) {
  return String(v).replace(/,/g, "");
}

function CalcField({ label, value, onChange, placeholder, hint, isRate }) {
  const handleChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    // Only allow digits and one decimal point
    if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
    onChange(raw);
  };
  const displayVal = isRate ? value : fmtInput(value);
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.textPrimary, marginBottom:4 }}>
        {label}
      </div>
      {hint && <div style={{ fontSize:11, color:C.textSecondary, marginBottom:6 }}>{hint}</div>}
      <input
        type="text"
        inputMode="decimal"
        value={displayVal}
        onChange={handleChange}
        placeholder={placeholder}
        style={{ width:"100%", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, padding:"10px 14px", fontSize:14, color:C.textPrimary, fontFamily:"inherit", outline:"none" }}
      />
    </div>
  );
}

// ── TAB 4: Interest Calculator ──────────────────────────────────────
const CI_FREQS = [
  { label:"Annually",     n:1   },
  { label:"Semi-annually",n:2   },
  { label:"Quarterly",    n:4   },
  { label:"Monthly",      n:12  },
  { label:"Daily",        n:365 },
];

// FV of lump sum + FV of monthly annuity compounded at freq n/yr
// Guards against rn≈0 (zero rate edge case)
function compoundFV(P, monthlyPmt, annualRate, n, years) {
  const rn      = annualRate / n;
  const periods = n * years;
  const fvLump  = P * Math.pow(1 + rn, periods);
  // Convert monthly payment to per-period payment
  const pmtPerPeriod = monthlyPmt * (12 / n);
  const fvPmt = Math.abs(rn) < 1e-10
    ? pmtPerPeriod * periods                                        // r≈0: no compounding
    : pmtPerPeriod * ((Math.pow(1 + rn, periods) - 1) / rn);
  return fvLump + fvPmt;
}

function CompoundTab({ vis, liveCpi }) {
  const resultsRef = React.useRef(null);
  const [principal, setPrincipal] = useState("");
  const [monthly,   setMonthly]   = useState("");
  const [years,     setYears]     = useState("");
  const [rate,      setRate]      = useState("");
  const [variance,  setVariance]  = useState("");
  const [freq,      setFreq]      = useState(12);
  const [inflRate,  setInflRate]  = useState("");
  const [showReal,  setShowReal]  = useState(false);
  const [result,    setResult]    = useState(null);

  // Pre-fill inflation rate from live CPI when it arrives
  useEffect(() => {
    if (liveCpi != null && inflRate === "") setInflRate(liveCpi.toFixed(1));
  }, [liveCpi]); // eslint-disable-line

  function calculate() {
    const P   = parseFloat(principal) || 0;
    const pmt = parseFloat(monthly)   || 0;
    const t   = parseFloat(years);
    const r   = parseFloat(rate) / 100;
    const v   = parseFloat(variance) || 0;
    const inf = parseFloat(inflRate) / 100 || 0;
    if (!t || t <= 0 || t > 100) return;
    if (!r || r <= 0 || r > 5)   return;

    const base         = compoundFV(P, pmt, r, freq, t);
    const low          = v > 0 ? compoundFV(P, pmt, Math.max(0.0001, r - v/100), freq, t) : null;
    const high         = v > 0 ? compoundFV(P, pmt, r + v/100, freq, t) : null;
    const totalContrib = P + pmt * 12 * t;
    const interest     = base - totalContrib;

    // Real return: Fisher equation r_real = (1+r)/(1+inf) - 1
    const realRate     = inf > 0 ? (1 + r) / (1 + inf) - 1 : r;
    const realBase     = compoundFV(P, pmt, realRate, freq, t);
    const realInterest = realBase - totalContrib;
    const realRateAnn  = +(realRate * 100).toFixed(2);

    const chartData = Array.from({ length: Math.min(Math.ceil(t), 100) }, (_, i) => {
      const yr      = i + 1;
      const fv      = compoundFV(P, pmt, r, freq, Math.min(yr, t));
      const realFv  = compoundFV(P, pmt, realRate, freq, Math.min(yr, t));
      const contrib = P + pmt * 12 * Math.min(yr, t);
      return {
        year:              `Yr ${yr}`,
        "Nominal Value":   +fv.toFixed(2),
        "Real Value":      +realFv.toFixed(2),
        "Contributions":   +Math.max(contrib, 0).toFixed(2),
      };
    });

    setResult({ base, low, high, totalContrib, interest, realBase, realInterest, realRateAnn, inf, chartData });
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
  }

  const fmt = v => "$" + Math.round(v).toLocaleString("en-CA");

  return (
    <div className={`reveal ${vis?"in":""}`}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
        {/* Input panel */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Interest Calculator</div>
          <div style={{ fontSize:11, color:C.textSecondary, marginBottom:20 }}>See how your money grows over time</div>

          <CalcField label="Initial Investment" value={principal} onChange={setPrincipal} placeholder="e.g. 10000" hint="Amount you have available to invest today"/>
          <CalcField label="Monthly Contribution" value={monthly} onChange={setMonthly} placeholder="e.g. 500" hint="Amount added every month (use negative to withdraw)"/>
          <CalcField label="Length of Time (Years)" value={years} onChange={setYears} placeholder="e.g. 20" hint="How long you plan to invest" isRate/>
          <CalcField label="Annual Interest Rate (%)" value={rate} onChange={setRate} placeholder="e.g. 7" hint="Your estimated annual rate of return" isRate/>
          <CalcField label="Rate Variance (%)" value={variance} onChange={setVariance} placeholder="e.g. 2" hint="Shows low/high range above and below your rate" isRate/>
          <CalcField label="Assumed Inflation Rate (%)" value={inflRate} onChange={setInflRate} placeholder="e.g. 1.8" hint="Pre-filled from live CPI — adjust to model scenarios" isRate/>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>Compound Frequency</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {CI_FREQS.map(f => (
                <button key={f.n} onClick={() => setFreq(f.n)} style={{
                  background: freq===f.n ? C.yellow : C.surface2,
                  color:      freq===f.n ? "#000" : C.textSecondary,
                  border:     `1px solid ${freq===f.n ? C.yellow : C.border2}`,
                  borderRadius:7, padding:"6px 12px", fontSize:11, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit",
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={calculate} style={{ flex:1, background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Calculate
            </button>
            <button onClick={() => { setPrincipal(""); setMonthly(""); setYears(""); setRate(""); setVariance(""); setFreq(12); setResult(null); }} style={{ background:C.surface2, color:C.textSecondary, border:`1px solid ${C.border2}`, borderRadius:10, padding:"12px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Reset
            </button>
          </div>
        </div>

        {/* Results panel */}
        <div ref={resultsRef} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!result ? (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, minHeight:200 }}>
              <div style={{ fontSize:28 }}>📈</div>
              <div style={{ fontSize:14, color:C.textSecondary, textAlign:"center" }}>Fill in the fields and hit Calculate to see your results</div>
            </div>
          ) : (<>
            {/* Nominal / Real toggle */}
            {result.inf > 0 && (
              <div style={{ display:"flex", background:C.surface2, borderRadius:10, padding:3, border:`1px solid ${C.border}` }}>
                {["Nominal","Inflation-Adjusted"].map((label,i) => (
                  <button key={i} onClick={() => setShowReal(i===1)} style={{
                    flex:1, padding:"8px 12px", borderRadius:8, border:"none", fontFamily:"inherit",
                    fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s",
                    background: showReal===(i===1) ? C.yellow : "transparent",
                    color:      showReal===(i===1) ? "#000" : C.textSecondary,
                  }}>{label}</button>
                ))}
              </div>
            )}

            {/* Hero result */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>
                {showReal ? "Real (Today's Dollars)" : "Nominal"} Balance after {years} years
              </div>
              {showReal && result.inf > 0 && (
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>
                  Assuming {(result.inf*100).toFixed(1)}% avg inflation · real return {result.realRateAnn > 0 ? "+" : ""}{result.realRateAnn}%/yr
                </div>
              )}
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(44px,8vw,72px)", fontWeight:700, color:showReal ? C.blue : C.green, lineHeight:1, letterSpacing:"-1px", marginBottom:14 }}>
                {fmt(showReal ? result.realBase : result.base)}
              </div>
              {!showReal && result.low != null && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                  <span style={{ fontSize:11, background:C.redBg, color:C.red, border:`1px solid ${C.red}25`, borderRadius:6, padding:"4px 10px", fontWeight:600 }}>Low: {fmt(result.low)}</span>
                  <span style={{ fontSize:11, background:C.greenBg, color:C.green, border:`1px solid ${C.green}25`, borderRadius:6, padding:"4px 10px", fontWeight:600 }}>High: {fmt(result.high)}</span>
                </div>
              )}
              {showReal && result.inf > 0 && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                  <span style={{ fontSize:11, background:C.surface2, color:C.textSecondary, border:`1px solid ${C.border2}`, borderRadius:6, padding:"4px 10px", fontWeight:600 }}>
                    Nominal: {fmt(result.base)}
                  </span>
                  <span style={{ fontSize:11, background:C.blueBg, color:C.blue, border:`1px solid ${C.blue}25`, borderRadius:6, padding:"4px 10px", fontWeight:600 }}>
                    Purchasing power lost to inflation: {fmt(result.base - result.realBase)}
                  </span>
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, borderTop:`1px solid ${C.border}`, marginTop:8, paddingTop:16 }}>
                {(showReal && result.inf > 0 ? [
                  { label:"Real Final Balance",    val:fmt(result.realBase),     color:C.blue   },
                  { label:"Real Interest Earned",  val:fmt(result.realInterest), color:C.yellow },
                  { label:"Real ROI",              val:`${((result.realInterest/Math.max(result.totalContrib,1))*100).toFixed(1)}%`, color:C.green },
                  { label:"Real Annual Return",    val:`${result.realRateAnn > 0 ? "+" : ""}${result.realRateAnn}%`, color:C.purple },
                ] : [
                  { label:"Total Contributions",   val:fmt(result.totalContrib), color:C.blue   },
                  { label:"Total Interest",         val:fmt(result.interest),    color:C.yellow  },
                  { label:"Return on Investment",   val:`${((result.interest/Math.max(result.totalContrib,1))*100).toFixed(1)}%`, color:C.green },
                  { label:"Interest/Contrib ratio", val:`${(result.interest/Math.max(result.totalContrib,1)).toFixed(2)}×`, color:C.purple },
                ]).map((s,i) => (
                  <div key={i} style={{ padding:"12px 0" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth chart */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Growth Over Time</div>
              <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>Total value vs. your contributions each year</div>
              <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap" }}>
                {[{color:C.green,label:"Total Value"},{color:C.blue,label:"Contributions"}].map((l,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.textSecondary }}>
                    <span style={{ width:12, height:12, borderRadius:3, background:l.color, display:"inline-block" }}/>
                    {l.label}
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap" }}>
                {[
                  { color:C.green, label:"Nominal Value" },
                  ...(result.inf > 0 ? [{ color:C.blue, label:"Real Value (today's $)" }] : []),
                  { color:`${C.yellow}99`, label:"Contributions" },
                ].map((l,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.textSecondary }}>
                    <span style={{ width:12, height:12, borderRadius:3, background:l.color, display:"inline-block" }}/>
                    {l.label}
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={result.chartData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
                  <YAxis tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={v => "$"+Math.round(v/1000)+"k"}/>
                  <Tooltip formatter={(v,n) => [fmt(v), n]} contentStyle={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, fontFamily:"inherit", fontSize:12 }}/>
                  <Line type="monotone" dataKey="Nominal Value"  stroke={C.green}  strokeWidth={2.5} dot={false} activeDot={{ r:4 }}/>
                  {result.inf > 0 && <Line type="monotone" dataKey="Real Value" stroke={C.blue} strokeWidth={2} dot={false} strokeDasharray="5 3" activeDot={{ r:4 }}/>}
                  <Line type="monotone" dataKey="Contributions" stroke={C.yellow} strokeWidth={1.5} dot={false} strokeDasharray="3 3" opacity={0.7}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ── Mortgage input field with comma formatting ────────────────────────────────
function MortField({ label, value, set, ph, isSmall }) {
  const handleChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    set(raw);
  };
  const displayVal = isSmall ? value : fmtInput(value);
  return (
    <div style={{ marginBottom:14 }}>
      {label && <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:5 }}>{label}</div>}
      <input
        type="text" inputMode="decimal"
        value={displayVal} placeholder={ph}
        onChange={handleChange}
        style={{ width:"100%", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.textPrimary, fontFamily:"inherit", outline:"none" }}
      />
    </div>
  );
}

// ── Simple stateless field for DebtImpact (no internal state = no remount glitch) ──
function DebtField({ label, value, set, ph, isSmall, section }) {
  const handleChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    set(raw);
  };
  const displayVal = isSmall ? value : fmtInput(value);
  return (
    <div style={{ marginBottom:12 }}>
      {label && <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:4 }}>{label}</div>}
      <input
        type="text" inputMode="decimal"
        value={displayVal} placeholder={ph}
        onChange={handleChange}
        style={{ width:"100%", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:C.textPrimary, fontFamily:"inherit", outline:"none" }}
      />
    </div>
  );
}

// ── TAB 5: Mortgage Calculators ───────────────────────────────────────────────
function MortgageTab({ vis, liveCpi }) {
  const [sub, setSub] = useState(0);

  // ── Sub-tab 1: Mortgage Payment Calculator ─────────────────────────────────
  function MortgagePayment() {
    const mortResultsRef = React.useRef(null);
    const [price,     setPrice]     = useState("");
    const [down,      setDown]      = useState("");
    const [downPct,   setDownPct]   = useState(true); // true = %, false = $
    const [rate,      setRate]      = useState("");
    const [amort,     setAmort]     = useState("");
    const [payFreq,   setPayFreq]   = useState("monthly");
    const [inflRate,  setInflRate]  = useState("");
    const [showReal,  setShowReal]  = useState(false);
    const [result,    setResult]    = useState(null);

    useEffect(() => {
      if (liveCpi != null && inflRate === "") setInflRate(liveCpi.toFixed(1));
    }, [liveCpi]); // eslint-disable-line

    const FREQS = { monthly:12, biweekly:26, weekly:52 };

    function calc() {
      const P = parseFloat(price);
      const d = parseFloat(down) || 0;
      const r = parseFloat(rate) / 100;
      const a = parseFloat(amort);
      if (!P || !r || !a) return;

      const downAmt   = downPct ? P * (d/100) : d;
      const principal = P - downAmt;
      const n         = FREQS[payFreq];
      const rn        = r / n;
      const periods   = a * n;
      const payment   = principal * (rn * Math.pow(1+rn,periods)) / (Math.pow(1+rn,periods)-1);
      const totalPaid = payment * periods;
      const totalInt  = totalPaid - principal;
      const cmhc      = downPct && d < 20 ? principal * (d < 5 ? 0.04 : d < 10 ? 0.031 : 0.028) : 0;
      const inf       = parseFloat(inflRate) / 100 || 0;
      // Real payment: nominal payment discounted by cumulative inflation each year
      // Inflation helps borrowers — future payments are worth less in real terms
      const realTotalPaid = inf > 0
        ? Array.from({length: Math.ceil(a)}, (_,i) => payment * n/Math.ceil(a) / Math.pow(1+inf, i+1)).reduce((s,v)=>s+v,0)
        : totalPaid;
      const realTotalInt = realTotalPaid - principal;

      // Amortization chart — yearly
      let bal = principal;
      const chartData = [];
      let cumulativeInf = 1;
      for (let yr = 1; yr <= a; yr++) {
        let intYr = 0, prinYr = 0;
        cumulativeInf *= (1 + inf);
        for (let p = 0; p < n; p++) {
          const intPmt = bal * rn;
          const prinPmt = payment - intPmt;
          intYr  += intPmt;
          prinYr += prinPmt;
          bal    -= prinPmt;
        }
        const nomBal = Math.max(bal, 0);
        chartData.push({
          year:             `Yr ${yr}`,
          "Balance":        +nomBal.toFixed(0),
          "Real Balance":   inf > 0 ? +(nomBal / cumulativeInf).toFixed(0) : null,
          Interest:         +intYr.toFixed(0),
          Principal:        +prinYr.toFixed(0),
        });
      }
      setResult({ payment, totalPaid, totalInt, principal, downAmt, cmhc, chartData, inf, realTotalPaid, realTotalInt });
      setTimeout(() => mortResultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
    }

    const fmt  = v => "$" + Math.round(v).toLocaleString("en-CA");
    const fmtM = v => "$" + v.toFixed(2);

    return (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Calculate Mortgage Payments</div>

          <MortField label="Price of Property"   value={price} set={setPrice} ph="e.g. 650,000"/>
          <MortField label="Interest Rate (%)"    value={rate}  set={setRate}  ph="e.g. 4.5" isSmall/>
          <MortField label="Amortization (Years)" value={amort} set={setAmort} ph="e.g. 25"  isSmall/>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:5 }}>Down Payment</div>
            <div style={{ display:"flex", gap:6, marginBottom:8 }}>
              {[["$",false],["%",true]].map(([lbl,val])=>(
                <button key={lbl} onClick={()=>setDownPct(val)} style={{ flex:1, background:downPct===val?C.yellow:C.surface2, color:downPct===val?"#000":C.textSecondary, border:`1px solid ${downPct===val?C.yellow:C.border2}`, borderRadius:7, padding:"7px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{lbl}</button>
              ))}
            </div>
            <MortField label="" value={down} set={setDown} ph={downPct?"e.g. 20":"e.g. 130,000"} isSmall={downPct}/>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>Payment Frequency</div>
            <div style={{ display:"flex", gap:6 }}>
              {["monthly","biweekly","weekly"].map(f=>(
                <button key={f} onClick={()=>setPayFreq(f)} style={{ flex:1, background:payFreq===f?C.yellow:C.surface2, color:payFreq===f?"#000":C.textSecondary, border:`1px solid ${payFreq===f?C.yellow:C.border2}`, borderRadius:7, padding:"7px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize" }}>{f}</button>
              ))}
            </div>
          </div>

          <MortField label="Assumed Inflation Rate (%)" value={inflRate} set={setInflRate} ph="e.g. 1.8" isSmall/>
          <button onClick={calc} style={{ width:"100%", background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Calculate</button>
        </div>

        <div ref={mortResultsRef} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!result ? (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
              <div style={{ fontSize:28 }}>🏠</div>
              <div style={{ fontSize:14, color:C.textSecondary, textAlign:"center" }}>Enter your mortgage details to see your payment breakdown</div>
            </div>
          ) : (<>
            {result.inf > 0 && (
              <div style={{ display:"flex", background:C.surface2, borderRadius:10, padding:3, border:`1px solid ${C.border}` }}>
                {["Nominal","Inflation-Adjusted"].map((label,i) => (
                  <button key={i} onClick={() => setShowReal(i===1)} style={{
                    flex:1, padding:"8px 12px", borderRadius:8, border:"none", fontFamily:"inherit",
                    fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s",
                    background: showReal===(i===1) ? C.yellow : "transparent",
                    color:      showReal===(i===1) ? "#000" : C.textSecondary,
                  }}>{label}</button>
                ))}
              </div>
            )}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>
                {payFreq.charAt(0).toUpperCase()+payFreq.slice(1)} Payment · {showReal && result.inf > 0 ? "Inflation-Adjusted" : "Nominal"}
              </div>
              {showReal && result.inf > 0 && (
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>
                  Assuming {(result.inf*100).toFixed(1)}% avg inflation · future payments worth less in today's dollars
                </div>
              )}
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(44px,8vw,72px)", fontWeight:700, color:C.yellow, lineHeight:1, letterSpacing:"-1px", marginBottom:16 }}>
                {fmtM(result.payment)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                {(showReal && result.inf > 0 ? [
                  { label:"Mortgage Amount",        val:fmt(result.principal),               color:C.white },
                  { label:"Down Payment",           val:fmt(result.downAmt),                 color:C.blue  },
                  { label:"Real Total Interest",    val:fmt(result.realTotalInt),            color:C.green,
                    note:"Less than nominal — inflation erodes the real cost of debt" },
                  { label:"Nominal Total Interest", val:fmt(result.totalInt),                color:C.textSecondary },
                  { label:"Real Total Cost",        val:fmt(result.realTotalPaid + result.downAmt), color:C.textPrimary },
                  result.cmhc > 0 ? { label:"CMHC Insurance", val:fmt(result.cmhc), color:C.yellow } : null,
                ] : [
                  { label:"Mortgage Amount",        val:fmt(result.principal),               color:C.white },
                  { label:"Down Payment",           val:fmt(result.downAmt),                 color:C.blue  },
                  { label:"Total Interest",         val:fmt(result.totalInt),                color:C.red   },
                  { label:"Total Cost",             val:fmt(result.totalPaid + result.downAmt), color:C.textPrimary },
                  result.cmhc > 0 ? { label:"CMHC Insurance", val:fmt(result.cmhc), color:C.yellow } : null,
                ]).filter(Boolean).map((s,i)=>(
                  <div key={i}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                    {s.note && <div style={{ fontSize:10, color:C.textMuted, marginTop:3, lineHeight:1.4 }}>{s.note}</div>}
                  </div>
                ))}
              </div>
              {result.cmhc > 0 && <div style={{ marginTop:10, fontSize:10, color:C.textMuted, background:C.surface2, borderRadius:6, padding:"6px 10px" }}>⚠ CMHC mortgage insurance required (down payment under 20%)</div>}
              {showReal && result.inf > 0 && (
                <div style={{ marginTop:12, fontSize:11, color:C.textMuted, background:C.surface2, borderRadius:8, padding:"10px 14px", lineHeight:1.6 }}>
                  💡 Inflation benefits borrowers: your fixed mortgage payment stays the same in dollars, but its real value shrinks over time as prices rise. You effectively repay with cheaper dollars.
                </div>
              )}
            </div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Amortization Schedule</div>
              <div style={{ fontSize:10, color:C.textSecondary, marginBottom:8 }}>Remaining balance by year</div>
              {result.inf > 0 && (
                <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap" }}>
                  {[{ color:C.blue, label:"Nominal Balance" },{ color:C.green, label:"Real Balance (today's $)" }].map((l,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.textSecondary }}>
                      <span style={{ width:12, height:3, background:l.color, borderRadius:2, display:"inline-block" }}/>{l.label}
                    </div>
                  ))}
                </div>
              )}
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={result.chartData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
                  <YAxis tick={{ fill:C.textMuted, fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>"$"+Math.round(v/1000)+"k"}/>
                  <Tooltip formatter={(v,n)=>["$"+Math.round(v).toLocaleString("en-CA"), n]} contentStyle={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, fontFamily:"inherit", fontSize:12 }}/>
                  <Line type="monotone" dataKey="Balance"      stroke={C.blue}  strokeWidth={2} dot={false} name="Nominal Balance"/>
                  {result.inf > 0 && <Line type="monotone" dataKey="Real Balance" stroke={C.green} strokeWidth={2} dot={false} strokeDasharray="5 3" name="Real Balance"/>}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>)}
        </div>
      </div>
    );
  }

  // ── Sub-tab 2: Property Transfer Tax ──────────────────────────────────────
  function TransferTax() {
    const [province, setProvince] = useState("QC");
    const [price,    setPrice]    = useState("");
    const [assess,   setAssess]   = useState("");
    const [result,   setResult]   = useState(null);

    // Simplified transfer tax rules by province (2024)
    const PROV_TAX = {
      QC:  { name:"Québec (Welcome Tax)", calc: p => {
        const a = parseFloat(p)||0;
        if (a <= 58900)     return a * 0.005;
        if (a <= 294600)    return 58900*0.005 + (a-58900)*0.01;
        if (a <= 552300)    return 58900*0.005 + (294600-58900)*0.01 + (a-294600)*0.015;
        if (a <= 1104100)   return 58900*0.005 + (294600-58900)*0.01 + (552300-294600)*0.015 + (a-552300)*0.02;
        if (a <= 2000000)   return 58900*0.005 + (294600-58900)*0.01 + (552300-294600)*0.015 + (1104100-552300)*0.02 + (a-1104100)*0.025;
        return               58900*0.005 + (294600-58900)*0.01 + (552300-294600)*0.015 + (1104100-552300)*0.02 + (2000000-1104100)*0.025 + (a-2000000)*0.03;
      }},
      ON: { name:"Ontario Land Transfer Tax", calc: p => {
        const a = parseFloat(p)||0;
        if (a <= 55000)    return a * 0.005;
        if (a <= 250000)   return 55000*0.005 + (a-55000)*0.01;
        if (a <= 400000)   return 55000*0.005 + (250000-55000)*0.01 + (a-250000)*0.015;
        if (a <= 2000000)  return 55000*0.005 + (250000-55000)*0.01 + (400000-250000)*0.015 + (a-400000)*0.02;
        return              55000*0.005 + (250000-55000)*0.01 + (400000-250000)*0.015 + (2000000-400000)*0.02 + (a-2000000)*0.025;
      }},
      BC: { name:"BC Property Transfer Tax", calc: p => {
        const a = parseFloat(p)||0;
        if (a <= 200000)   return a * 0.01;
        if (a <= 2000000)  return 200000*0.01 + (a-200000)*0.02;
        if (a <= 3000000)  return 200000*0.01 + (2000000-200000)*0.02 + (a-2000000)*0.03;
        return              200000*0.01 + (2000000-200000)*0.02 + (3000000-2000000)*0.03 + (a-3000000)*0.05;
      }},
      AB: { name:"Alberta (No transfer tax)", calc: () => 0 },
      MB: { name:"Manitoba Land Transfer Tax", calc: p => {
        const a = parseFloat(p)||0;
        if (a <= 30000)    return 0;
        if (a <= 90000)    return (a-30000)*0.005;
        if (a <= 150000)   return (90000-30000)*0.005 + (a-90000)*0.01;
        if (a <= 200000)   return (90000-30000)*0.005 + (150000-90000)*0.01 + (a-150000)*0.015;
        return              (90000-30000)*0.005 + (150000-90000)*0.01 + (200000-150000)*0.015 + (a-200000)*0.02;
      }},
      SK: { name:"Saskatchewan (Title fee only)", calc: p => Math.min(parseFloat(p)||0, 1000000) * 0.003 },
      NS: { name:"Nova Scotia Deed Transfer Tax", calc: p => (parseFloat(p)||0) * 0.015 },
      NB: { name:"New Brunswick Transfer Tax", calc: p => (parseFloat(p)||0) * 0.01 },
      PE: { name:"PEI Real Property Transfer Tax", calc: p => (parseFloat(p)||0) * 0.01 },
      NL: { name:"Newfoundland (No provincial tax)", calc: () => 0 },
    };

    function calc() {
      const p = parseFloat(price);
      const a = parseFloat(assess) || p;
      if (!p) return;
      const base = PROV_TAX[province].calc(p.toString());
      const onAssess = assess ? PROV_TAX[province].calc(a.toString()) : null;
      setResult({ base, onAssess, prov: PROV_TAX[province].name });
    }

    const fmt = v => "$" + Math.round(v).toLocaleString("en-CA");

    return (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Estimated Transfer Tax</div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:6 }}>Province</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {Object.keys(PROV_TAX).map(p=>(
                <button key={p} onClick={()=>setProvince(p)} style={{ background:province===p?C.yellow:C.surface2, color:province===p?"#000":C.textSecondary, border:`1px solid ${province===p?C.yellow:C.border2}`, borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{p}</button>
              ))}
            </div>
          </div>

          <MortField label="Purchase Price"                  value={price}  set={setPrice}  ph="e.g. 650,000"/>
          <MortField label="Municipal Assessment (optional)" value={assess} set={setAssess} ph="Leave blank to use purchase price"/>

          <button onClick={calc} style={{ width:"100%", background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Calculate</button>
          <div style={{ marginTop:10, fontSize:10, color:C.textMuted }}>Estimates only — consult a notary for exact figures. Municipal surcharges (e.g. Montreal) not included.</div>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          {!result ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12, minHeight:180 }}>
              <div style={{ fontSize:28 }}>🏛️</div>
              <div style={{ fontSize:14, color:C.textSecondary, textAlign:"center" }}>Select a province and enter a purchase price</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>{result.prov}</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(36px,7vw,60px)", fontWeight:700, color:C.red, lineHeight:1, letterSpacing:"-1px", marginBottom:12 }}>
                {fmt(result.base)}
              </div>
              {result.onAssess != null && result.onAssess !== result.base && (
                <div style={{ fontSize:12, color:C.textSecondary, marginBottom:12 }}>On assessment value: <strong style={{ color:C.yellow }}>{fmt(result.onAssess)}</strong></div>
              )}
              <div style={{ fontSize:11, color:C.textMuted, background:C.surface2, borderRadius:8, padding:"10px 14px", lineHeight:1.6 }}>
                This is an estimate based on provincial tax brackets only. Municipal taxes, first-time buyer rebates, and notary fees are not included.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Sub-tab 3: Borrowing Capacity ─────────────────────────────────────────
  function BorrowingCapacity() {
    const [payment,  setPayment]  = useState("");
    const [freq,     setFreq]     = useState("monthly");
    const [rate,     setRate]     = useState("");
    const [amort,    setAmort]    = useState("");
    const [result,   setResult]   = useState(null);

    const FREQS = { monthly:12, biweekly:26, weekly:52 };

    function calc() {
      const pmt  = parseFloat(payment);
      const r    = parseFloat(rate) / 100;
      const a    = parseFloat(amort);
      if (!pmt || !r || !a) return;
      const n       = FREQS[freq];
      const rn      = r / n;
      const periods = a * n;
      // PV of annuity
      const pv      = pmt * (1 - Math.pow(1+rn, -periods)) / rn;
      setResult({ pv, totalPaid: pmt * periods, totalInt: pmt * periods - pv });
    }

    const fmt = v => "$" + Math.round(v).toLocaleString("en-CA");

    return (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Calculate Borrowing Capacity</div>
          <div style={{ fontSize:11, color:C.textSecondary, marginBottom:16 }}>How much can you borrow based on your payment budget?</div>

          <MortField label="Payment Amount"           value={payment} set={setPayment} ph="e.g. 2,000"/>
          <MortField label="Annual Interest Rate (%)" value={rate}    set={setRate}    ph="e.g. 4.5" isSmall/>
          <MortField label="Amortization (Years)"     value={amort}   set={setAmort}   ph="e.g. 25"  isSmall/>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>Payment Frequency</div>
            <div style={{ display:"flex", gap:6 }}>
              {["monthly","biweekly","weekly"].map(f=>(
                <button key={f} onClick={()=>setFreq(f)} style={{ flex:1, background:freq===f?C.yellow:C.surface2, color:freq===f?"#000":C.textSecondary, border:`1px solid ${freq===f?C.yellow:C.border2}`, borderRadius:7, padding:"7px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize" }}>{f}</button>
              ))}
            </div>
          </div>

          <button onClick={calc} style={{ width:"100%", background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Calculate</button>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          {!result ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12, minHeight:180 }}>
              <div style={{ fontSize:28 }}>💰</div>
              <div style={{ fontSize:14, color:C.textSecondary, textAlign:"center" }}>Enter your budget to see your maximum mortgage</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Maximum Mortgage Amount</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(44px,8vw,72px)", fontWeight:700, color:C.green, lineHeight:1, letterSpacing:"-1px", marginBottom:16 }}>
                {fmt(result.pv)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                {[
                  { label:"Total Payments",   val:fmt(result.totalPaid), color:C.white },
                  { label:"Total Interest",   val:fmt(result.totalInt),  color:C.red   },
                  { label:"Interest Share",   val:`${((result.totalInt/result.totalPaid)*100).toFixed(1)}%`, color:C.yellow },
                  { label:"Payment Budget",   val:"$"+parseFloat(payment).toFixed(2)+"/"+freq.replace("biweekly","2wk"), color:C.blue },
                ].map((s,i)=>(
                  <div key={i}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14, fontSize:10, color:C.textMuted, background:C.surface2, borderRadius:8, padding:"8px 12px" }}>
                This is a mathematical estimate. Actual borrowing capacity depends on income, credit score, GDS/TDS ratios, and lender policies.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }


  // ── Sub-tab 4: Debt Load Impact Calculator ────────────────────────────────
  function DebtImpact() {
    const debtResultsRef = React.useRef(null);
    const [income,    setIncome]    = useState("");
    const [homePrice, setHomePrice] = useState("");
    const [downPct,   setDownPct]   = useState("20");
    const [mortRate,  setMortRate]  = useState("5.5");
    const [amort,     setAmort]     = useState("25");
    const [propTax,   setPropTax]   = useState("");
    const [heat,      setHeat]      = useState("150");
    const [condoFee,  setCondoFee]  = useState("0");
    const [isCondo,   setIsCondo]   = useState(false);
    const [student,   setStudent]   = useState("0");
    const [carLoan,   setCarLoan]   = useState("0");
    const [ccBal,     setCcBal]     = useState("0");
    const [locBal,    setLocBal]    = useState("0");
    const [support,   setSupport]   = useState("0");
    const [creditScore, setCreditScore] = useState("excellent");
    const [result,    setResult]    = useState(null);

    // Stress test: higher of contract rate + 2% or 5.25%
    const stressRate = r => Math.max(r + 2, 5.25);

    // Monthly mortgage payment
    function mortPayment(principal, annualRate, amortYears, paymentsPerYear = 12) {
      const r = annualRate / 100 / paymentsPerYear;
      const n = amortYears * paymentsPerYear;
      if (Math.abs(r) < 1e-10) return principal / n;
      return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }

    // Reverse-solve: given max monthly PITI, what's the max loan?
    function maxLoan(maxMonthlyPITI, taxMo, heatMo, condoMo, annualRate, amortYears) {
      const availForMortgage = maxMonthlyPITI - taxMo - heatMo - condoMo / 2;
      if (availForMortgage <= 0) return 0;
      const r = annualRate / 100 / 12;
      const n = amortYears * 12;
      if (Math.abs(r) < 1e-10) return availForMortgage * n;
      return availForMortgage * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
    }

    // Credit score capacity multiplier
    const creditMult = { excellent: 1.0, good: 0.95, fair: 0.90 };
    const creditLabel = { excellent: "Excellent (760+)", good: "Good (660–759)", fair: "Fair (<660)" };
    const creditDelta = { excellent: "+0%", good: "−5%", fair: "−10%" };

    function calc() {
      const grossIncome  = parseFloat(income) || 0;
      const r            = parseFloat(mortRate) || 5.5;
      const sr           = stressRate(r);
      const a            = parseFloat(amort) || 25;
      const dp           = parseFloat(downPct) || 20;
      const hp           = parseFloat(homePrice) || 0;
      if (!grossIncome) return;

      const monthlyIncome = grossIncome / 12;
      const maxGDS        = monthlyIncome * 0.39;
      const maxTDS        = monthlyIncome * 0.44;

      // Monthly debt payments
      const studentMo  = parseFloat(student)  || 0;
      const carMo      = parseFloat(carLoan)  || 0;
      const ccMo       = (parseFloat(ccBal)   || 0) * 0.03;
      const locMo      = (parseFloat(locBal)  || 0) * 0.03;
      const supportMo  = parseFloat(support)  || 0;
      const totalDebt  = studentMo + carMo + ccMo + locMo + supportMo;

      // Derive property tax and heat
      const heatMo     = parseFloat(heat) || 150;
      const condoMo    = parseFloat(condoFee) || 0;

      // Compute scenarios
      const mult = creditMult[creditScore] || 1.0;

      function scenario(extraDebt, taxOverride) {
        // GDS limit: PITI + ½ condo ≤ 39% gross
        // TDS limit: PITI + ½ condo + all debt ≤ 44% gross
        // Use stress-tested rate to find max loan
        const loanGDS = maxLoan(maxGDS, taxOverride / 12, heatMo, condoMo, sr, a);
        const loanTDS = maxLoan(maxTDS - extraDebt, taxOverride / 12, heatMo, condoMo, sr, a);
        const loan    = Math.max(0, Math.min(loanGDS, loanTDS) * mult);
        const price   = loan / (1 - dp / 100);
        const tax     = price * 0.01; // fallback ~1%
        const cmhc    = dp < 20 ? loan * (dp < 5 ? 0.04 : dp < 10 ? 0.031 : 0.028) : 0;
        const pmt     = mortPayment(loan + cmhc, r, a);
        const piti    = pmt + tax / 12 + heatMo + condoMo / 2;
        const gds     = (piti / monthlyIncome) * 100;
        const tds     = ((piti + extraDebt) / monthlyIncome) * 100;
        return { price, loan, pmt, gds, tds, cmhc };
      }

      // Auto-derive property tax
      const taxAnnual = parseFloat(propTax) || 0;

      // Baseline: no existing debt
      const base    = scenario(0, taxAnnual);
      // With all existing debt
      const withAll = scenario(totalDebt, taxAnnual);
      // Per-debt marginal scenarios
      const withStudent  = scenario(studentMo,             taxAnnual);
      const withCar      = scenario(studentMo + carMo,     taxAnnual);
      const withCC       = scenario(studentMo + carMo + ccMo, taxAnnual);
      const withLoc      = scenario(studentMo + carMo + ccMo + locMo, taxAnnual);
      const withSupport  = scenario(totalDebt,             taxAnnual);
      const withCredit   = scenario(totalDebt,             taxAnnual); // already includes mult

      // Debt payoff insight: paying off CC
      const noCC    = scenario(studentMo + carMo + locMo + supportMo, taxAnnual);
      const ccGain  = noCC.price - withAll.price;
      const locGain = scenario(studentMo + carMo + ccMo + supportMo, taxAnnual).price - withAll.price;

      setTimeout(() => debtResultsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
      setResult({
        base, withAll, withStudent, withCar, withCC, withLoc, withSupport, withCredit,
        totalDebt, ccMo, locMo, ccGain, locGain,
        studentMo, carMo, supportMo,
        dp, mult, creditScore, sr,
        rows: [
          { label: "Debt-free baseline",           price: base.price,       gds: base.gds,     tds: base.tds,     delta: null },
          studentMo > 0 ? { label: `+ $${Math.round(studentMo).toLocaleString("en-CA")}/mo student loan`,  price: withStudent.price,  gds: withStudent.gds,  tds: withStudent.tds,  delta: withStudent.price - base.price } : null,
          carMo > 0     ? { label: `+ $${Math.round(carMo).toLocaleString("en-CA")}/mo car loan`,          price: withCar.price,      gds: withCar.gds,      tds: withCar.tds,      delta: withCar.price - withStudent.price } : null,
          ccMo > 0      ? { label: `+ 3% of $${Math.round(parseFloat(ccBal)||0).toLocaleString("en-CA")} CC balance`,  price: withCC.price,  gds: withCC.gds,   tds: withCC.tds,   delta: withCC.price - withCar.price } : null,
          locMo > 0     ? { label: `+ 3% of $${Math.round(parseFloat(locBal)||0).toLocaleString("en-CA")} LOC balance`, price: withLoc.price, gds: withLoc.gds,  tds: withLoc.tds,  delta: withLoc.price - withCC.price } : null,
          supportMo > 0 ? { label: `+ $${Math.round(supportMo).toLocaleString("en-CA")}/mo support payments`, price: withSupport.price, gds: withSupport.gds, tds: withSupport.tds, delta: withSupport.price - withLoc.price } : null,
          creditScore !== "excellent" ? { label: `Credit score: ${creditLabel[creditScore]}`, price: withCredit.price, gds: withCredit.gds, tds: withCredit.tds, delta: null, isCreditRow: true } : null,
        ].filter(Boolean),
      });
    }

    const fmt  = v => "$" + Math.round(Math.max(v, 0)).toLocaleString("en-CA");
    const fmtK = v => v >= 0 ? `+$${Math.round(v/1000)}K` : `−$${Math.round(Math.abs(v)/1000)}K`;

    return (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
        {/* ── Input panel ── */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Debt Load Impact Calculator</div>
          <div style={{ fontSize:11, color:C.textSecondary, marginBottom:20 }}>See how existing debt reduces your maximum home price using Canadian GDS/TDS rules</div>

          {/* Income & Property */}
          <div style={{ fontSize:11, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:12 }}>Income & Property</div>
          <DebtField label="Gross Annual Income *" value={income} set={setIncome} ph="e.g. 120,000"/>
          <DebtField label="Down Payment (%)" value={downPct} set={setDownPct} ph="e.g. 20" isSmall/>
          <DebtField label="Home Price (optional — leave blank to auto-solve)" value={homePrice} set={setHomePrice} ph="Auto-calculated"/>
          <DebtField label="Mortgage Rate (%)" value={mortRate} set={setMortRate} ph="e.g. 5.5" isSmall/>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:4 }}>Amortization (Years)</div>
            <div style={{ display:"flex", gap:6 }}>
              {["25","30"].map(y => (
                <button key={y} onClick={()=>setAmort(y)} style={{ flex:1, padding:"8px", borderRadius:7, border:`1px solid ${amort===y ? C.yellow : C.border2}`, background:amort===y ? C.yellow : C.surface2, color:amort===y ? "#000" : C.textSecondary, fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>{y} years</button>
              ))}
            </div>
          </div>
          <DebtField label="Annual Property Tax (leave blank for ~1% estimate)" value={propTax} set={setPropTax} ph="e.g. 6,000"/>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:4 }}>Monthly Energy Bill ($)</div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:6 }}>Gas, electricity, heating oil — lenders use $100–200/mo if unknown</div>
            <DebtField label="" value={heat} set={setHeat} ph="e.g. 150" isSmall/>
          </div>
          <div style={{ marginBottom:12 }}>
            <button onClick={() => { setIsCondo(v => !v); if (isCondo) setCondoFee("0"); }} style={{ display:"flex", alignItems:"center", gap:10, background:"none", border:`1px solid ${isCondo ? C.yellow : C.border2}`, borderRadius:8, padding:"9px 14px", cursor:"pointer", fontFamily:"inherit", width:"100%", textAlign:"left" }}>
              <span style={{ width:16, height:16, borderRadius:4, border:`2px solid ${isCondo ? C.yellow : C.textMuted}`, background:isCondo ? C.yellow : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:10, color:"#000", fontWeight:700 }}>{isCondo ? "✓" : ""}</span>
              <span style={{ fontSize:12, fontWeight:600, color:isCondo ? C.yellow : C.textSecondary }}>I'm buying a condo or apartment</span>
            </button>
            {isCondo && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Lenders count half your monthly fee toward your debt ratios</div>
                <DebtField label="" value={condoFee} set={setCondoFee} ph="e.g. 500" isSmall/>
              </div>
            )}
          </div>

          {/* Existing Debt */}
          <div style={{ fontSize:11, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", margin:"20px 0 12px" }}>Existing Monthly Debt Payments</div>
          <DebtField label="Student Loans ($/mo)" value={student} set={setStudent} ph="e.g. 400" isSmall/>
          <DebtField label="Car Loans ($/mo)" value={carLoan} set={setCarLoan} ph="e.g. 500" isSmall/>
          <DebtField label="Credit Card Balance ($) — 3% used as min payment" value={ccBal} set={setCcBal} ph="e.g. 10,000"/>
          <DebtField label="Line of Credit Balance ($) — 3% used" value={locBal} set={setLocBal} ph="e.g. 5,000"/>
          <DebtField label="Child / Spousal Support ($/mo)" value={support} set={setSupport} ph="e.g. 0" isSmall/>

          {/* Credit Score */}
          <div style={{ fontSize:11, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", margin:"20px 0 12px" }}>Credit Score</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
            {[["excellent","Excellent (760+)","Full capacity"],["good","Good (660–759)","−5% capacity"],["fair","Fair (<660)","−10% capacity"]].map(([val, label, note]) => (
              <button key={val} onClick={() => setCreditScore(val)} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"10px 14px", borderRadius:10, border:`1px solid ${creditScore===val ? C.yellow : C.border2}`,
                background: creditScore===val ? `${C.yellow}15` : C.surface2,
                cursor:"pointer", fontFamily:"inherit", textAlign:"left",
              }}>
                <span style={{ fontSize:12, fontWeight:600, color: creditScore===val ? C.yellow : C.textPrimary }}>{label}</span>
                <span style={{ fontSize:11, color:C.textMuted }}>{note}</span>
              </button>
            ))}
          </div>

          <button onClick={calc} style={{ width:"100%", background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            Calculate Impact
          </button>
          <div style={{ marginTop:10, fontSize:10, color:C.textMuted, lineHeight:1.6 }}>
            Uses OSFI stress test (contract rate +2%, min 5.25%). GDS ≤39% · TDS ≤44%. For guidance only — consult a mortgage broker for qualification.
          </div>
        </div>

        {/* ── Results panel ── */}
        <div ref={debtResultsRef} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!result ? (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, minHeight:300 }}>
              <div style={{ fontSize:32 }}>🏡</div>
              <div style={{ fontSize:14, fontWeight:600, color:C.textPrimary, textAlign:"center" }}>Enter your income and debt to see your max home price</div>
              <div style={{ fontSize:12, color:C.textMuted, textAlign:"center", maxWidth:260, lineHeight:1.6 }}>Each debt row shows exactly how much it reduces your buying power</div>
            </div>
          ) : (<>
            {/* Hero */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>
                Maximum Home Price · Stress-Tested at {result.sr.toFixed(2)}%
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap", marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>With all debts</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(36px,7vw,60px)", fontWeight:700, color:C.yellow, lineHeight:1, letterSpacing:"-1px" }}>
                    {fmt(result.withAll.price)}
                  </div>
                </div>
                <div style={{ paddingBottom:6 }}>
                  <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>Debt-free baseline</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:700, color:C.green, letterSpacing:"-.5px" }}>
                    {fmt(result.base.price)}
                  </div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                {[
                  { label:"Debt Cost",      val:fmt(result.base.price - result.withAll.price), color:C.red,    note:"Home price lost to debt" },
                  { label:"GDS Ratio",      val:`${result.withAll.gds.toFixed(1)}%`,           color:result.withAll.gds > 39 ? C.red : C.green, note:"Limit: 39%" },
                  { label:"TDS Ratio",      val:`${result.withAll.tds.toFixed(1)}%`,           color:result.withAll.tds > 44 ? C.red : C.green, note:"Limit: 44%" },
                ].map((s,i) => (
                  <div key={i} style={{ padding:"10px 0" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                    <div style={{ fontSize:10, color:C.textMuted }}>{s.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Debt impact table */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Debt-by-Debt Breakdown</div>
              <div style={{ fontSize:10, color:C.textSecondary, marginBottom:16 }}>How each debt reduces your maximum home price</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.border2}` }}>
                      {["Scenario","Max Home Price","GDS","TDS","Impact"].map((h,i) => (
                        <th key={i} style={{ padding:"8px 10px", textAlign:i===0?"left":"right", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".08em", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background: row.isCreditRow ? `${C.purple}08` : i===0 ? `${C.green}08` : "transparent" }}>
                        <td style={{ padding:"10px 10px", color: i===0 ? C.green : row.isCreditRow ? C.purple : C.textPrimary, fontWeight: i===0 ? 700 : 500, fontSize:12 }}>{row.label}</td>
                        <td style={{ padding:"10px 10px", textAlign:"right", fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:700, color: i===0 ? C.green : C.textPrimary }}>{fmt(row.price)}</td>
                        <td style={{ padding:"10px 10px", textAlign:"right", color:row.gds > 39 ? C.red : C.textSecondary, fontSize:11 }}>{row.gds.toFixed(1)}%</td>
                        <td style={{ padding:"10px 10px", textAlign:"right", color:row.tds > 44 ? C.red : C.textSecondary, fontSize:11 }}>{row.tds.toFixed(1)}%</td>
                        <td style={{ padding:"10px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                          {row.delta != null ? (
                            <span style={{ fontSize:12, fontWeight:700, color:C.red, background:C.redBg, borderRadius:5, padding:"2px 8px" }}>
                              {fmtK(row.delta)}
                            </span>
                          ) : i===0 ? (
                            <span style={{ fontSize:11, color:C.textMuted }}>baseline</span>
                          ) : (
                            <span style={{ fontSize:12, fontWeight:700, color:C.purple, background:`${C.purple}15`, borderRadius:5, padding:"2px 8px" }}>
                              {fmtK(result.withCredit.price - result.withSupport.price)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Debt payoff simulator */}
            {(result.ccGain > 0 || result.locGain > 0) && (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px" }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>💡 Debt Payoff Simulator</div>
                <div style={{ fontSize:10, color:C.textSecondary, marginBottom:14 }}>Paying off these debts before buying would unlock additional home price</div>
                {[
                  result.ccMo > 0  && { label:`Pay off $${Math.round(parseFloat(ccBal)||0).toLocaleString("en-CA")} credit card balance`, gain:result.ccGain,  color:C.green },
                  result.locMo > 0 && { label:`Pay off $${Math.round(parseFloat(locBal)||0).toLocaleString("en-CA")} line of credit`,      gain:result.locGain, color:C.blue  },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:C.surface2, borderRadius:10, marginBottom:8, gap:12, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:C.textPrimary, flex:1 }}>{item.label}</span>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:700, color:item.color, whiteSpace:"nowrap" }}>
                      → +{fmt(item.gain)} buying power
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* CMHC note */}
            {result.dp < 20 && (
              <div style={{ background:`${C.yellow}10`, border:`1px solid ${C.yellow}30`, borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.yellow, marginBottom:4 }}>⚠ CMHC Insurance Required</div>
                <div style={{ fontSize:11, color:C.textSecondary, lineHeight:1.6 }}>
                  Down payment under 20% requires CMHC mortgage insurance. Premium added to your loan:
                  {result.withAll.cmhc > 0 ? ` ${fmt(result.withAll.cmhc)} (${result.dp < 5 ? "4.00" : result.dp < 10 ? "3.10" : "2.80"}% of insured loan)` : " N/A at this home price."} Max insured home price is $1.5M.
                </div>
              </div>
            )}
          </>)}
        </div>
      </div>
    );
  }


  const SUBS = ["Mortgage Payment", "Transfer Tax", "Borrowing Capacity", "Debt Impact"];

  return (
    <div className={`reveal ${vis?"in":""}`}>
      <div style={{ display:"flex", gap:8, marginBottom:20, overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:4, scrollbarWidth:"none" }}>
        {SUBS.map((s,i) => (
          <button key={i} onClick={()=>setSub(i)} style={{
            background: sub===i ? C.surface2 : "transparent",
            border:     `1px solid ${sub===i ? C.border2 : C.border}`,
            color:      sub===i ? C.textPrimary : C.textMuted,
            borderRadius:10, padding:"8px 18px", fontSize:12, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit", transition:"all .15s",
            whiteSpace:"nowrap", flexShrink:0,
          }}>{s}</button>
        ))}
      </div>
      {sub===0 ? <MortgagePayment/> : sub===1 ? <TransferTax/> : sub===2 ? <BorrowingCapacity/> : <DebtImpact/>}
    </div>
  );
}

// ── Retirement Calculator ─────────────────────────────────────────────────────
function RetirementTab({ vis, liveCpi }) {
  const retResultsRef = React.useRef(null);
  const [savings,    setSavings]   = useState("");
  const [monthly,    setMonthly]   = useState("");
  const [retReturn,  setRetReturn] = useState("5");
  const [inflRate,   setInflRate]  = useState("");
  const [mode,       setMode]      = useState("howlong");
  const [targetYrs,  setTargetYrs] = useState("25");
  const [result,     setResult]    = useState(null);

  useEffect(() => {
    if (liveCpi != null && inflRate === "") setInflRate(liveCpi.toFixed(1));
  }, [liveCpi]); // eslint-disable-line

  const fmt = v => "$" + Math.round(Math.max(v, 0)).toLocaleString("en-CA");

  function calculate() {
    const S   = parseFloat(savings)   || 0;
    const W   = parseFloat(monthly)   || 0;
    const r   = parseFloat(retReturn) / 100 / 12;
    const inf = parseFloat(inflRate)  / 100 / 12;
    if (!S || !W) return;

    const rReal = (1 + r) / (1 + inf) - 1;
    const MAX   = 100 * 12;

    if (mode === "howlong") {
      let balNom = S, balReal = S, moN = 0, moR = 0;
      const chartData = [];

      // Nominal depletion
      let bn = S;
      while (bn > 0 && moN < MAX) { bn = bn * (1 + r) - W; moN++; }
      // Real depletion
      let br = S;
      while (br > 0 && moR < MAX) { br = br * (1 + rReal) - W; moR++; }

      const nomYearsNum  = bn  > 0 ? null : moN / 12;
      const realYearsNum = br > 0 ? null : moR / 12;
      const nomYears     = bn  > 0 ? "Never runs out" : `${(moN/12).toFixed(1)} yrs`;
      const realYears    = br > 0 ? "Never runs out" : `${(moR/12).toFixed(1)} yrs`;

      // Chart: simulate both balances year by year
      let cn = S, cr = S;
      const years = Math.ceil(Math.max(moN, moR) / 12) || 30;
      for (let yr = 1; yr <= Math.min(years, 100); yr++) {
        for (let m = 0; m < 12; m++) {
          cn = Math.max(cn * (1 + r) - W, 0);
          cr = Math.max(cr * (1 + rReal) - W, 0);
        }
        chartData.push({ year:`Yr ${yr}`, "Nominal":+cn.toFixed(0), "Real (today's $)":+cr.toFixed(0) });
        if (cn <= 0 && cr <= 0) break;
      }

      setTimeout(() => retResultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
      setResult({ mode, nomYears, realYears, nomYearsNum, realYearsNum, chartData, S, W, inf, r });

    } else {
      const n       = parseFloat(targetYrs) * 12;
      const maxNom  = Math.abs(r)     < 1e-10 ? S / n : S * r     / (1 - Math.pow(1 + r,     -n));
      const maxReal = Math.abs(rReal) < 1e-10 ? S / n : S * rReal / (1 - Math.pow(1 + rReal, -n));

      let bal = S;
      const chartData = [];
      for (let yr = 1; yr <= parseFloat(targetYrs); yr++) {
        for (let m = 0; m < 12; m++) bal = Math.max(bal * (1 + r) - maxNom, 0);
        chartData.push({ year:`Yr ${yr}`, "Balance":+bal.toFixed(0) });
      }

      setTimeout(() => retResultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
      setResult({ mode, maxNom, maxReal, targetYrs, chartData, S, inf });
    }
  }

  const EXAMPLES = [
    { label:"$500K · withdraw $2,500/mo",  savings:"500000",  monthly:"2500" },
    { label:"$1M · withdraw $4,000/mo",    savings:"1000000", monthly:"4000" },
    { label:"$250K · withdraw $1,500/mo",  savings:"250000",  monthly:"1500" },
  ];

  return (
    <div className={`reveal ${vis?"in":""}`}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>

        {/* ── Inputs ── */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Retirement Calculator</div>
          <div style={{ fontSize:11, color:C.textSecondary, marginBottom:16 }}>See how long your savings will last — adjusted for inflation</div>

          <div style={{ display:"flex", background:C.surface2, borderRadius:10, padding:3, border:`1px solid ${C.border}`, marginBottom:20 }}>
            {[["howlong","How long will it last?"],["howmuch","How much can I withdraw?"]].map(([val,lbl])=>(
              <button key={val} onClick={()=>{ setMode(val); setResult(null); }} style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"none", fontFamily:"inherit", fontSize:11, fontWeight:600, cursor:"pointer", transition:"all .15s", background:mode===val?C.yellow:"transparent", color:mode===val?"#000":C.textSecondary }}>{lbl}</button>
            ))}
          </div>

          <CalcField label="Total Retirement Savings ($)"   value={savings}   onChange={setSavings}   placeholder="e.g. 500,000"/>
          <CalcField label="Monthly Withdrawal ($)"         value={monthly}   onChange={setMonthly}   placeholder="e.g. 2,500" hint="How much you plan to take out each month"/>
          <CalcField label="Expected Annual Return (%)"     value={retReturn} onChange={setRetReturn} placeholder="e.g. 5" hint="Conservative: 4–5% for balanced portfolio" isRate/>
          <CalcField label="Assumed Inflation Rate (%)"     value={inflRate}  onChange={setInflRate}  placeholder="e.g. 2.1" hint="Pre-filled from live CPI — adjust to model scenarios" isRate/>
          {mode === "howmuch" && (
            <CalcField label="Target Retirement Length (Years)" value={targetYrs} onChange={setTargetYrs} placeholder="e.g. 25" isRate/>
          )}

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Quick examples:</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {EXAMPLES.map((ex,i)=>(
                <button key={i} onClick={()=>{ setSavings(ex.savings); setMonthly(ex.monthly); }} style={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, padding:"7px 12px", fontSize:11, color:C.textSecondary, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                  ↗ {ex.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={calculate} style={{ width:"100%", background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            Calculate
          </button>
          <div style={{ marginTop:10, fontSize:10, color:C.textMuted, lineHeight:1.6 }}>
            Inflation rate pre-filled from live Statistics Canada CPI. For planning purposes only — not financial advice.
          </div>
        </div>

        {/* ── Results ── */}
        <div ref={retResultsRef} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!result ? (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, minHeight:280 }}>
              <div style={{ fontSize:32 }}>🏖️</div>
              <div style={{ fontSize:14, fontWeight:600, color:C.textPrimary, textAlign:"center" }}>Enter your savings and monthly withdrawal to see your retirement runway</div>
              <div style={{ fontSize:12, color:C.textMuted, textAlign:"center", maxWidth:260, lineHeight:1.6 }}>The inflation-adjusted view shows real purchasing power of withdrawals over time</div>
            </div>
          ) : result.mode === "howlong" ? (<>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Your money lasts</div>
              <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>Nominal</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(28px,5vw,48px)", fontWeight:700, color:C.green, lineHeight:1, letterSpacing:"-1px" }}>
                    {result.nomYears}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>Real (inflation-adjusted)</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(28px,5vw,48px)", fontWeight:700, color:C.blue, lineHeight:1, letterSpacing:"-1px" }}>
                    {result.realYears}
                  </div>
                </div>
              </div>
              {result.nomYearsNum && result.realYearsNum && (
                <div style={{ fontSize:12, color:C.textMuted, background:C.surface2, borderRadius:8, padding:"10px 14px", lineHeight:1.6, marginBottom:16 }}>
                  💡 Inflation shortens your runway by approximately <strong style={{ color:C.yellow }}>{Math.max(0, result.nomYearsNum - result.realYearsNum).toFixed(1)} years</strong> — withdrawals lose purchasing power over time.
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                {[
                  { label:"Starting Savings",   val:fmt(result.S),                            color:C.white },
                  { label:"Monthly Withdrawal", val:fmt(result.W),                            color:C.yellow },
                  { label:"Inflation Rate",     val:`${(result.inf*12*100).toFixed(1)}%/yr`,  color:C.textSecondary },
                ].map((s,i)=>(
                  <div key={i}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Savings Balance Over Time</div>
              <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>Nominal vs. real balance year by year</div>
              <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap" }}>
                {[{color:C.green,label:"Nominal"},{color:C.blue,label:"Real (today's $)"}].map((l,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.textSecondary }}>
                    <span style={{ width:12,height:3,background:l.color,borderRadius:2,display:"inline-block" }}/>{l.label}
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={result.chartData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
                  <YAxis tick={{ fill:C.textMuted, fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>"$"+Math.round(v/1000)+"k"}/>
                  <Tooltip formatter={(v,n)=>["$"+Math.round(v).toLocaleString("en-CA"),n]} contentStyle={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, fontFamily:"inherit", fontSize:12 }}/>
                  <ReferenceLine y={0} stroke={C.border}/>
                  <Line type="monotone" dataKey="Nominal"          stroke={C.green} strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="Real (today's $)" stroke={C.blue}  strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>) : (<>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>
                Max Monthly Withdrawal over {result.targetYrs} years
              </div>
              <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>Nominal</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(28px,5vw,48px)", fontWeight:700, color:C.green, lineHeight:1, letterSpacing:"-1px" }}>
                    {fmt(result.maxNom)}/mo
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>Real purchasing power</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(28px,5vw,48px)", fontWeight:700, color:C.blue, lineHeight:1, letterSpacing:"-1px" }}>
                    {fmt(result.maxReal)}/mo
                  </div>
                </div>
              </div>
              <div style={{ fontSize:12, color:C.textMuted, background:C.surface2, borderRadius:8, padding:"10px 14px", lineHeight:1.6 }}>
                💡 In today's dollars, {fmt(result.maxNom)}/mo will feel like {fmt(result.maxReal)}/mo after inflation over {result.targetYrs} years.
              </div>
            </div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Balance Drawdown</div>
              <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>Savings balance year by year at max nominal withdrawal</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={result.chartData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                  <defs><linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.2}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
                  <YAxis tick={{ fill:C.textMuted, fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>"$"+Math.round(v/1000)+"k"}/>
                  <Tooltip formatter={v=>["$"+Math.round(v).toLocaleString("en-CA"),"Balance"]} contentStyle={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, fontFamily:"inherit", fontSize:12 }}/>
                  <Area type="monotone" dataKey="Balance" stroke={C.blue} strokeWidth={2} fill="url(#retGrad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ── TFSA Calculator (module-level — no remount glitch) ────────────────────────
const TFSA_LIMITS = {
  2009:5000, 2010:5000, 2011:5000, 2012:5000, 2013:5500,
  2014:5500, 2015:10000,2016:5500, 2017:5500, 2018:5500,
  2019:6000, 2020:6000, 2021:6000, 2022:6000, 2023:6500,
  2024:7000, 2025:7000, 2026:7000,
};

function TFSACalc() {
  const [birthYear,   setBirthYear]   = useState("");
  const [contributed, setContributed] = useState("");
  const [withdrawn,   setWithdrawn]   = useState("");
  const [result,      setResult]      = useState(null);
  const fmt = v => "$" + Math.round(v).toLocaleString("en-CA");
  const currentYear = new Date().getFullYear();

  function calc() {
    const born = parseInt(birthYear);
    if (!born || born < 1900 || born > currentYear - 17) return;
    const eligible = born + 18;
    if (eligible > currentYear) { setResult({ notEligible:true, eligible }); return; }

    let room = 0;
    for (let yr = Math.max(eligible, 2009); yr <= currentYear; yr++) {
      room += TFSA_LIMITS[yr] || 7000;
    }
    const contribs   = parseFloat(contributed) || 0;
    const withdrawn_ = parseFloat(withdrawn)   || 0;
    const remaining  = room - contribs + withdrawn_;

    const chartData = [];
    let cum = 0;
    Object.entries(TFSA_LIMITS)
      .filter(([yr]) => parseInt(yr) >= Math.max(eligible,2009) && parseInt(yr) <= currentYear)
      .forEach(([yr, limit]) => { cum += limit; chartData.push({ year:yr, "Cumulative Room":cum }); });

    setResult({ room, contribs, withdrawn:withdrawn_, remaining, eligible, chartData });
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>TFSA Contribution Room</div>
        <div style={{ fontSize:11, color:C.textSecondary, marginBottom:20 }}>Calculate your total available room based on eligibility year and contribution history</div>
        <DebtField label="Year of Birth"                         value={birthYear}   set={setBirthYear}   ph="e.g. 1990" isSmall/>
        <DebtField label="Total Contributions Made to Date ($)"  value={contributed} set={setContributed} ph="e.g. 40,000"/>
        <DebtField label="Total Withdrawals Made to Date ($)"    value={withdrawn}   set={setWithdrawn}   ph="e.g. 5,000"/>
        <div style={{ marginBottom:16, background:C.surface2, borderRadius:10, padding:"12px 14px", fontSize:11, color:C.textMuted, lineHeight:1.7 }}>
          💡 TFSA withdrawals re-add to your room the following January 1. Enter lifetime withdrawals for accurate room.
        </div>
        <button onClick={calc} style={{ width:"100%", background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          Calculate Room
        </button>
        <div style={{ marginTop:10, fontSize:10, color:C.textMuted }}>
          Based on official CRA annual limits. Verify at <a href="https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account.html" target="_blank" rel="noopener noreferrer" style={{ color:C.green }}>CRA.gc.ca</a>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {!result ? (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, minHeight:220 }}>
            <div style={{ fontSize:32 }}>🏦</div>
            <div style={{ fontSize:14, color:C.textSecondary, textAlign:"center" }}>Enter your birth year to see your TFSA room</div>
          </div>
        ) : result.notEligible ? (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
            <div style={{ fontSize:14, color:C.textSecondary }}>You become eligible in <strong style={{ color:C.yellow }}>{result.eligible}</strong>. No room has accumulated yet.</div>
          </div>
        ) : (<>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Available TFSA Room</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(44px,8vw,72px)", fontWeight:700, color:result.remaining>=0?C.green:C.red, lineHeight:1, letterSpacing:"-1px", marginBottom:14 }}>
              {result.remaining>=0 ? fmt(result.remaining) : `Over by ${fmt(Math.abs(result.remaining))}`}
            </div>
            {result.remaining < 0 && (
              <div style={{ fontSize:12, color:C.red, background:C.redBg, borderRadius:8, padding:"10px 14px", marginBottom:14 }}>⚠ You may have over-contributed. Contact CRA — penalty is 1%/month on excess.</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
              {[
                { label:"Lifetime Room",     val:fmt(result.room),      color:C.white },
                { label:"Total Contributed", val:fmt(result.contribs),  color:result.contribs>result.room?C.red:C.blue },
                { label:"Withdrawals Added", val:fmt(result.withdrawn), color:C.green },
              ].map((s,i)=>(
                <div key={i}>
                  <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px" }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Cumulative Room by Year</div>
            <div style={{ fontSize:10, color:C.textSecondary, marginBottom:12 }}>Total TFSA room accumulated since eligibility</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={result.chartData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                <defs><linearGradient id="tfsaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.2}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false} interval="preserveStartEnd" minTickGap={40}/>
                <YAxis tick={{ fill:C.textMuted, fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>"$"+Math.round(v/1000)+"k"}/>
                <Tooltip formatter={v=>["$"+Math.round(v).toLocaleString("en-CA"),"Cumulative Room"]} contentStyle={{ background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, fontFamily:"inherit", fontSize:12 }}/>
                <Area type="stepAfter" dataKey="Cumulative Room" stroke={C.green} strokeWidth={2} fill="url(#tfsaGrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── RRSP Calculator (module-level) ────────────────────────────────────────────
const PROV_RATES = {
  BC:{ name:"BC",  rates:[[0,15],[57375,22.7],[114750,28.2],[165430,31.0],[235675,43.7],[284124,46.86],[410670,53.5]] },
  AB:{ name:"AB",  rates:[[0,15],[57375,20.5],[114750,30.5],[165430,36.0],[235675,42.3]] },
  SK:{ name:"SK",  rates:[[0,18.5],[49720,25.5],[114750,33.5],[235675,44.79]] },
  MB:{ name:"MB",  rates:[[0,25.8],[36842,27.75],[79625,32.75],[114750,39.65],[235675,47.94]] },
  ON:{ name:"ON",  rates:[[0,20.05],[51446,24.15],[102894,29.65],[150000,31.48],[220000,33.89],[235675,43.41],[500000,53.53]] },
  QC:{ name:"QC",  rates:[[0,26.53],[51780,31.53],[103545,37.12],[114750,42.37],[235675,47.46]] },
  NB:{ name:"NB",  rates:[[0,23.84],[47715,28.34],[95431,33.34],[176756,38.34],[235675,47.63]] },
  NS:{ name:"NS",  rates:[[0,23.79],[29590,30.95],[59180,35.98],[93000,38.67],[235675,50.0]] },
  PE:{ name:"PEI", rates:[[0,24],[32656,28.5],[64313,33.0],[235675,47.29]] },
  NL:{ name:"NL",  rates:[[0,23.2],[43198,28.7],[86395,33.7],[154244,40.2],[235675,51.3]] },
};

function RRSPCalc() {
  const [income,     setIncome]     = useState("");
  const [prevLimit,  setPrevLimit]  = useState("");
  const [pensionAdj, setPensionAdj] = useState("0");
  const [contributed,setContributed]= useState("0");
  const [province,   setProvince]   = useState("ON");
  const [result,     setResult]     = useState(null);
  const MAX_RRSP = 32490; // 2025 limit
  const fmt = v => "$" + Math.round(Math.max(v,0)).toLocaleString("en-CA");

  function getMarginalRate(inc, prov) {
    const brackets = PROV_RATES[prov]?.rates || PROV_RATES.ON.rates;
    let rate = brackets[0][1];
    for (const [threshold, r] of brackets) { if (inc >= threshold) rate = r; }
    return rate / 100;
  }

  function calc() {
    const inc  = parseFloat(income)      || 0;
    const prev = parseFloat(prevLimit)   || 0;
    const pa   = parseFloat(pensionAdj)  || 0;
    const cont = parseFloat(contributed) || 0;
    if (!inc) return;
    const newRoom  = Math.min(inc * 0.18, MAX_RRSP);
    const total    = prev + newRoom - pa;
    const remaining = Math.max(0, total - cont);
    const margRate  = getMarginalRate(inc, province);
    const taxSaving = remaining * margRate;
    setResult({ total, remaining, newRoom, prev, cont, pa, margRate, taxSaving, inc });
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:16 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>RRSP Contribution Room</div>
        <div style={{ fontSize:11, color:C.textSecondary, marginBottom:20 }}>Estimate your 2025 RRSP deduction limit and potential tax savings</div>
        <DebtField label="Earned Income — Prior Year ($)"     value={income}      set={setIncome}      ph="e.g. 95,000"/>
        <DebtField label="Prior Year's RRSP Limit ($)"        value={prevLimit}   set={setPrevLimit}   ph="e.g. 15,000" hint="From your CRA Notice of Assessment"/>
        <DebtField label="Pension Adjustment ($)"             value={pensionAdj}  set={setPensionAdj}  ph="0 if none" isSmall/>
        <DebtField label="Contributions Made This Year ($)"   value={contributed} set={setContributed} ph="e.g. 5,000"/>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>Province (for tax savings estimate)</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {Object.keys(PROV_RATES).map(p=>(
              <button key={p} onClick={()=>setProvince(p)} style={{ background:province===p?C.yellow:C.surface2, color:province===p?"#000":C.textSecondary, border:`1px solid ${province===p?C.yellow:C.border2}`, borderRadius:7, padding:"5px 10px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{p}</button>
            ))}
          </div>
        </div>
        <button onClick={calc} style={{ width:"100%", background:C.yellow, color:"#000", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          Calculate Room
        </button>
        <div style={{ marginTop:10, fontSize:10, color:C.textMuted }}>
          2025 limit: ${MAX_RRSP.toLocaleString()}. Verify at <a href="https://www.canada.ca/en/revenue-agency.html" target="_blank" rel="noopener noreferrer" style={{ color:C.green }}>CRA.gc.ca</a>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {!result ? (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, minHeight:220 }}>
            <div style={{ fontSize:32 }}>📋</div>
            <div style={{ fontSize:14, color:C.textSecondary, textAlign:"center" }}>Enter your income and prior-year limit to calculate your RRSP room</div>
          </div>
        ) : (<>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"24px 20px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Available RRSP Room (2025)</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(44px,8vw,72px)", fontWeight:700, color:C.green, lineHeight:1, letterSpacing:"-1px", marginBottom:14 }}>
              {fmt(result.remaining)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
              {[
                { label:"New Room Added (2025)", val:fmt(result.newRoom),   color:C.white },
                { label:"Prior Unused Room",     val:fmt(result.prev),      color:C.white },
                { label:"Total Deduction Limit", val:fmt(result.total),     color:C.yellow },
                { label:"Already Contributed",   val:fmt(result.cont),      color:C.blue },
                { label:"Marginal Tax Rate",      val:`${(result.margRate*100).toFixed(1)}%`, color:C.textSecondary },
                { label:"Est. Tax Savings",       val:fmt(result.taxSaving), color:C.green },
              ].map((s,i)=>(
                <div key={i}>
                  <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:s.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, fontSize:11, color:C.textMuted, background:C.surface2, borderRadius:8, padding:"10px 14px", lineHeight:1.6 }}>
              💡 Contributing {fmt(result.remaining)} to your RRSP could save approximately <strong style={{ color:C.green }}>{fmt(result.taxSaving)}</strong> in taxes at your {(result.margRate*100).toFixed(1)}% marginal rate.
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Contribution Tab (shell — sub-tabs are module-level components above) ─────
function ContributionTab({ vis }) {
  const [sub, setSub] = useState(0);
  return (
    <div className={`reveal ${vis?"in":""}`}>
      <div style={{ display:"flex", gap:8, marginBottom:20, overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:4, scrollbarWidth:"none" }}>
        {["TFSA","RRSP"].map((s,i) => (
          <button key={i} onClick={()=>setSub(i)} style={{
            background: sub===i ? C.surface2 : "transparent",
            border:     `1px solid ${sub===i ? C.border2 : C.border}`,
            color:      sub===i ? C.textPrimary : C.textMuted,
            borderRadius:10, padding:"8px 18px", fontSize:12, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit", transition:"all .15s", whiteSpace:"nowrap", flexShrink:0,
          }}>{s}</button>
        ))}
      </div>
      {sub===0 ? <TFSACalc/> : <RRSPCalc/>}
    </div>
  );
}


// ── Per-page SEO meta ────────────────────────────────────────────────────────
const PAGE_META = [
  { path:"/inflation-rates",     title:"Canadian Inflation Rates — Live CPI by Category & Province | Canadianflation",         description:"Live Canadian CPI data by category and province. Track year-over-year inflation rates for food, shelter, transport and more. Sourced directly from Statistics Canada." },
  { path:"/purchasing-power",    title:"Canadian Dollar Purchasing Power — How Inflation Erodes Your Money | Canadianflation",  description:"See how inflation has eroded the purchasing power of the Canadian dollar over time. Live data from Statistics Canada — no estimates." },
  { path:"/taylor-rule",         title:"Taylor Rule vs Bank of Canada Rate | Canadianflation",                                  description:"Compare the Bank of Canada overnight rate against the Taylor Rule prescription. Is Canadian monetary policy too tight or too easy?" },
  { path:"/interest-calculator", title:"Canadian Compound Interest Calculator | Canadianflation",                               description:"Calculate how your savings or investments grow with compound interest. Adjust rate, frequency, contributions, and time horizon." },
  { path:"/mortgage-calculator", title:"Canadian Mortgage Calculator — Payment, Tax & Borrowing | Canadianflation",             description:"Calculate Canadian mortgage payments, provincial property transfer tax, and borrowing capacity. Covers all 10 provinces with 2024 tax brackets." },
  { path:"/",                    title:"Canadianflation — Canada's Independent Inflation Tracker",                              description:"Track Canadian inflation in real time. Live CPI data from Statistics Canada, purchasing power history, Taylor Rule analysis, and free financial calculators." },
  { path:"/retirement-calculator",   title:"Canadian Retirement Calculator — How Long Will Your Money Last? | Canadianflation",    description:"Calculate how long your retirement savings will last given inflation, withdrawals, and investment returns. Uses Statistics Canada CPI data." },
  { path:"/contribution-calculator", title:"RRSP & TFSA Contribution Room Calculator Canada | Canadianflation",                    description:"Calculate your RRSP deduction limit and TFSA contribution room for 2024. Free Canadian retirement account calculator." },
];

// ── Client-side routing map ───────────────────────────────────────────────────
const ROUTES = {
  "/":                       5,
  "/inflation-rates":        0,
  "/purchasing-power":       1,
  "/taylor-rule":            2,
  "/interest-calculator":    3,
  "/mortgage-calculator":    4,
  "/retirement-calculator":  6,
  "/contribution-calculator":7,
};

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [data,        setData]        = useState(null);
  const [rawCpi,      setRawCpi]      = useState([]);
  const [catHistory,  setCatHistory]  = useState([]);
  const [provHistory, setProvHistory] = useState([]);
  const [rateData,    setRateData]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [vis,         setVis]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setVis(false);

    // ── 1. StatCan batch fetch: national CPI + 8 categories + 10 provinces ──
    try {
      const allVectorIds = [CPI_VECTOR, ...Object.values(CAT_VECTORS), ...Object.values(PROV_VECTORS)];
      const res = await fetch(`${STATCAN_BASE}/getDataFromVectorsAndLatestNPeriods`, {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body:    JSON.stringify(allVectorIds.map(id => ({ vectorId:id, latestN:600 }))),
      });
      if (!res.ok) throw new Error("StatCan failed");
      const json   = await res.json();
      const rawMap = parseBatchWDS(json);

      const mainRaw = rawMap[CPI_VECTOR];
      if (!mainRaw || mainRaw.length < 24) throw new Error("Insufficient CPI data");
      setData(computeYoY(mainRaw));
      // Seed rawCpi with live monthly data; annual fetch (step 3) will prepend 1914+
      setRawCpi(mainRaw.map(([d, v]) => [d, v]));

      const catH  = buildAnnualHistory(rawMap, CAT_KEYS,  CAT_VECTORS);
      const provH = buildAnnualHistory(rawMap, PROV_KEYS, PROV_VECTORS);
      if (catH.length  > 2) setCatHistory(catH);
      if (provH.length > 2) setProvHistory(provH);
    } catch {
      setError(true);
      setLoading(false);
      return;
    }

    // ── 2. Bank of Canada overnight rate (JSON endpoint) ─────────────────────
    try {
      const bocRes = await fetch(BOC_VALET_JSON);
      if (!bocRes.ok) throw new Error("BoC fetch failed");
      const bocJson = await bocRes.json();
      const parsed  = parseBoCValetJSON(bocJson);
      if (parsed.length > 12) setRateData(parsed);
    } catch {
      // BoC unavailable — Taylor tab shows CPI-only mode
    }

    // ── 3. StatCan annual CPI 1914–present (table 18-10-0005-01) ─────────────
    try {
      const annRes = await fetch(STATCAN_ANNUAL_CPI_URL);
      if (!annRes.ok) throw new Error("Annual CPI fetch failed");
      const annJson = await annRes.json();
      const annRaw  = parseAnnualCPI(annJson);
      if (annRaw.length > 50) {
        // Convert annual to monthly-style entries (use Jan 1 of each year)
        // then merge with live monthly data so 1914 → present is complete
        const annMonthly = annRaw.map(([d, v]) => [d.slice(0,4) + "-01-01", v]);
        setRawCpi(prev => {
          const map = {};
          // Annual data first (lower priority)
          annMonthly.forEach(([d, v]) => { map[d.slice(0,7)] = [d, v]; });
          // Monthly live data overwrites (higher priority)
          prev.forEach(([d, v]) => { map[d.slice(0,7)] = [d, v]; });
          return Object.keys(map).sort().map(k => map[k]);
        });
      }
    } catch {
      // Annual fetch failed — purchasing power chart will use monthly data only (~1975+)
    }

    setLoading(false);
    setTimeout(() => setVis(true), 60);
  }, []);

  useEffect(() => { load(); }, [load]);


  const [page, setPage] = useState(() => ROUTES[window.location.pathname.replace(/\/$/,"").replace(/^$/,"/")] ?? 0);

  const navigate = (path, idx) => {
    window.history.pushState({}, "", path);
    setPage(idx);
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  useEffect(() => {
    const handler = () => setPage(ROUTES[window.location.pathname.replace(/\/$/,"").replace(/^$/,"/")] ?? 0);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    const m = PAGE_META[page];
    if (!m) return;
    document.title = m.title;
    const setMeta = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute("content", val);
    };
    setMeta('meta[name="description"]',        m.description);
    setMeta('meta[property="og:title"]',       m.title);
    setMeta('meta[property="og:description"]', m.description);
    setMeta('meta[property="og:url"]',         "https://www.canadianflation.ca" + m.path);
    setMeta('meta[name="twitter:title"]',      m.title);
    setMeta('meta[name="twitter:description"]',m.description);
  }, [page]);

  // ── Nav state ─────────────────────────────────────────────────────────────
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [dataDropOpen, setDataDropOpen] = useState(false);
  const [calcDropOpen, setCalcDropOpen] = useState(false);

  const DATA_PAGES = [
    { label:"Inflation Rates",   path:"/inflation-rates",  idx:0, desc:"CPI by category & province" },
    { label:"Purchasing Power",  path:"/purchasing-power", idx:1, desc:"Dollar erosion over time"   },
    { label:"Taylor Rule",       path:"/taylor-rule",      idx:2, desc:"BoC rate vs prescription"   },
  ];
  const CALC_PAGES = [
    { label:"Interest Calculator",     path:"/interest-calculator",    idx:3, desc:"Compound growth calculator"     },
    { label:"Mortgage Calculator",     path:"/mortgage-calculator",    idx:4, desc:"Payments, tax & borrowing"      },
    { label:"Retirement Calculator",   path:"/retirement-calculator",  idx:6, desc:"How long will your money last?" },
    { label:"Contribution Calculator", path:"/contribution-calculator",idx:7, desc:"RRSP & TFSA room calculator"    },
  ];

  const closeAll = () => { setDataDropOpen(false); setCalcDropOpen(false); setMobileOpen(false); };

  const isDataActive = page <= 2;
  const isCalcActive = page >= 3 && page !== 5;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.textPrimary, fontFamily:"'Plus Jakarta Sans',sans-serif" }}
      onClick={() => { setDataDropOpen(false); setCalcDropOpen(false); }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Sans:wght@500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#000}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:2px}
        .reveal{opacity:0;transform:translateY(14px);transition:opacity .45s ease,transform .45s ease}
        .reveal.in{opacity:1;transform:translateY(0)}
        .rb{background:none;border:1px solid ${C.border};color:${C.textSecondary};padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;-webkit-tap-highlight-color:transparent}
        .rb.on{background:${C.yellow};border-color:${C.yellow};color:#000}
        .rb:hover:not(.on){border-color:${C.border2};color:${C.textPrimary}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{border:2px solid ${C.border};border-top-color:${C.yellow};border-radius:50%;animation:spin .7s linear infinite}
        .sub-scroll::-webkit-scrollbar{display:none}
        .nav-drop{position:absolute;top:calc(100% + 8px);left:0;background:${C.surface};border:1px solid ${C.border2};border-radius:12px;padding:6px;min-width:220px;box-shadow:0 16px 48px rgba(0,0,0,.7);z-index:200}
        .nav-drop-item{display:block;width:100%;padding:10px 14px;border-radius:8px;border:none;background:none;cursor:pointer;text-align:left;font-family:inherit;transition:background .12s}
        .nav-drop-item:hover{background:${C.surface2}}
        .hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:6px}
        .hamburger span{display:block;width:22px;height:2px;background:${C.textSecondary};border-radius:2px;transition:all .2s}
        .mobile-menu{display:none;position:fixed;inset:0;top:56px;background:${C.surface};z-index:150;overflow-y:auto;padding:20px 16px 40px}
        @media(max-width:640px){
          .hamburger{display:flex}
          .nav-links{display:none!important}
          .mobile-menu.open{display:block}
        }
        @media(max-width:480px){
          .calc-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(16px)" }}>
        {/* Wordmark */}
        <button onClick={() => { closeAll(); navigate("/", 5); }}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:0 }}>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:18, fontWeight:700, letterSpacing:"-.3px", color:C.white }}>Canadian</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:18, fontWeight:700, letterSpacing:"-.3px", color:C.red }}>flation</span>
        </button>

        {/* Desktop nav links */}
        <div className="nav-links" style={{ display:"flex", alignItems:"center", gap:4 }}>
          {/* CPI Data dropdown */}
          <div style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setDataDropOpen(v => !v); setCalcDropOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer",
                color: isDataActive ? C.yellow : C.textSecondary, fontFamily:"inherit", fontSize:13, fontWeight:600,
                padding:"8px 12px", borderRadius:8, transition:"all .15s",
              }}>
              CPI &amp; Inflation Data
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: dataDropOpen?"rotate(180deg)":"none", transition:"transform .2s" }}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {dataDropOpen && (
              <div className="nav-drop">
                {DATA_PAGES.map(p => (
                  <button key={p.idx} className="nav-drop-item" onClick={() => { navigate(p.path, p.idx); closeAll(); }}>
                    <div style={{ fontSize:13, fontWeight:600, color: page===p.idx ? C.yellow : C.textPrimary }}>{p.label}</div>
                    <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Calculators dropdown */}
          <div style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setCalcDropOpen(v => !v); setDataDropOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer",
                color: isCalcActive ? C.yellow : C.textSecondary, fontFamily:"inherit", fontSize:13, fontWeight:600,
                padding:"8px 12px", borderRadius:8, transition:"all .15s",
              }}>
              Financial Calculators
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: calcDropOpen?"rotate(180deg)":"none", transition:"transform .2s" }}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {calcDropOpen && (
              <div className="nav-drop">
                {CALC_PAGES.map(p => (
                  <button key={p.idx} className="nav-drop-item" onClick={() => { navigate(p.path, p.idx); closeAll(); }}>
                    <div style={{ fontSize:13, fontWeight:600, color: page===p.idx ? C.yellow : C.textPrimary }}>{p.label}</div>
                    <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hamburger */}
        <button className="hamburger" onClick={e => { e.stopPropagation(); setMobileOpen(v => !v); setDataDropOpen(false); setCalcDropOpen(false); }} aria-label="Menu">
          <span style={{ transform: mobileOpen?"rotate(45deg) translate(5px,5px)":"none" }}/>
          <span style={{ opacity: mobileOpen?0:1 }}/>
          <span style={{ transform: mobileOpen?"rotate(-45deg) translate(5px,-5px)":"none" }}/>
        </button>
      </nav>

      {/* ── Mobile menu ── */}
      <div className={`mobile-menu${mobileOpen?" open":""}`}>
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>CPI &amp; Inflation Data</div>
        {DATA_PAGES.map(p => (
          <button key={p.idx} onClick={() => { navigate(p.path, p.idx); closeAll(); }}
            style={{ display:"block", width:"100%", textAlign:"left", background: page===p.idx ? C.surface2 : "none",
              border:`1px solid ${page===p.idx ? C.border2 : "transparent"}`, borderRadius:10, padding:"12px 14px",
              marginBottom:6, cursor:"pointer", fontFamily:"inherit" }}>
            <div style={{ fontSize:14, fontWeight:600, color: page===p.idx ? C.yellow : C.textPrimary }}>{p.label}</div>
            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{p.desc}</div>
          </button>
        ))}
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", margin:"20px 0 10px" }}>Financial Calculators</div>
        {CALC_PAGES.map(p => (
          <button key={p.idx} onClick={() => { navigate(p.path, p.idx); closeAll(); }}
            style={{ display:"block", width:"100%", textAlign:"left", background: page===p.idx ? C.surface2 : "none",
              border:`1px solid ${page===p.idx ? C.border2 : "transparent"}`, borderRadius:10, padding:"12px 14px",
              marginBottom:6, cursor:"pointer", fontFamily:"inherit" }}>
            <div style={{ fontSize:14, fontWeight:600, color: page===p.idx ? C.yellow : C.textPrimary }}>{p.label}</div>
            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{p.desc}</div>
          </button>
        ))}
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", margin:"20px 0 10px" }}>Data</div>
      </div>

      {/* ── Page content ── */}
      <div style={{ maxWidth:980, margin:"0 auto", padding:"20px 16px 60px" }}>
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:360, gap:16 }}>
            <div className="spin" style={{ width:36, height:36 }}/>
            <p style={{ color:C.textMuted, fontSize:12, fontWeight:500 }}>Retrieving live data.</p>
          </div>
        ) : error ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:360, gap:20, textAlign:"center" }}>
            <div style={{ fontSize:32 }}>📡</div>
            <div style={{ fontSize:17, fontWeight:700, color:C.textPrimary }}>Statistics Canada is unavailable</div>
            <div style={{ fontSize:13, color:C.textSecondary, maxWidth:380, lineHeight:1.6 }}>
              We only display verified data from official sources. Please try again in a few minutes.
            </div>
            <button onClick={() => { setError(false); setLoading(true); load(); }}
              style={{ background:C.yellow, color:"#000", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Try again
            </button>
          </div>
        ) : (
          page === 5 ? <HomepageHero navigate={navigate} cur={data?.[data.length-1]}/> :
          page === 0 ? <RatesTab data={data} vis={vis} catHistory={catHistory} provHistory={provHistory}/> :
          page === 1 ? <CumulativeTab data={data} vis={vis} rawCpi={rawCpi} catHistory={catHistory} provHistory={provHistory}/> :
          page === 2 ? <TaylorTab     data={data} vis={vis} rateData={rateData}/> :
          page === 3 ? <CompoundTab          vis={vis} liveCpi={data?.[data.length-1]?.value}/> :
          page === 4 ? <MortgageTab          vis={vis} liveCpi={data?.[data.length-1]?.value}/> :
          page === 6 ? <RetirementTab        vis={vis} liveCpi={data?.[data.length-1]?.value}/> :
                       <ContributionTab      vis={vis}/>
        )}

        <div style={{ textAlign:"center", fontSize:11, color:C.textMuted, fontWeight:500, marginTop:32, paddingTop:20, borderTop:`1px solid ${C.border}`, lineHeight:1.8 }}>
          <span style={{ color:C.textSecondary, fontWeight:600 }}>Canadianflation.ca</span>
          <span style={{ margin:"0 8px", color:C.border2 }}>·</span>
          CPI data from Statistics Canada · Interest rates from the Bank of Canada
          <br/>
          <span style={{ fontSize:10 }}>Not an official government product · For informational purposes only</span>
        </div>
      </div>
    </div>
  );
}
