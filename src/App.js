import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from "recharts";

const STATCAN_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";
const CPI_VECTOR = 41690973;

const C = {
  bg:        "#0B1220",
  surface:   "#111C2E",
  surface2:  "#162035",
  border:    "#1E2D45",
  border2:   "#243450",
  textPrimary:  "#F0F4FF",
  textSecondary:"#7A90B0",
  textMuted:    "#3D5270",
  maple:     "#C8473A",
  mapleGlow: "rgba(200,71,58,0.18)",
  up:        "#E05A4A",
  upBg:      "rgba(224,90,74,0.12)",
  down:      "#3ECFA0",
  downBg:    "rgba(62,207,160,0.10)",
  neutral:   "#5B8FD4",
  neutralBg: "rgba(91,143,212,0.10)",
  chartLine: "#5B8FD4",
  refLine:   "#243450",
};

const FALLBACK_CPI_RAW = [
  ["1914-01-01",3.84],["1914-06-01",3.93],["1914-12-01",3.93],
  ["1915-01-01",3.93],["1915-12-01",4.31],["1916-01-01",4.36],["1916-12-01",5.08],
  ["1917-01-01",5.27],["1917-12-01",6.67],["1918-01-01",6.81],["1918-12-01",8.01],
  ["1919-01-01",8.05],["1919-12-01",9.54],["1920-01-01",9.77],["1920-12-01",9.88],
  ["1921-01-01",9.59],["1921-12-01",8.05],["1922-01-01",7.86],["1922-12-01",7.67],
  ["1923-01-01",7.72],["1923-12-01",7.81],["1924-01-01",7.77],["1924-12-01",7.72],
  ["1925-01-01",7.77],["1925-12-01",7.86],["1926-01-01",7.86],["1926-12-01",7.91],
  ["1927-01-01",7.81],["1927-12-01",7.72],["1928-01-01",7.77],["1928-12-01",7.81],
  ["1929-01-01",7.86],["1929-12-01",7.77],
  ["1930-01-01",7.67],["1930-12-01",7.19],["1931-01-01",6.95],["1931-12-01",6.38],
  ["1932-01-01",6.18],["1932-12-01",5.85],["1933-01-01",5.75],["1933-12-01",5.85],
  ["1934-01-01",5.90],["1934-12-01",5.99],["1935-01-01",5.99],["1935-12-01",6.04],
  ["1936-01-01",6.09],["1936-12-01",6.18],["1937-01-01",6.28],["1937-12-01",6.42],
  ["1938-01-01",6.42],["1938-12-01",6.33],["1939-01-01",6.28],["1939-12-01",6.33],
  ["1940-01-01",6.42],["1940-12-01",6.76],["1941-01-01",6.86],["1941-12-01",7.19],
  ["1942-01-01",7.29],["1942-12-01",7.43],["1943-01-01",7.43],["1943-12-01",7.48],
  ["1944-01-01",7.48],["1944-12-01",7.53],["1945-01-01",7.53],["1945-12-01",7.62],
  ["1946-01-01",7.72],["1946-12-01",8.15],["1947-01-01",8.34],["1947-12-01",9.06],
  ["1948-01-01",9.35],["1948-12-01",10.06],["1949-01-01",10.11],["1949-12-01",10.02],
  ["1950-01-01",10.06],["1950-12-01",10.73],["1951-01-01",11.17],["1951-12-01",11.94],
  ["1952-01-01",11.84],["1952-12-01",11.79],["1953-01-01",11.69],["1953-12-01",11.60],
  ["1954-01-01",11.55],["1954-12-01",11.60],["1955-01-01",11.60],["1955-12-01",11.69],
  ["1956-01-01",11.75],["1956-12-01",11.94],["1957-01-01",12.03],["1957-12-01",12.32],
  ["1958-01-01",12.37],["1958-12-01",12.56],["1959-01-01",12.56],["1959-12-01",12.66],
  ["1960-01-01",12.70],["1960-12-01",12.85],["1961-01-01",12.85],["1961-12-01",12.94],
  ["1962-01-01",12.94],["1962-12-01",13.09],["1963-01-01",13.14],["1963-12-01",13.38],
  ["1964-01-01",13.42],["1964-12-01",13.66],["1965-01-01",13.76],["1965-12-01",14.09],
  ["1966-01-01",14.23],["1966-12-01",14.86],["1967-01-01",15.00],["1967-12-01",15.53],
  ["1968-01-01",15.67],["1968-12-01",16.30],["1969-01-01",16.49],["1969-12-01",17.31],
  ["1970-01-01",17.50],["1970-12-01",18.27],["1971-01-01",18.36],["1971-12-01",18.89],
  ["1972-01-01",19.08],["1972-12-01",20.09],["1973-01-01",20.37],["1973-12-01",22.91],
  ["1974-01-01",23.49],["1974-12-01",27.43],["1975-01-01",28.20],["1975-12-01",30.68],
  ["1976-01-01",31.21],["1976-12-01",32.83],["1977-01-01",33.47],["1977-12-01",36.28],
  ["1978-01-01",36.92],["1978-12-01",40.27],["1979-01-01",40.99],["1979-12-01",45.50],
  ["1980-01-01",46.41],["1980-12-01",51.84],["1981-01-01",52.99],["1981-12-01",57.62],
  ["1982-01-01",58.44],["1982-12-01",61.47],["1983-01-01",61.56],["1983-12-01",63.52],
  ["1984-01-01",63.81],["1984-12-01",65.70],["1985-01-01",65.97],["1985-12-01",67.93],
  ["1986-01-01",68.17],["1986-12-01",69.40],["1987-01-01",69.94],["1987-12-01",72.81],
  ["1988-01-01",73.31],["1988-12-01",76.61],["1989-01-01",77.44],["1989-12-01",81.41],
  ["1990-01-01",82.23],["1990-12-01",86.01],["1991-01-01",86.87],["1991-12-01",88.78],
  ["1992-01-01",88.93],["1992-12-01",90.07],["1993-01-01",90.31],["1993-12-01",91.54],
  ["1994-01-01",91.59],["1994-12-01",91.97],["1995-01-01",92.11],["1995-12-01",93.70],
  ["1996-01-01",93.80],["1996-12-01",94.46],["1997-01-01",94.56],["1997-12-01",95.09],
  ["1998-01-01",95.13],["1998-12-01",95.28],["1999-01-01",95.42],["1999-12-01",97.31],
  ["2000-01-01",95.4],["2000-02-01",95.6],["2000-03-01",96.0],["2000-04-01",96.3],["2000-05-01",96.6],["2000-06-01",96.8],
  ["2000-07-01",97.0],["2000-08-01",97.2],["2000-09-01",97.4],["2000-10-01",97.4],["2000-11-01",97.4],["2000-12-01",97.3],
  ["2001-01-01",97.3],["2001-02-01",97.7],["2001-03-01",98.0],["2001-04-01",98.4],["2001-05-01",98.5],["2001-06-01",98.7],
  ["2001-07-01",98.8],["2001-08-01",98.8],["2001-09-01",98.8],["2001-10-01",98.5],["2001-11-01",98.3],["2001-12-01",98.2],
  ["2002-01-01",98.4],["2002-02-01",99.0],["2002-03-01",99.8],["2002-04-01",100.1],["2002-05-01",100.3],["2002-06-01",100.3],
  ["2002-07-01",100.4],["2002-08-01",100.6],["2002-09-01",100.5],["2002-10-01",100.4],["2002-11-01",100.5],["2002-12-01",100.6],
  ["2003-01-01",101.2],["2003-02-01",101.9],["2003-03-01",102.4],["2003-04-01",102.4],["2003-05-01",102.5],["2003-06-01",102.5],
  ["2003-07-01",102.7],["2003-08-01",102.9],["2003-09-01",103.0],["2003-10-01",103.0],["2003-11-01",102.9],["2003-12-01",103.0],
  ["2004-01-01",103.0],["2004-02-01",103.1],["2004-03-01",103.5],["2004-04-01",103.9],["2004-05-01",104.4],["2004-06-01",104.7],
  ["2004-07-01",104.9],["2004-08-01",105.1],["2004-09-01",105.4],["2004-10-01",105.3],["2004-11-01",105.4],["2004-12-01",105.3],
  ["2005-01-01",105.3],["2005-02-01",105.9],["2005-03-01",106.5],["2005-04-01",107.0],["2005-05-01",107.4],["2005-06-01",107.3],
  ["2005-07-01",107.4],["2005-08-01",107.7],["2005-09-01",108.0],["2005-10-01",108.3],["2005-11-01",108.1],["2005-12-01",107.9],
  ["2006-01-01",108.1],["2006-02-01",108.6],["2006-03-01",109.2],["2006-04-01",109.6],["2006-05-01",110.0],["2006-06-01",110.2],
  ["2006-07-01",110.3],["2006-08-01",110.1],["2006-09-01",109.7],["2006-10-01",109.5],["2006-11-01",109.7],["2006-12-01",109.7],
  ["2007-01-01",110.1],["2007-02-01",110.5],["2007-03-01",111.1],["2007-04-01",111.5],["2007-05-01",111.8],["2007-06-01",112.0],
  ["2007-07-01",112.2],["2007-08-01",112.2],["2007-09-01",112.1],["2007-10-01",112.2],["2007-11-01",112.4],["2007-12-01",112.4],
  ["2008-01-01",112.9],["2008-02-01",113.5],["2008-03-01",114.1],["2008-04-01",114.7],["2008-05-01",115.4],["2008-06-01",116.3],
  ["2008-07-01",116.6],["2008-08-01",116.3],["2008-09-01",115.9],["2008-10-01",115.4],["2008-11-01",114.7],["2008-12-01",114.1],
  ["2009-01-01",114.4],["2009-02-01",114.5],["2009-03-01",114.6],["2009-04-01",114.3],["2009-05-01",114.1],["2009-06-01",114.3],
  ["2009-07-01",114.3],["2009-08-01",114.3],["2009-09-01",114.4],["2009-10-01",114.4],["2009-11-01",114.6],["2009-12-01",115.0],
  ["2010-01-01",115.2],["2010-02-01",115.4],["2010-03-01",116.0],["2010-04-01",116.5],["2010-05-01",116.7],["2010-06-01",116.9],
  ["2010-07-01",117.0],["2010-08-01",117.2],["2010-09-01",117.3],["2010-10-01",117.4],["2010-11-01",117.5],["2010-12-01",117.6],
  ["2011-01-01",117.8],["2011-02-01",118.3],["2011-03-01",119.0],["2011-04-01",119.8],["2011-05-01",120.3],["2011-06-01",120.6],
  ["2011-07-01",120.7],["2011-08-01",120.9],["2011-09-01",121.1],["2011-10-01",121.1],["2011-11-01",120.8],["2011-12-01",121.0],
  ["2012-01-01",120.9],["2012-02-01",121.4],["2012-03-01",122.0],["2012-04-01",122.2],["2012-05-01",122.1],["2012-06-01",122.3],
  ["2012-07-01",122.4],["2012-08-01",122.8],["2012-09-01",123.0],["2012-10-01",122.9],["2012-11-01",122.8],["2012-12-01",122.8],
  ["2013-01-01",122.8],["2013-02-01",123.1],["2013-03-01",123.3],["2013-04-01",123.4],["2013-05-01",123.5],["2013-06-01",123.4],
  ["2013-07-01",123.6],["2013-08-01",123.7],["2013-09-01",123.8],["2013-10-01",124.0],["2013-11-01",124.0],["2013-12-01",124.1],
  ["2014-01-01",124.3],["2014-02-01",125.0],["2014-03-01",125.4],["2014-04-01",125.5],["2014-05-01",126.0],["2014-06-01",126.4],
  ["2014-07-01",126.5],["2014-08-01",126.5],["2014-09-01",126.6],["2014-10-01",126.6],["2014-11-01",126.5],["2014-12-01",126.1],
  ["2015-01-01",125.9],["2015-02-01",126.5],["2015-03-01",127.1],["2015-04-01",127.2],["2015-05-01",127.5],["2015-06-01",127.8],
  ["2015-07-01",128.0],["2015-08-01",128.0],["2015-09-01",128.1],["2015-10-01",128.2],["2015-11-01",128.1],["2015-12-01",127.9],
  ["2016-01-01",127.7],["2016-02-01",128.0],["2016-03-01",128.8],["2016-04-01",129.2],["2016-05-01",129.5],["2016-06-01",129.6],
  ["2016-07-01",129.7],["2016-08-01",129.9],["2016-09-01",129.9],["2016-10-01",130.0],["2016-11-01",130.0],["2016-12-01",130.1],
  ["2017-01-01",130.0],["2017-02-01",130.3],["2017-03-01",131.1],["2017-04-01",131.0],["2017-05-01",131.2],["2017-06-01",131.4],
  ["2017-07-01",131.5],["2017-08-01",132.0],["2017-09-01",132.4],["2017-10-01",132.5],["2017-11-01",132.8],["2017-12-01",133.4],
  ["2018-01-01",133.4],["2018-02-01",133.9],["2018-03-01",134.6],["2018-04-01",135.3],["2018-05-01",135.8],["2018-06-01",136.1],
  ["2018-07-01",136.4],["2018-08-01",136.3],["2018-09-01",136.3],["2018-10-01",136.0],["2018-11-01",135.7],["2018-12-01",135.6],
  ["2019-01-01",135.8],["2019-02-01",136.3],["2019-03-01",137.0],["2019-04-01",137.3],["2019-05-01",137.6],["2019-06-01",137.7],
  ["2019-07-01",137.9],["2019-08-01",137.9],["2019-09-01",137.9],["2019-10-01",138.0],["2019-11-01",138.0],["2019-12-01",138.2],
  ["2020-01-01",138.6],["2020-02-01",138.8],["2020-03-01",138.8],["2020-04-01",137.5],["2020-05-01",137.5],["2020-06-01",138.2],
  ["2020-07-01",138.6],["2020-08-01",138.9],["2020-09-01",139.1],["2020-10-01",139.2],["2020-11-01",139.3],["2020-12-01",139.8],
  ["2021-01-01",139.9],["2021-02-01",140.4],["2021-03-01",141.2],["2021-04-01",142.5],["2021-05-01",143.6],["2021-06-01",144.4],
  ["2021-07-01",145.0],["2021-08-01",145.6],["2021-09-01",146.3],["2021-10-01",147.6],["2021-11-01",148.7],["2021-12-01",149.3],
  ["2022-01-01",149.8],["2022-02-01",150.9],["2022-03-01",151.9],["2022-04-01",153.3],["2022-05-01",155.3],["2022-06-01",156.4],
  ["2022-07-01",157.0],["2022-08-01",157.7],["2022-09-01",157.8],["2022-10-01",158.0],["2022-11-01",157.5],["2022-12-01",157.4],
  ["2023-01-01",157.9],["2023-02-01",158.4],["2023-03-01",158.2],["2023-04-01",159.3],["2023-05-01",159.7],["2023-06-01",159.1],
  ["2023-07-01",159.7],["2023-08-01",160.6],["2023-09-01",160.6],["2023-10-01",160.8],["2023-11-01",160.6],["2023-12-01",160.8],
  ["2024-01-01",160.9],["2024-02-01",161.8],["2024-03-01",161.8],["2024-04-01",162.3],["2024-05-01",162.9],["2024-06-01",162.3],
  ["2024-07-01",162.8],["2024-08-01",163.2],["2024-09-01",162.8],["2024-10-01",163.3],["2024-11-01",163.2],["2024-12-01",163.8],
  ["2025-01-01",163.9],["2025-02-01",164.0],["2025-03-01",164.0],["2025-04-01",164.1],["2025-05-01",164.6],["2025-06-01",163.5],
  ["2025-07-01",164.8],["2025-08-01",164.7],["2025-09-01",164.7],["2025-10-01",164.7],["2025-11-01",164.6],["2025-12-01",165.1],
  ["2026-01-01",165.8],
];

