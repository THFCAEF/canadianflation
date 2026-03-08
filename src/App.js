import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from "recharts";

// ── Favicon: dollar sign ──────────────────────────────────────────────────────
(function setFavicon() {
  if (typeof document === "undefined") return;
  document.title = "Canadianflation — Canadian CPI Tracker";
  try {
    const sz = 64, cv = document.createElement("canvas");
    cv.width = cv.height = sz;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#E05A4A";
    ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.font = "bold 40px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 32, 33);
    const ico = document.querySelector("link[rel~='icon']") || document.createElement("link");
    ico.rel = "icon"; ico.href = cv.toDataURL();
    if (!ico.parentNode) document.head.appendChild(ico);
  } catch(e) {
    const ico = document.querySelector("link[rel~='icon']") || document.createElement("link");
    ico.rel = "icon"; ico.type = "image/svg+xml";
    ico.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%23E05A4A'/%3E%3Ctext x='32' y='46' font-size='42' font-weight='bold' text-anchor='middle' font-family='Arial' fill='%23000'%3E%24%3C/text%3E%3C/svg%3E";
    if (!ico.parentNode) document.head.appendChild(ico);
  }
  [
    { property: "og:title",       content: "Canadianflation — Canadian CPI Tracker" },
    { property: "og:description", content: "Track Canadian inflation in real time. Historical CPI data from 1914 to present, sourced from Statistics Canada." },
    { property: "og:image",       content: "https://www.canadianflation.ca/social-preview.png" },
    { property: "og:url",         content: "https://www.canadianflation.ca" },
    { name: "twitter:card",       content: "summary_large_image" },
  ].forEach(attrs => {
    const sel = attrs.property ? `meta[property="${attrs.property}"]` : `meta[name="${attrs.name}"]`;
    const el = document.querySelector(sel) || document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (!el.parentNode) document.head.appendChild(el);
  });
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

function computeCadDevaluation(yoyData) {
  let val = 1.0;
  return yoyData.map(pt => {
    val = val / (1 + pt.value / 100 / 12);
    return {
      ...pt,
      cadValue: +Math.max(val, 0.001).toFixed(4),
      lostPct:  +((1 - Math.max(val, 0)) * 100).toFixed(1),
    };
  });
}

// Parse StatCan batch WDS response → { vectorId -> [[date, val], ...] }
function parseBatchWDS(json) {
  const out = {};
  if (!Array.isArray(json)) return out;
  json.forEach(item => {
    try {
      const vid = item.object?.vectorId;
      const pts = item.object?.vectorDataPoint;
      if (vid && pts?.length)
        out[vid] = pts.map(p => [p.refPer, p.value]);
    } catch {}
  });
  return out;
}

// Parse BoC Valet JSON response → [{ date, iso, rate }, ...]
function parseBoCValetJSON(json) {
  try {
    const obs = json.observations;
    if (!Array.isArray(obs)) return [];
    return obs.map(o => {
      const date = o.d;
      const rate = parseFloat(o.STATIC_ATABLE_V39079?.v);
      if (!date || isNaN(rate)) return null;
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

// ── Fallback data (used only if StatCan API fails) ────────────────────────────
// NOTE: Category and province data from StatCan only goes back to ~1979.
// Before 1979, only the national all-items CPI (v41690973) has data.
// The fallback below covers years from 2000 onward as a degraded placeholder.
const CAT_HISTORY_FALLBACK = [
  { year:"2000", Shelter:2.2, Food:1.8, Transport:4.1,  Health:3.0, "Recreation & Education":1.5, Household:1.2, Clothing:-1.0, "Alcohol & Tobacco":2.0 },
  { year:"2005", Shelter:3.0, Food:1.5, Transport:3.8,  Health:2.4, "Recreation & Education":0.9, Household:0.4, Clothing:-0.5, "Alcohol & Tobacco":2.5 },
  { year:"2010", Shelter:2.0, Food:1.4, Transport:2.8,  Health:2.2, "Recreation & Education":0.6, Household:0.2, Clothing:-0.8, "Alcohol & Tobacco":2.0 },
  { year:"2015", Shelter:3.1, Food:3.8, Transport:-0.5, Health:2.1, "Recreation & Education":1.0, Household:0.5, Clothing:0.3,  "Alcohol & Tobacco":2.5 },
  { year:"2020", Shelter:2.4, Food:2.8, Transport:-4.2, Health:2.5, "Recreation & Education":-0.8,Household:0.2, Clothing:-2.1, "Alcohol & Tobacco":2.7 },
  { year:"2022", Shelter:6.9, Food:8.9, Transport:9.2,  Health:3.4, "Recreation & Education":4.1, Household:5.8, Clothing:3.2,  "Alcohol & Tobacco":4.1 },
  { year:"2023", Shelter:6.1, Food:9.1, Transport:-1.4, Health:3.8, "Recreation & Education":2.9, Household:2.1, Clothing:0.4,  "Alcohol & Tobacco":4.3 },
  { year:"2024", Shelter:5.4, Food:2.8, Transport:-2.1, Health:3.5, "Recreation & Education":1.5, Household:1.2, Clothing:-0.4, "Alcohol & Tobacco":3.5 },
];
const PROV_HISTORY_FALLBACK = [
  { year:"2000", BC:2.1, AB:2.8, SK:1.9, MB:2.4, ON:2.3, QC:2.0, NB:1.8, NS:1.7, PE:1.6, NL:2.2 },
  { year:"2005", BC:2.3, AB:2.9, SK:2.0, MB:2.5, ON:2.2, QC:1.9, NB:1.8, NS:1.7, PE:1.6, NL:2.3 },
  { year:"2010", BC:1.4, AB:1.2, SK:1.6, MB:1.8, ON:1.5, QC:1.2, NB:1.4, NS:1.3, PE:1.2, NL:1.6 },
  { year:"2015", BC:1.1, AB:1.2, SK:1.0, MB:1.8, ON:1.3, QC:1.2, NB:0.9, NS:0.8, PE:0.7, NL:1.4 },
  { year:"2020", BC:1.4, AB:0.6, SK:0.9, MB:1.4, ON:0.8, QC:0.9, NB:0.8, NS:0.7, PE:0.6, NL:1.0 },
  { year:"2022", BC:7.6, AB:8.2, SK:7.4, MB:8.0, ON:7.9, QC:7.1, NB:7.3, NS:7.0, PE:6.9, NL:7.5 },
  { year:"2023", BC:4.1, AB:5.2, SK:4.0, MB:4.8, ON:4.3, QC:3.8, NB:3.9, NS:3.7, PE:3.6, NL:4.4 },
  { year:"2024", BC:2.8, AB:3.1, SK:2.2, MB:3.6, ON:2.7, QC:2.4, NB:2.3, NS:2.5, PE:2.1, NL:2.9 },
];

// Sparse national all-items CPI index going back to 1914 for purchasing power chart
const FALLBACK_CPI_RAW = [
  ["1914-01-01",3.84],["1914-06-01",3.93],["1914-12-01",3.93],
  ["1915-01-01",3.93],["1915-12-01",4.31],["1916-01-01",4.36],["1916-12-01",5.08],
  ["1917-01-01",5.27],["1917-12-01",6.67],["1918-01-01",6.81],["1918-12-01",8.01],
  ["1919-01-01",8.05],["1919-12-01",9.54],["1920-01-01",9.77],["1920-12-01",9.88],
  ["1921-01-01",9.59],["1921-12-01",8.05],["1922-01-01",7.86],["1922-12-01",7.67],
  ["1923-01-01",7.72],["1923-12-01",7.81],["1924-01-01",7.77],["1924-12-01",7.72],
  ["1925-01-01",7.77],["1925-12-01",7.86],["1926-01-01",7.86],["1926-12-01",7.91],
  ["1927-01-01",7.81],["1927-12-01",7.72],["1928-01-01",7.77],["1928-12-01",7.81],
  ["1929-01-01",7.86],["1929-12-01",7.77],["1930-01-01",7.67],["1930-12-01",7.19],
  ["1931-01-01",6.95],["1931-12-01",6.38],["1932-01-01",6.18],["1932-12-01",5.85],
  ["1933-01-01",5.75],["1933-12-01",5.85],["1934-01-01",5.90],["1934-12-01",5.99],
  ["1935-01-01",5.99],["1935-12-01",6.04],["1936-01-01",6.09],["1936-12-01",6.18],
  ["1937-01-01",6.28],["1937-12-01",6.42],["1938-01-01",6.42],["1938-12-01",6.33],
  ["1939-01-01",6.28],["1939-12-01",6.33],["1940-01-01",6.42],["1940-12-01",6.76],
  ["1941-01-01",6.86],["1941-12-01",7.19],["1942-01-01",7.29],["1942-12-01",7.43],
  ["1943-01-01",7.43],["1943-12-01",7.48],["1944-01-01",7.48],["1944-12-01",7.53],
  ["1945-01-01",7.53],["1945-12-01",7.62],["1946-01-01",7.72],["1946-12-01",8.15],
  ["1947-01-01",8.34],["1947-12-01",9.06],["1948-01-01",9.35],["1948-12-01",10.06],
  ["1949-01-01",10.11],["1949-12-01",10.02],["1950-01-01",10.06],["1950-12-01",10.73],
  ["1951-01-01",11.17],["1951-12-01",11.94],["1952-01-01",11.84],["1952-12-01",11.79],
  ["1953-01-01",11.69],["1953-12-01",11.60],["1954-01-01",11.55],["1954-12-01",11.60],
  ["1955-01-01",11.60],["1955-12-01",11.69],["1956-01-01",11.75],["1956-12-01",11.94],
  ["1957-01-01",12.03],["1957-12-01",12.32],["1958-01-01",12.37],["1958-12-01",12.56],
  ["1959-01-01",12.56],["1959-12-01",12.66],["1960-01-01",12.70],["1960-12-01",12.85],
  ["1961-01-01",12.85],["1961-12-01",12.94],["1962-01-01",12.94],["1962-12-01",13.09],
  ["1963-01-01",13.14],["1963-12-01",13.38],["1964-01-01",13.42],["1964-12-01",13.66],
  ["1965-01-01",13.76],["1965-12-01",14.09],["1966-01-01",14.23],["1966-12-01",14.86],
  ["1967-01-01",15.00],["1967-12-01",15.53],["1968-01-01",15.67],["1968-12-01",16.30],
  ["1969-01-01",16.49],["1969-12-01",17.31],["1970-01-01",17.50],["1970-12-01",18.27],
  ["1971-01-01",18.36],["1971-12-01",18.89],["1972-01-01",19.08],["1972-12-01",20.09],
  ["1973-01-01",20.37],["1973-12-01",22.91],["1974-01-01",23.49],["1974-12-01",27.43],
  ["1975-01-01",28.20],["1975-12-01",30.68],["1976-01-01",31.21],["1976-12-01",32.83],
  ["1977-01-01",33.47],["1977-12-01",36.28],["1978-01-01",36.92],["1978-12-01",40.27],
  ["1979-01-01",40.99],["1979-12-01",45.50],["1980-01-01",46.41],["1980-12-01",51.84],
  ["1981-01-01",52.99],["1981-12-01",57.62],["1982-01-01",58.44],["1982-12-01",61.47],
  ["1983-01-01",61.56],["1983-12-01",63.52],["1984-01-01",63.81],["1984-12-01",65.70],
  ["1985-01-01",65.97],["1985-12-01",67.93],["1986-01-01",68.17],["1986-12-01",69.40],
  ["1987-01-01",69.94],["1987-12-01",72.81],["1988-01-01",73.31],["1988-12-01",76.61],
  ["1989-01-01",77.44],["1989-12-01",81.41],["1990-01-01",82.23],["1990-12-01",86.01],
  ["1991-01-01",86.87],["1991-12-01",88.78],["1992-01-01",88.93],["1992-12-01",90.07],
  ["1993-01-01",90.31],["1993-12-01",91.54],["1994-01-01",91.59],["1994-12-01",91.97],
  ["1995-01-01",92.11],["1995-12-01",93.70],["1996-01-01",93.80],["1996-12-01",94.46],
  ["1997-01-01",94.56],["1997-12-01",95.09],["1998-01-01",95.13],["1998-12-01",95.28],
  ["1999-01-01",95.42],["1999-12-01",97.31],
  ["2000-01-01",95.4], ["2000-06-01",96.8], ["2000-12-01",97.3],
  ["2001-01-01",97.3], ["2001-06-01",98.7], ["2001-12-01",98.2],
  ["2002-01-01",98.4], ["2002-06-01",100.3],["2002-12-01",100.6],
  ["2003-01-01",101.2],["2003-06-01",102.5],["2003-12-01",103.0],
  ["2004-01-01",103.0],["2004-06-01",104.7],["2004-12-01",105.3],
  ["2005-01-01",105.3],["2005-06-01",107.3],["2005-12-01",107.9],
  ["2006-01-01",108.1],["2006-06-01",110.2],["2006-12-01",109.7],
  ["2007-01-01",110.1],["2007-06-01",112.0],["2007-12-01",112.4],
  ["2008-01-01",112.9],["2008-06-01",116.3],["2008-12-01",114.1],
  ["2009-01-01",114.4],["2009-06-01",114.3],["2009-12-01",115.0],
  ["2010-01-01",115.2],["2010-06-01",116.9],["2010-12-01",117.6],
  ["2011-01-01",117.8],["2011-06-01",120.6],["2011-12-01",121.0],
  ["2012-01-01",120.9],["2012-06-01",122.3],["2012-12-01",122.8],
  ["2013-01-01",122.8],["2013-06-01",123.4],["2013-12-01",124.1],
  ["2014-01-01",124.3],["2014-06-01",126.4],["2014-12-01",126.1],
  ["2015-01-01",125.9],["2015-06-01",127.8],["2015-12-01",127.9],
  ["2016-01-01",127.7],["2016-06-01",129.6],["2016-12-01",130.1],
  ["2017-01-01",130.0],["2017-06-01",131.4],["2017-12-01",133.4],
  ["2018-01-01",133.4],["2018-06-01",136.1],["2018-12-01",135.6],
  ["2019-01-01",135.8],["2019-06-01",137.7],["2019-12-01",138.2],
  ["2020-01-01",138.6],["2020-06-01",138.2],["2020-12-01",139.8],
  ["2021-01-01",139.9],["2021-06-01",144.4],["2021-12-01",149.3],
  ["2022-01-01",149.8],["2022-06-01",156.4],["2022-12-01",157.4],
  ["2023-01-01",157.9],["2023-06-01",159.1],["2023-12-01",160.8],
  ["2024-01-01",160.9],["2024-06-01",162.3],["2024-12-01",163.8],
  ["2025-01-01",163.9],["2025-06-01",163.5],["2025-12-01",165.1],
  ["2026-01-01",165.8],
];

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
          <div style={{ fontSize:14, fontWeight:700 }}>Inflation History</div>
          <div style={{ fontSize:10, color:C.textSecondary, marginTop:2 }}>Year-over-year % · {chart[0]?.date} – {chart[chart.length-1]?.date}</div>
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
          <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti}/>
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
        <div style={{ fontSize:10, color:C.textSecondary, marginBottom:14 }}>YoY · Jan {catEndYr} · StatCan table 18-10-0004-01</div>
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
        <div style={{ fontSize:10, color:C.textSecondary, marginBottom:14 }}>YoY · Jan {provEndYr} · StatCan table 18-10-0004-01</div>
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
        Year-over-year % · Annual · {catStartYr}–{catEndYr} · Source: Statistics Canada
        {catStartYr > "1979" ? "" : " (category data available from ~1979)"}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:16 }}>
        {CAT_KEYS.map(k => <FilterPill key={k} label={k} color={CAT_COLORS[k]} active={activeCats[k]} onClick={() => setActiveCats(p => ({ ...p, [k]:!p[k] }))}/>)}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={catHistory} margin={{ top:4, right:8, left:-24, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false}/>
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
        Year-over-year % · Annual · {provStartYr}–{provEndYr} · Source: Statistics Canada
        {provStartYr > "1979" ? "" : " (provincial data available from ~1979)"}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:16 }}>
        {PROVINCES.map(p => <FilterPill key={p.key} label={p.code} color={PROV_COLORS[p.key]} active={activeProvs[p.key]} onClick={() => setActiveProvs(prev => ({ ...prev, [p.key]:!prev[p.key] }))}/>)}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={provHistory} margin={{ top:4, right:8, left:-24, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false}/>
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
function CumulativeTab({ data, vis, catHistory, provHistory }) {
  const [range, setRange]              = useState("All");
  const [activeCats, setActiveCats]    = useState(Object.fromEntries(CAT_KEYS.map(k => [k, true])));
  const [activeProvs, setActiveProvs]  = useState(Object.fromEntries(PROV_KEYS.map(k => [k, true])));

  const catCumHistory  = useMemo(() => computeCumulative(catHistory,  CAT_KEYS),  [catHistory]);
  const provCumHistory = useMemo(() => computeCumulative(provHistory, PROV_KEYS), [provHistory]);
  const cadData  = useMemo(() => data ? computeCadDevaluation(data) : [], [data]);
  const chart    = cadData.slice(-Math.min(RANGES[range], cadData.length));
  const latest   = cadData[cadData.length - 1];
  const startYr  = data?.[0]?.iso ? new Date(data[0].iso).getFullYear() : "1914";
  const totalLost = latest ? latest.lostPct : 0;
  const ti = range==="2Y"?2:range==="5Y"?5:range==="10Y"?11:range==="25Y"?28:Math.max(1,Math.floor(chart.length/11));

  const latestCatCum  = catCumHistory[catCumHistory.length - 1]  || {};
  const latestProvCum = provCumHistory[provCumHistory.length - 1] || {};
  const sortedCat  = CAT_KEYS.map(k => ({ key:k, label:CAT_META[k].label, icon:CAT_META[k].icon, cumValue:latestCatCum[k]??0 })).sort((a,b) => b.cumValue - a.cumValue);
  const sortedProv = PROV_META.map(p => ({ ...p, cumValue:latestProvCum[p.key]??0 })).sort((a,b) => b.cumValue - a.cumValue);
  const multiplier = latest ? (1 / latest.cadValue).toFixed(2) : "—";
  const cagr = latest ? ((Math.pow(1/latest.cadValue, 1/((data?.length||12)/12))-1)*100).toFixed(1) : "—";

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
          <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti}/>
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
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false}/>
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
          <XAxis dataKey="year" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false}/>
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
  const latest  = chartData[chartData.length - 1];
  const gap     = latest?.gap;
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
          <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti}/>
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
            <XAxis dataKey="date" tick={{ fill:C.textMuted, fontSize:9, fontWeight:600 }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti}/>
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

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [data,        setData]        = useState(null);
  const [catHistory,  setCatHistory]  = useState(CAT_HISTORY_FALLBACK);
  const [provHistory, setProvHistory] = useState(PROV_HISTORY_FALLBACK);
  const [rateData,    setRateData]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [vis,         setVis]         = useState(false);
  const [tab,         setTab]         = useState(0);

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

      const catH  = buildAnnualHistory(rawMap, CAT_KEYS,  CAT_VECTORS);
      const provH = buildAnnualHistory(rawMap, PROV_KEYS, PROV_VECTORS);
      if (catH.length  > 2) setCatHistory(catH);
      if (provH.length > 2) setProvHistory(provH);
    } catch {
      setData(computeYoY(FALLBACK_CPI_RAW));
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

    setLoading(false);
    setTimeout(() => setVis(true), 60);
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS = ["Inflation Rates", "Purchasing Power", "Taylor Rule"];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.textPrimary, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
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
      `}</style>

      {/* Nav */}
      <nav style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px", height:56, display:"flex", alignItems:"center", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(16px)" }}>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:18, fontWeight:700, letterSpacing:"-.3px", color:C.white }}>Canadian</span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:18, fontWeight:700, letterSpacing:"-.3px", color:C.red }}>flation</span>
      </nav>

      {/* Tabs */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px", display:"flex", position:"sticky", top:56, zIndex:99 }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            background:"none", border:"none",
            borderBottom:`2px solid ${tab===i ? C.yellow : "transparent"}`,
            color: tab===i ? C.yellow : C.textSecondary,
            padding:"12px 16px", fontSize:13, fontWeight:600, cursor:"pointer",
            fontFamily:"inherit", transition:"all .15s", WebkitTapHighlightColor:"transparent",
          }}>{t}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ maxWidth:980, margin:"0 auto", padding:"20px 16px 60px" }}>
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:360, gap:16 }}>
            <div className="spin" style={{ width:36, height:36 }}/>
            <p style={{ color:C.textMuted, fontSize:12, fontWeight:500 }}>Fetching live CPI & rate data…</p>
          </div>
        ) : (
          tab === 0 ? <RatesTab      data={data} vis={vis} catHistory={catHistory} provHistory={provHistory}/> :
          tab === 1 ? <CumulativeTab data={data} vis={vis} catHistory={catHistory} provHistory={provHistory}/> :
                      <TaylorTab     data={data} vis={vis} rateData={rateData}/>
        )}

        <div style={{ textAlign:"center", fontSize:10, color:C.textMuted, fontWeight:500, marginTop:32, paddingTop:20, borderTop:`1px solid ${C.border}` }}>
          © 2026 Canadianflation.ca · CPI: Statistics Canada 18-10-0004-01 · Rate: Bank of Canada Valet API · Not an official government product
        </div>
      </div>
    </div>
  );
}