const COMPONENTS = [
  { label: "Shelter",       value: 4.5,  icon: "🏠" },
  { label: "Health",        value: 3.4,  icon: "💊" },
  { label: "Food",          value: 3.1,  icon: "🥦" },
  { label: "Alcohol & Tob", value: 3.0,  icon: "🍺" },
  { label: "Recreation",    value: 1.2,  icon: "📚" },
  { label: "Household",     value: 0.8,  icon: "🛋️" },
  { label: "Clothing",      value: -0.9, icon: "👗" },
  { label: "Transport",     value: -3.2, icon: "🚗" },
];

const PROVINCES = [
  { code: "BC", name: "British Columbia",  value: 2.5 },
  { code: "AB", name: "Alberta",           value: 2.8 },
  { code: "SK", name: "Saskatchewan",      value: 1.8 },
  { code: "MB", name: "Manitoba",          value: 3.3 },
  { code: "ON", name: "Ontario",           value: 2.4 },
  { code: "QC", name: "Québec",            value: 2.1 },
  { code: "NB", name: "New Brunswick",     value: 2.0 },
  { code: "NS", name: "Nova Scotia",       value: 2.2 },
  { code: "PE", name: "P.E.I.",            value: 1.8 },
  { code: "NL", name: "Newfoundland",      value: 2.6 },
];

const BOC = 2.0;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const RANGES = { "2Y": 24, "5Y": 60, "10Y": 120, "25Y": 300, "All": 99999 };

function fmtDate(iso) {
  const d = new Date(iso.slice(0,10) + "T12:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function computeYoY(raw) {
  const map = {};
  raw.forEach(([d,v]) => { map[d.slice(0,7)] = v; });
  return Object.keys(map).sort().reduce((acc,k) => {
    const [y,m] = k.split("-").map(Number);
    const pk = `${y-1}-${String(m).padStart(2,"0")}`;
    if (map[pk] != null)
      acc.push({ date: fmtDate(k+"-01"), iso: k+"-01", value: +((map[k]-map[pk])/map[pk]*100).toFixed(1) });
    return acc;
  }, []);
}
function parseWDS(json) {
  try {
    const pts = json[0]?.object?.vectorDataPoint;
    if (!pts?.length) return null;
    return pts.map(p => [p.refPer, p.value]);
  } catch { return null; }
}

function valColor(v) { return v > BOC ? C.up : v > 0 ? C.neutral : C.down; }
function valBg(v)    { return v > BOC ? C.upBg : v > 0 ? C.neutralBg : C.downBg; }

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{
      background: C.surface2, border: `1px solid ${C.border2}`,
      borderRadius: 10, padding: "12px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: valColor(v), fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "-.5px", lineHeight: 1 }}>
        {v > 0 ? "+" : ""}{v.toFixed(1)}%
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>
        {v > BOC ? `+${(v-BOC).toFixed(1)}pp above BoC target` : `${(BOC-v).toFixed(1)}pp below BoC target`}
      </div>
    </div>
  );
};

function MapleLeaf({ size = 22, color = C.maple }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M50 5 L57 30 L75 18 L68 38 L90 38 L74 52 L82 72 L63 62 L60 85 L50 72 L40 85 L37 62 L18 72 L26 52 L10 38 L32 38 L25 18 L43 30 Z" fill={color}/>
      <rect x="46" y="72" width="8" height="23" rx="2" fill={color}/>
    </svg>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState("loading");
  const [range, setRange] = useState("10Y");
  const [vis, setVis] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setVis(false);
    try {
      const res = await fetch(`${STATCAN_BASE}/getDataFromVectorsAndLatestNPeriods`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ vectorId: CPI_VECTOR, latestN: 1500 }]),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = parseWDS(json);
      if (!raw || raw.length < 24) throw new Error();
      setData(computeYoY(raw)); setSrc("live");
    } catch {
      setData(computeYoY(FALLBACK_CPI_RAW)); setSrc("fallback");
    } finally {
      setLoading(false); setTimeout(() => setVis(true), 60);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chart   = data ? data.slice(-Math.min(RANGES[range], data.length)) : [];
  const cur     = data?.[data.length - 1];
  const prev    = data?.[data.length - 2];
  const peak    = data?.reduce((a,b) => b.value > a.value ? b : a);
  const l12     = data?.slice(-12) ?? [];
  const lo12    = l12.length ? Math.min(...l12.map(d=>d.value)) : 0;
  const hi12    = l12.length ? Math.max(...l12.map(d=>d.value)) : 0;
  const startYr = data?.[0]?.iso ? new Date(data[0].iso).getFullYear() : "—";
  const delta   = cur && prev ? +(cur.value - prev.value).toFixed(1) : 0;
  const ti      = range==="2Y" ? 2 : range==="5Y" ? 5 : range==="10Y" ? 11 : range==="25Y" ? 28 : Math.max(1, Math.floor(chart.length/11));

  return (
    <div style={{ minHeight:"100vh", background: C.bg, color: C.textPrimary, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:2px}
        .reveal{opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s ease}
        .reveal.in{opacity:1;transform:translateY(0)}
        .rb{background:none;border:1px solid ${C.border};color:${C.textSecondary};
            padding:5px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;
            transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif}
        .rb.on{background:${C.neutral};border-color:${C.neutral};color:#fff}
        .rb:hover:not(.on){border-color:${C.border2};color:${C.textPrimary}}
        .row-item{display:flex;align-items:center;justify-content:space-between;
                  padding:11px 0;border-bottom:1px solid ${C.border}}
        .row-item:last-child{border-bottom:none}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{border:2px solid ${C.border};border-top-color:${C.neutral};
              border-radius:50%;animation:spin .7s linear infinite}
      `}</style>

      <nav style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 28px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <MapleLeaf size={22} color={C.maple} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 20, fontWeight: 700, letterSpacing: ".5px",
            color: C.textPrimary,
          }}>
            CANADIANFLATION
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, fontWeight:600 }}>
          {loading ? (
            <><div className="spin" style={{ width:16,height:16 }} /><span style={{ color:C.textMuted }}>Loading…</span></>
          ) : (
            <>
              <span style={{ width:6,height:6,borderRadius:"50%",display:"inline-block",
                background: src==="live" ? C.down : "#E8A23A",
                boxShadow: src==="live" ? `0 0 6px ${C.down}` : "0 0 6px #E8A23A" }}
              />
              <span style={{ color: C.textMuted }}>
                {src==="live" ? "Live · Statistics Canada WDS" : "Cached · Statistics Canada"}
              </span>
              {src==="fallback" &&
                <button onClick={load} style={{ background:"none",border:`1px solid ${C.border}`,color:C.textSecondary,
                  borderRadius:4,padding:"2px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>Retry</button>}
            </>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1060, margin:"0 auto", padding:"36px 20px 80px" }}>
        {loading ? (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:400,gap:16 }}>
            <div className="spin" style={{ width:40,height:40,borderWidth:3 }} />
            <p style={{ color:C.textMuted, fontSize:13, fontWeight:500 }}>Fetching historical CPI data…</p>
          </div>
        ) : (
          <>
            <div className={`reveal ${vis?"in":""}`} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 16, marginBottom: 20, overflow: "hidden",
              backgroundImage: `radial-gradient(${C.border} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}>
              <div style={{ background:`linear-gradient(135deg, ${C.surface} 60%, transparent)`, padding:"36px 36px 0" }}>
                <div style={{ fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:".12em",marginBottom:14 }}>
                  Canada · All-Items CPI · Year-over-Year · {cur?.date}
                </div>
                <div style={{ display:"flex", alignItems:"flex-end", gap:20, flexWrap:"wrap", marginBottom:24 }}>
                  <div style={{
                    fontFamily:"'Barlow Condensed',sans-serif",
                    fontSize:"clamp(72px,10vw,100px)",
                    fontWeight:700, lineHeight:1, letterSpacing:"-2px",
                    color: valColor(cur?.value),
                  }}>
                    {cur?.value.toFixed(1)}%
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:8,paddingBottom:10 }}>
                    {prev && (
                      <span style={{
                        display:"inline-flex",alignItems:"center",gap:5,
                        background: valBg(delta),
                        color: valColor(delta),
                        borderRadius:6, padding:"5px 11px",
                        fontSize:13, fontWeight:700,
                        border:`1px solid ${valColor(delta)}30`,
                      }}>
                        {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}&nbsp;
                        {Math.abs(delta).toFixed(1)}pp&nbsp;
                        <span style={{ color:C.textSecondary,fontWeight:500 }}>vs {prev.date}</span>
                      </span>
                    )}
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                      <span style={{ fontSize:11,fontWeight:600,color:C.textMuted,background:C.surface2,
                        border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 9px" }}>
                        BoC target {BOC.toFixed(1)}%
                      </span>
                      {peak && (
                        <span style={{ fontSize:11,fontWeight:600,color:C.textMuted,background:C.surface2,
                          border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 9px" }}>
                          Peak {peak.value.toFixed(1)}% · {peak.date}
                        </span>
                      )}
                      <span style={{ fontSize:11,fontWeight:600,color:C.textMuted,background:C.surface2,
                        border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 9px" }}>
                        {data?.length} months · {startYr}–present
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderTop:`1px solid ${C.border}` }}>
                {[
                  { label:"vs. BoC Target", val:`${cur?.value > BOC?"+":""}${(cur?.value-BOC).toFixed(1)}pp`, color:valColor(cur?.value) },
                  { label:"Prior Month",    val:`${prev?.value.toFixed(1)}%`, color:C.textPrimary },
                  { label:"12-Mo Low",      val:`${lo12.toFixed(1)}%`, color:C.down },
                  { label:"12-Mo High",     val:`${hi12.toFixed(1)}%`, color:C.up },
                ].map((s,i) => (
                  <div key={i} style={{
                    padding:"18px 24px",
                    borderRight: i<3 ? `1px solid ${C.border}` : "none",
                    background: C.surface,
                  }}>
                    <div style={{ fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:".1em",marginBottom:7 }}>{s.label}</div>
                    <div style={{ fontSize:24,fontWeight:700,color:s.color,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"-.5px" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`reveal ${vis?"in":""}`} style={{
              background:C.surface, border:`1px solid ${C.border}`, borderRadius:16,
              padding:"26px 24px 18px", marginBottom:20, transitionDelay:".07s",
            }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12 }}>
                <div>
                  <div style={{ fontSize:15,fontWeight:700,color:C.textPrimary,letterSpacing:"-.2px" }}>Inflation History</div>
                  <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginTop:3 }}>
                    Year-over-year % change · {chart[0]?.date} – {chart[chart.length-1]?.date}
                    {src==="live" && <span style={{ color:C.down,marginLeft:8 }}>● Live</span>}
                  </div>
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {Object.keys(RANGES).map(r => (
                    <button key={r} className={`rb ${range===r?"on":""}`} onClick={()=>setRange(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={chart} margin={{ top:4,right:4,left:-20,bottom:0 }}>
                  <defs>
                    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={C.up}/>
                      <stop offset="45%" stopColor={C.neutral}/>
                      <stop offset="100%" stopColor={C.down}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="date"
                    tick={{ fill:C.textMuted, fontSize:10, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                    axisLine={{ stroke:C.border }} tickLine={false} interval={ti}/>
                  <YAxis
                    tick={{ fill:C.textMuted, fontSize:10, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                    axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={["auto","auto"]}/>
                  <Tooltip content={<ChartTip/>}/>
                  <ReferenceLine y={BOC} stroke={C.border2} strokeDasharray="4 3"
                    label={{ value:"BoC 2%", fill:C.textMuted, fontSize:10, fontFamily:"'Plus Jakarta Sans',sans-serif", position:"insideTopRight" }}/>
                  <ReferenceLine y={0} stroke={C.border}/>
                  <Line type="monotone" dataKey="value" stroke="url(#lg)" strokeWidth={2}
                    dot={false} activeDot={{ r:4, fill:C.neutral, stroke:C.surface, strokeWidth:2 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
              <div className={`reveal ${vis?"in":""}`} style={{
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:16,
                padding:"24px 22px", transitionDelay:".13s",
              }}>
                <div style={{ fontSize:15,fontWeight:700,marginBottom:3 }}>By Category</div>
                <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginBottom:18 }}>Year-over-year % · {cur?.date}</div>
                {COMPONENTS.map((c,i) => (
                  <div key={i} className="row-item">
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <span style={{
                        width:30,height:30,borderRadius:8,
                        background: valBg(c.value),
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                      }}>{c.icon}</span>
                      <span style={{ fontSize:13,fontWeight:600,color:C.textPrimary }}>{c.label}</span>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <div style={{ width:52,height:3,background:C.border2,borderRadius:2,overflow:"hidden" }}>
                        <div style={{ height:"100%",borderRadius:2,width:`${Math.min(100,Math.abs(c.value)/5*100)}%`,background:valColor(c.value) }}/>
                      </div>
                      <span style={{ fontSize:15,fontWeight:700,color:valColor(c.value),
                        fontFamily:"'Barlow Condensed',sans-serif",minWidth:52,textAlign:"right",letterSpacing:"-.3px" }}>
                        {c.value>=0?"+":""}{c.value.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`reveal ${vis?"in":""}`} style={{
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:16,
                padding:"24px 22px", transitionDelay:".17s",
              }}>
                <div style={{ fontSize:15,fontWeight:700,marginBottom:3 }}>By Province</div>
                <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginBottom:18 }}>Year-over-year % · {cur?.date}</div>
                {[...PROVINCES].sort((a,b)=>b.value-a.value).map((p,i) => {
                  const mx = Math.max(...PROVINCES.map(x=>x.value));
                  const clr = valColor(p.value);
                  return (
                    <div key={i} className="row-item">
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <span style={{
                          width:30,height:30,borderRadius:8,
                          background: valBg(p.value),
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:10,fontWeight:700,color:clr,letterSpacing:".02em",
                        }}>{p.code}</span>
                        <span style={{ fontSize:13,fontWeight:500,color:C.textPrimary }}>{p.name}</span>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <div style={{ width:52,height:3,background:C.border2,borderRadius:2,overflow:"hidden" }}>
                          <div style={{ height:"100%",borderRadius:2,width:`${(p.value/mx)*100}%`,background:clr,transition:"width .8s ease" }}/>
                        </div>
                        <span style={{ fontSize:15,fontWeight:700,color:clr,
                          fontFamily:"'Barlow Condensed',sans-serif",minWidth:44,textAlign:"right",letterSpacing:"-.3px" }}>
                          {p.value.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`reveal ${vis?"in":""}`} style={{
              background:C.surface, border:`1px solid ${C.border}`, borderRadius:16,
              padding:"24px 22px 18px", marginBottom:28, transitionDelay:".21s",
            }}>
              <div style={{ fontSize:15,fontWeight:700,marginBottom:3 }}>Category Breakdown</div>
              <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginBottom:18 }}>Year-over-year % by CPI component · {cur?.date}</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={COMPONENTS} margin={{ top:4,right:4,left:-22,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="label"
                    tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                    axisLine={false} tickLine={false}/>
                  <YAxis
                    tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                    axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                  <Tooltip
                    formatter={v=>[`${v>0?"+":""}${v.toFixed(1)}%`,"YoY"]}
                    contentStyle={{ background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:10,
                      fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,
                      boxShadow:"0 8px 32px rgba(0,0,0,.5)",color:C.textPrimary }}
                    labelStyle={{ color:C.textSecondary,fontWeight:600 }}/>
                  <ReferenceLine y={0} stroke={C.border2}/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {COMPONENTS.map((c,i) => <Cell key={i} fill={valColor(c.value)}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={`reveal ${vis?"in":""}`} style={{
              textAlign:"center", fontSize:11, color:C.textMuted, fontWeight:500, lineHeight:2,
              transitionDelay:".25s",
            }}>
              Statistics Canada · Table 18-10-0004-01 · Vector v41690973 · CPI 2002=100 · Monthly, not seasonally adjusted
              {src==="live" && " · Live via Statistics Canada Web Data Service API"}<br/>
              Bank of Canada inflation target: 1–3% band, 2% midpoint · Data from {startYr} · Not an official Statistics Canada product
            </div>
          </>
        )}
      </div>
    </div>
  );
}
