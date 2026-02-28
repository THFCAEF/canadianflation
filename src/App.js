import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, Legend
} from "recharts";

(function injectHead() {
  if (typeof document === "undefined") return;
  document.title = "Canadianflation — Canadian CPI Tracker";
  const existingFavicon = document.querySelector("link[rel~='icon']");
  if (existingFavicon) existingFavicon.remove();
  const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 110'><path d='M50 2 L54 18 L62 12 L58 26 L72 20 L66 34 L82 30 L74 44 L90 44 L80 54 L88 66 L72 60 L74 76 L60 68 L58 88 L50 78 L42 88 L40 68 L26 76 L28 60 L12 66 L20 54 L10 44 L26 44 L18 30 L34 34 L28 20 L42 26 L38 12 L46 18 Z' fill='%23E05A4A'/><rect x='45' y='78' width='10' height='28' rx='3' fill='%23E05A4A'/></svg>`;
  const link = document.createElement("link");
  link.rel = "icon"; link.type = "image/svg+xml";
  link.href = `data:image/svg+xml,${faviconSvg}`;
  document.head.appendChild(link);
  const metas = [
    { property:"og:title",       content:"Canadianflation — Canadian CPI Tracker" },
    { property:"og:description", content:"Track Canadian inflation in real time. Historical CPI data from 1914 to present, sourced from Statistics Canada." },
    { property:"og:image",       content:"https://www.canadianflation.ca/social-preview.png" },
    { property:"og:url",         content:"https://www.canadianflation.ca" },
    { name:"twitter:card",       content:"summary_large_image" },
  ];
  metas.forEach(attrs => {
    const existing = document.querySelector(`meta[property="${attrs.property}"],meta[name="${attrs.name}"]`);
    if (existing) existing.remove();
    const m = document.createElement("meta");
    Object.entries(attrs).forEach(([k,v]) => m.setAttribute(k,v));
    document.head.appendChild(m);
  });
})();

const C = {
  bg:           "#080E1A",
  surface:      "#0D1626",
  surface2:     "#111E30",
  border:       "#1A2C45",
  border2:      "#203452",
  textPrimary:  "#F4F8FF",
  textSecondary:"#6E88AA",
  textMuted:    "#334D6E",
  red:          "#E05A4A",
  redBg:        "rgba(224,90,74,0.12)",
  yellow:       "#F5C842",
  yellowBg:     "rgba(245,200,66,0.11)",
  green:        "#3ECFA0",
  greenBg:      "rgba(62,207,160,0.10)",
  white:        "#F4F8FF",
  black:        "#080E1A",
};

function valColor(v) { return v > 2 ? C.red : v > 0 ? C.yellow : C.green; }
function valBg(v)    { return v > 2 ? C.redBg : v > 0 ? C.yellowBg : C.greenBg; }

const CAT_HISTORY = [
  { year:"2000", Shelter:2.2, Food:1.8, Transport:4.1,  Health:3.0, Recreation:1.5, Household:1.2, Clothing:-1.0,"Alcohol & Tobacco":2.0 },
  { year:"2001", Shelter:3.1, Food:3.2, Transport:0.8,  Health:3.4, Recreation:1.8, Household:1.0, Clothing:-0.8,"Alcohol & Tobacco":2.3 },
  { year:"2002", Shelter:1.8, Food:1.4, Transport:1.2,  Health:2.8, Recreation:1.2, Household:0.6, Clothing:-1.2,"Alcohol & Tobacco":2.1 },
  { year:"2003", Shelter:3.5, Food:2.8, Transport:3.4,  Health:2.9, Recreation:1.0, Household:0.8, Clothing:-0.9,"Alcohol & Tobacco":2.4 },
  { year:"2004", Shelter:2.8, Food:1.9, Transport:2.2,  Health:2.6, Recreation:0.8, Household:0.5, Clothing:-0.7,"Alcohol & Tobacco":2.2 },
  { year:"2005", Shelter:3.0, Food:1.5, Transport:3.8,  Health:2.4, Recreation:0.9, Household:0.4, Clothing:-0.5,"Alcohol & Tobacco":2.5 },
  { year:"2006", Shelter:2.5, Food:1.2, Transport:1.4,  Health:2.2, Recreation:0.7, Household:0.3, Clothing:-0.6,"Alcohol & Tobacco":2.3 },
  { year:"2007", Shelter:2.9, Food:2.4, Transport:1.0,  Health:2.3, Recreation:0.8, Household:0.4, Clothing:-0.4,"Alcohol & Tobacco":2.4 },
  { year:"2008", Shelter:3.4, Food:3.8, Transport:4.2,  Health:2.5, Recreation:1.1, Household:0.6, Clothing:-0.3,"Alcohol & Tobacco":2.6 },
  { year:"2009", Shelter:2.2, Food:1.6, Transport:-5.8, Health:2.4, Recreation:0.5, Household:-0.2,Clothing:-1.0,"Alcohol & Tobacco":2.1 },
  { year:"2010", Shelter:2.0, Food:1.4, Transport:2.8,  Health:2.2, Recreation:0.6, Household:0.2, Clothing:-0.8,"Alcohol & Tobacco":2.0 },
  { year:"2011", Shelter:2.8, Food:3.7, Transport:4.0,  Health:2.4, Recreation:0.9, Household:1.0, Clothing:0.2, "Alcohol & Tobacco":2.3 },
  { year:"2012", Shelter:3.2, Food:2.8, Transport:1.8,  Health:2.5, Recreation:0.7, Household:0.6, Clothing:0.0, "Alcohol & Tobacco":2.4 },
  { year:"2013", Shelter:2.6, Food:1.5, Transport:0.6,  Health:2.1, Recreation:0.5, Household:0.3, Clothing:-0.3,"Alcohol & Tobacco":2.2 },
  { year:"2014", Shelter:2.4, Food:2.2, Transport:1.2,  Health:2.0, Recreation:0.6, Household:0.4, Clothing:0.1, "Alcohol & Tobacco":2.3 },
  { year:"2015", Shelter:3.1, Food:3.8, Transport:-0.5, Health:2.1, Recreation:1.0, Household:0.5, Clothing:0.3, "Alcohol & Tobacco":2.5 },
  { year:"2016", Shelter:3.3, Food:2.3, Transport:-3.1, Health:2.2, Recreation:0.8, Household:0.2, Clothing:0.1, "Alcohol & Tobacco":2.8 },
  { year:"2017", Shelter:2.9, Food:0.8, Transport:4.2,  Health:2.4, Recreation:0.9, Household:0.6, Clothing:-0.4,"Alcohol & Tobacco":3.1 },
  { year:"2018", Shelter:3.4, Food:1.2, Transport:3.8,  Health:2.6, Recreation:1.1, Household:0.8, Clothing:-0.2,"Alcohol & Tobacco":3.3 },
  { year:"2019", Shelter:3.0, Food:2.1, Transport:0.4,  Health:2.3, Recreation:0.7, Household:0.4, Clothing:-0.5,"Alcohol & Tobacco":3.0 },
  { year:"2020", Shelter:2.4, Food:2.8, Transport:-4.2, Health:2.5, Recreation:-0.8,Household:0.2, Clothing:-2.1,"Alcohol & Tobacco":2.7 },
  { year:"2021", Shelter:3.8, Food:1.8, Transport:4.8,  Health:2.1, Recreation:0.3, Household:2.4, Clothing:0.8, "Alcohol & Tobacco":2.9 },
  { year:"2022", Shelter:6.9, Food:8.9, Transport:9.2,  Health:3.4, Recreation:4.1, Household:5.8, Clothing:3.2, "Alcohol & Tobacco":4.1 },
  { year:"2023", Shelter:6.1, Food:9.1, Transport:-1.4, Health:3.8, Recreation:2.9, Household:2.1, Clothing:0.4, "Alcohol & Tobacco":4.3 },
  { year:"2024", Shelter:5.4, Food:2.8, Transport:-2.1, Health:3.5, Recreation:1.5, Household:1.2, Clothing:-0.4,"Alcohol & Tobacco":3.5 },
  { year:"2025", Shelter:4.5, Food:3.1, Transport:-3.2, Health:3.4, Recreation:1.2, Household:0.8, Clothing:-0.9,"Alcohol & Tobacco":3.0 },
];

const PROV_HISTORY = [
  { year:"2000", BC:2.1, AB:2.8, SK:1.9, MB:2.4, ON:2.3, QC:2.0, NB:1.8, NS:1.7, PE:1.6, NL:2.2 },
  { year:"2001", BC:2.4, AB:2.5, SK:2.2, MB:2.6, ON:2.5, QC:2.1, NB:2.0, NS:1.9, PE:1.8, NL:2.4 },
  { year:"2002", BC:1.8, AB:1.9, SK:1.6, MB:2.0, ON:1.9, QC:1.6, NB:1.5, NS:1.4, PE:1.3, NL:1.8 },
  { year:"2003", BC:2.6, AB:2.8, SK:2.4, MB:2.9, ON:2.7, QC:2.3, NB:2.2, NS:2.1, PE:2.0, NL:2.6 },
  { year:"2004", BC:2.0, AB:2.2, SK:1.8, MB:2.3, ON:2.1, QC:1.8, NB:1.7, NS:1.6, PE:1.5, NL:2.0 },
  { year:"2005", BC:2.3, AB:2.9, SK:2.0, MB:2.5, ON:2.2, QC:1.9, NB:1.8, NS:1.7, PE:1.6, NL:2.3 },
  { year:"2006", BC:2.0, AB:3.5, SK:1.8, MB:2.2, ON:2.0, QC:1.7, NB:1.6, NS:1.5, PE:1.4, NL:2.0 },
  { year:"2007", BC:2.3, AB:3.8, SK:2.1, MB:2.5, ON:2.2, QC:1.9, NB:1.8, NS:1.7, PE:1.6, NL:2.3 },
  { year:"2008", BC:2.8, AB:3.2, SK:2.6, MB:3.0, ON:2.7, QC:2.3, NB:2.2, NS:2.1, PE:2.0, NL:2.8 },
  { year:"2009", BC:0.6, AB:0.2, SK:0.8, MB:1.2, ON:0.5, QC:0.4, NB:0.6, NS:0.5, PE:0.4, NL:0.8 },
  { year:"2010", BC:1.4, AB:1.2, SK:1.6, MB:1.8, ON:1.5, QC:1.2, NB:1.4, NS:1.3, PE:1.2, NL:1.6 },
  { year:"2011", BC:2.8, AB:2.6, SK:2.9, MB:3.2, ON:2.9, QC:2.5, NB:2.4, NS:2.3, PE:2.2, NL:2.8 },
  { year:"2012", BC:2.2, AB:2.4, SK:2.0, MB:2.5, ON:2.3, QC:1.9, NB:1.8, NS:1.7, PE:1.6, NL:2.2 },
  { year:"2013", BC:1.6, AB:1.8, SK:1.4, MB:1.9, ON:1.7, QC:1.4, NB:1.3, NS:1.2, PE:1.1, NL:1.6 },
  { year:"2014", BC:1.9, AB:2.1, SK:1.7, MB:2.2, ON:2.0, QC:1.7, NB:1.6, NS:1.5, PE:1.4, NL:1.9 },
  { year:"2015", BC:1.1, AB:1.2, SK:1.0, MB:1.8, ON:1.3, QC:1.2, NB:0.9, NS:0.8, PE:0.7, NL:1.4 },
  { year:"2016", BC:2.4, AB:1.4, SK:1.5, MB:1.5, ON:2.1, QC:1.3, NB:1.2, NS:1.0, PE:1.1, NL:1.6 },
  { year:"2017", BC:3.0, AB:1.8, SK:1.6, MB:2.0, ON:2.3, QC:1.6, NB:1.5, NS:1.4, PE:1.3, NL:1.9 },
  { year:"2018", BC:2.8, AB:2.2, SK:1.9, MB:2.3, ON:2.5, QC:1.9, NB:1.8, NS:1.7, PE:1.6, NL:2.2 },
  { year:"2019", BC:2.2, AB:1.6, SK:1.5, MB:2.0, ON:2.0, QC:1.7, NB:1.6, NS:1.5, PE:1.4, NL:1.8 },
  { year:"2020", BC:1.4, AB:0.6, SK:0.9, MB:1.4, ON:0.8, QC:0.9, NB:0.8, NS:0.7, PE:0.6, NL:1.0 },
  { year:"2021", BC:3.8, AB:3.2, SK:3.0, MB:3.5, ON:3.6, QC:3.0, NB:3.1, NS:2.9, PE:2.8, NL:3.4 },
  { year:"2022", BC:7.6, AB:8.2, SK:7.4, MB:8.0, ON:7.9, QC:7.1, NB:7.3, NS:7.0, PE:6.9, NL:7.5 },
  { year:"2023", BC:4.1, AB:5.2, SK:4.0, MB:4.8, ON:4.3, QC:3.8, NB:3.9, NS:3.7, PE:3.6, NL:4.4 },
  { year:"2024", BC:2.8, AB:3.1, SK:2.2, MB:3.6, ON:2.7, QC:2.4, NB:2.3, NS:2.5, PE:2.1, NL:2.9 },
  { year:"2025", BC:2.5, AB:2.8, SK:1.8, MB:3.3, ON:2.4, QC:2.1, NB:2.0, NS:2.2, PE:1.8, NL:2.6 },
];

const CAT_COLORS = {
  "Shelter":"#E05A4A","Food":"#F5C842","Transport":"#3ECFA0",
  "Health":"#5B8FD4","Recreation":"#B07FE8","Household":"#F0814A",
  "Clothing":"#4AC8E8","Alcohol & Tobacco":"#E8A23A",
};
const PROV_COLORS = {
  BC:"#E05A4A",AB:"#F5C842",SK:"#3ECFA0",MB:"#5B8FD4",
  ON:"#B07FE8",QC:"#F0814A",NB:"#4AC8E8",NS:"#E8A23A",
  PE:"#A0C878",NL:"#E87AB0",
};

const STATCAN_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";
const CPI_VECTOR = 41690973;

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
  { label:"Shelter",           key:"Shelter",           value:4.5,  icon:"🏠" },
  { label:"Health & Personal", key:"Health",            value:3.4,  icon:"💊" },
  { label:"Food",              key:"Food",              value:3.1,  icon:"🥦" },
  { label:"Alcohol & Tobacco", key:"Alcohol & Tobacco", value:3.0,  icon:"🍺" },
  { label:"Recreation",        key:"Recreation",        value:1.2,  icon:"📚" },
  { label:"Household",         key:"Household",         value:0.8,  icon:"🛋️" },
  { label:"Clothing",          key:"Clothing",          value:-0.9, icon:"👗" },
  { label:"Transport",         key:"Transport",         value:-3.2, icon:"🚗" },
];

const PROVINCES = [
  { code:"BC", name:"British Columbia", key:"BC", value:2.5 },
  { code:"AB", name:"Alberta",          key:"AB", value:2.8 },
  { code:"SK", name:"Saskatchewan",     key:"SK", value:1.8 },
  { code:"MB", name:"Manitoba",         key:"MB", value:3.3 },
  { code:"ON", name:"Ontario",          key:"ON", value:2.4 },
  { code:"QC", name:"Québec",           key:"QC", value:2.1 },
  { code:"NB", name:"New Brunswick",    key:"NB", value:2.0 },
  { code:"NS", name:"Nova Scotia",      key:"NS", value:2.2 },
  { code:"PE", name:"P.E.I.",           key:"PE", value:1.8 },
  { code:"NL", name:"Newfoundland",     key:"NL", value:2.6 },
];

const BOC = 2.0;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const RANGES = { "2Y":24,"5Y":60,"10Y":120,"25Y":300,"All":99999 };

function fmtDate(iso) {
  const d = new Date(iso.slice(0,10)+"T12:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function computeYoY(raw) {
  const map = {};
  raw.forEach(([d,v]) => { map[d.slice(0,7)] = v; });
  return Object.keys(map).sort().reduce((acc,k) => {
    const [y,m] = k.split("-").map(Number);
    const pk = `${y-1}-${String(m).padStart(2,"0")}`;
    if (map[pk] != null)
      acc.push({ date:fmtDate(k+"-01"), iso:k+"-01", value:+((map[k]-map[pk])/map[pk]*100).toFixed(1) });
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

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:10,padding:"12px 16px",boxShadow:"0 8px 32px rgba(0,0,0,.6)",fontFamily:"'Plus Jakarta Sans',sans-serif",minWidth:160 }}>
      <div style={{ fontSize:11,fontWeight:600,color:C.textSecondary,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
          <span style={{ width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0 }}/>
          <span style={{ fontSize:11,color:C.textSecondary,minWidth:90 }}>{p.name}</span>
          <span style={{ fontSize:14,fontWeight:700,color:p.color,fontFamily:"'Barlow Condensed',sans-serif",marginLeft:"auto" }}>
            {p.value > 0 ? "+" : ""}{p.value?.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
};

const MainChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:10,padding:"12px 16px",boxShadow:"0 8px 32px rgba(0,0,0,.6)",fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ fontSize:11,fontWeight:600,color:C.textSecondary,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:28,fontWeight:700,color:valColor(v),fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"-.5px",lineHeight:1 }}>
        {v > 0 ? "+" : ""}{v.toFixed(1)}%
      </div>
      <div style={{ fontSize:11,color:C.textMuted,marginTop:5 }}>
        {v > BOC ? `+${(v-BOC).toFixed(1)}pp above BoC target` : `${(BOC-v).toFixed(1)}pp below BoC target`}
      </div>
    </div>
  );
};

function FilterPill({ label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"inline-flex",alignItems:"center",gap:5,
      background: active ? `${color}20` : "none",
      border:`1px solid ${active ? color : C.border}`,
      color: active ? color : C.textMuted,
      borderRadius:100,padding:"3px 10px",fontSize:11,fontWeight:600,
      cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .15s",
    }}>
      <span style={{ width:6,height:6,borderRadius:"50%",background:active?color:C.textMuted,flexShrink:0 }}/>
      {label}
    </button>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState("loading");
  const [range, setRange] = useState("10Y");
  const [vis, setVis] = useState(false);
  const [activeCats, setActiveCats] = useState(Object.fromEntries(Object.keys(CAT_COLORS).map(k=>[k,true])));
  const [activeProvs, setActiveProvs] = useState(Object.fromEntries(PROVINCES.map(p=>[p.key,true])));

  const load = useCallback(async () => {
    setLoading(true); setVis(false);
    try {
      const res = await fetch(`${STATCAN_BASE}/getDataFromVectorsAndLatestNPeriods`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify([{vectorId:CPI_VECTOR,latestN:1500}]),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = parseWDS(json);
      if (!raw||raw.length<24) throw new Error();
      setData(computeYoY(raw)); setSrc("live");
    } catch {
      setData(computeYoY(FALLBACK_CPI_RAW)); setSrc("fallback");
    } finally {
      setLoading(false); setTimeout(()=>setVis(true),60);
    }
  },[]);

  useEffect(()=>{load();},[load]);

  const chart   = data ? data.slice(-Math.min(RANGES[range],data.length)) : [];
  const cur     = data?.[data.length-1];
  const prev    = data?.[data.length-2];
  const peak    = data?.reduce((a,b)=>b.value>a.value?b:a);
  const l12     = data?.slice(-12)??[];
  const lo12    = l12.length?Math.min(...l12.map(d=>d.value)):0;
  const hi12    = l12.length?Math.max(...l12.map(d=>d.value)):0;
  const startYr = data?.[0]?.iso?new Date(data[0].iso).getFullYear():"—";
  const delta   = cur&&prev?+(cur.value-prev.value).toFixed(1):0;
  const ti      = range==="2Y"?2:range==="5Y"?5:range==="10Y"?11:range==="25Y"?28:Math.max(1,Math.floor(chart.length/11));
  const sortedProvs = [...PROVINCES].sort((a,b)=>b.value-a.value);

  return (
    <div style={{ minHeight:"100vh",background:C.bg,color:C.textPrimary,fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:2px}
        .reveal{opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s ease}
        .reveal.in{opacity:1;transform:translateY(0)}
        .rb{background:none;border:1px solid ${C.border};color:${C.textSecondary};padding:5px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif}
        .rb.on{background:${C.yellow};border-color:${C.yellow};color:#000}
        .rb:hover:not(.on){border-color:${C.border2};color:${C.textPrimary}}
        .row-item{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid ${C.border}}
        .row-item:last-child{border-bottom:none}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{border:2px solid ${C.border};border-top-color:${C.yellow};border-radius:50%;animation:spin .7s linear infinite}
      `}</style>

      <nav style={{ background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 28px",height:60,display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(12px)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:0 }}>
          <span style={{ fontFamily:"'DM Sans',sans-serif",fontSize:20,fontWeight:700,letterSpacing:"-.3px",color:C.white }}>Canadian</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif",fontSize:20,fontWeight:700,letterSpacing:"-.3px",color:C.red }}>flation</span>
        </div>
      </nav>

      <div style={{ maxWidth:1060,margin:"0 auto",padding:"36px 20px 80px" }}>
        {loading ? (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:400,gap:16 }}>
            <div className="spin" style={{ width:40,height:40,borderWidth:3 }}/>
            <p style={{ color:C.textMuted,fontSize:13,fontWeight:500 }}>Fetching historical CPI data…</p>
          </div>
        ):(<>

          <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,marginBottom:20,overflow:"hidden",backgroundImage:`radial-gradient(${C.border} 1px,transparent 1px)`,backgroundSize:"24px 24px" }}>
            <div style={{ background:`linear-gradient(135deg,${C.surface} 55%,transparent)`,padding:"36px 36px 0" }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:".12em",marginBottom:14 }}>Canada · All-Items CPI · Year-over-Year · {cur?.date}</div>
              <div style={{ display:"flex",alignItems:"flex-end",gap:20,flexWrap:"wrap",marginBottom:24 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(72px,10vw,100px)",fontWeight:700,lineHeight:1,letterSpacing:"-2px",color:valColor(cur?.value) }}>
                  {cur?.value.toFixed(1)}%
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:8,paddingBottom:10 }}>
                  {prev&&(
                    <span style={{ display:"inline-flex",alignItems:"center",gap:5,background:valBg(delta),color:valColor(delta),borderRadius:6,padding:"5px 11px",fontSize:13,fontWeight:700,border:`1px solid ${valColor(delta)}30` }}>
                      {delta>0?"▲":delta<0?"▼":"—"}&nbsp;{Math.abs(delta).toFixed(1)}pp&nbsp;<span style={{ color:C.textSecondary,fontWeight:500 }}>vs {prev.date}</span>
                    </span>
                  )}
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                    {[`BoC target ${BOC.toFixed(1)}%`,peak?`Peak ${peak.value.toFixed(1)}% · ${peak.date}`:null,`${data?.length} months · ${startYr}–present`].filter(Boolean).map((t,i)=>(
                      <span key={i} style={{ fontSize:11,fontWeight:600,color:C.textMuted,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 9px" }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderTop:`1px solid ${C.border}` }}>
              {[
                {label:"vs. BoC Target",val:`${cur?.value>BOC?"+":""}${(cur?.value-BOC).toFixed(1)}pp`,color:valColor(cur?.value)},
                {label:"Prior Month",val:`${prev?.value.toFixed(1)}%`,color:C.white},
                {label:"12-Mo Low",val:`${lo12.toFixed(1)}%`,color:C.green},
                {label:"12-Mo High",val:`${hi12.toFixed(1)}%`,color:C.red},
              ].map((s,i)=>(
                <div key={i} style={{ padding:"18px 24px",borderRight:i<3?`1px solid ${C.border}`:"none",background:C.surface }}>
                  <div style={{ fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:".1em",marginBottom:7 }}>{s.label}</div>
                  <div style={{ fontSize:24,fontWeight:700,color:s.color,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"-.5px" }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"26px 24px 18px",marginBottom:20,transitionDelay:".07s" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12 }}>
              <div>
                <div style={{ fontSize:15,fontWeight:700,color:C.textPrimary,letterSpacing:"-.2px" }}>Inflation History</div>
                <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginTop:3 }}>Year-over-year % · {chart[0]?.date} – {chart[chart.length-1]?.date}</div>
              </div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {Object.keys(RANGES).map(r=>(<button key={r} className={`rb ${range===r?"on":""}`} onClick={()=>setRange(r)}>{r}</button>))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chart} margin={{ top:4,right:4,left:-20,bottom:0 }}>
                <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={C.red}/><stop offset="45%" stopColor={C.yellow}/><stop offset="100%" stopColor={C.green}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="date" tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }} axisLine={{ stroke:C.border }} tickLine={false} interval={ti}/>
                <YAxis tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={["auto","auto"]}/>
                <Tooltip content={<MainChartTip/>}/>
                <ReferenceLine y={BOC} stroke={C.border2} strokeDasharray="4 3" label={{ value:"BoC 2%",fill:C.textMuted,fontSize:10,fontFamily:"'Plus Jakarta Sans',sans-serif",position:"insideTopRight" }}/>
                <ReferenceLine y={0} stroke={C.border}/>
                <Line type="monotone" dataKey="value" stroke="url(#lg)" strokeWidth={2} dot={false} activeDot={{ r:4,fill:C.yellow,stroke:C.surface,strokeWidth:2 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:20 }}>
            <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px 22px",transitionDelay:".13s" }}>
              <div style={{ fontSize:15,fontWeight:700,marginBottom:3 }}>By Category</div>
              <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginBottom:18 }}>Year-over-year % · {cur?.date}</div>
              {COMPONENTS.map((c,i)=>(
                <div key={i} className="row-item">
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ width:30,height:30,borderRadius:8,background:valBg(c.value),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>{c.icon}</span>
                    <span style={{ fontSize:13,fontWeight:600,color:C.textPrimary }}>{c.label}</span>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:52,height:3,background:C.border2,borderRadius:2,overflow:"hidden" }}>
                      <div style={{ height:"100%",borderRadius:2,width:`${Math.min(100,Math.abs(c.value)/5*100)}%`,background:valColor(c.value) }}/>
                    </div>
                    <span style={{ fontSize:15,fontWeight:700,color:valColor(c.value),fontFamily:"'Barlow Condensed',sans-serif",minWidth:52,textAlign:"right",letterSpacing:"-.3px" }}>
                      {c.value>=0?"+":""}{c.value.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px 22px",transitionDelay:".17s" }}>
              <div style={{ fontSize:15,fontWeight:700,marginBottom:3 }}>By Province</div>
              <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginBottom:18 }}>Year-over-year % · {cur?.date}</div>
              {sortedProvs.map((p,i)=>{
                const mx=Math.max(...PROVINCES.map(x=>x.value));
                const clr=valColor(p.value);
                return (
                  <div key={i} className="row-item">
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <span style={{ width:30,height:30,borderRadius:8,background:valBg(p.value),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:clr }}>{p.code}</span>
                      <span style={{ fontSize:13,fontWeight:500,color:C.textPrimary }}>{p.name}</span>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <div style={{ width:52,height:3,background:C.border2,borderRadius:2,overflow:"hidden" }}>
                        <div style={{ height:"100%",borderRadius:2,width:`${(p.value/mx)*100}%`,background:clr,transition:"width .8s ease" }}/>
                      </div>
                      <span style={{ fontSize:15,fontWeight:700,color:clr,fontFamily:"'Barlow Condensed',sans-serif",minWidth:44,textAlign:"right",letterSpacing:"-.3px" }}>
                        {p.value.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px 22px 20px",marginBottom:20,transitionDelay:".20s" }}>
            <div style={{ fontSize:15,fontWeight:700,marginBottom:3 }}>Category Trends Over Time</div>
            <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginBottom:16 }}>Year-over-year % by CPI component · Annual · 2000–2025</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:20 }}>
              {Object.keys(CAT_COLORS).map(k=>(<FilterPill key={k} label={k} color={CAT_COLORS[k]} active={activeCats[k]} onClick={()=>setActiveCats(p=>({...p,[k]:!p[k]}))}/>))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={CAT_HISTORY} margin={{ top:4,right:8,left:-20,bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="year" tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }} axisLine={{ stroke:C.border }} tickLine={false}/>
                <YAxis tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <Tooltip content={<ChartTip/>}/>
                <ReferenceLine y={BOC} stroke={C.border2} strokeDasharray="4 3" label={{ value:"BoC 2%",fill:C.textMuted,fontSize:10,fontFamily:"'Plus Jakarta Sans',sans-serif",position:"insideTopRight" }}/>
                <ReferenceLine y={0} stroke={C.border}/>
                {Object.keys(CAT_COLORS).map(k=>activeCats[k]?(<Line key={k} type="monotone" dataKey={k} stroke={CAT_COLORS[k]} strokeWidth={2} dot={false} name={k} activeDot={{ r:4,stroke:C.surface,strokeWidth:2 }}/>):null)}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className={`reveal ${vis?"in":""}`} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px 22px 20px",marginBottom:28,transitionDelay:".24s" }}>
            <div style={{ fontSize:15,fontWeight:700,marginBottom:3 }}>Provincial Trends Over Time</div>
            <div style={{ fontSize:11,color:C.textSecondary,fontWeight:500,marginBottom:16 }}>Year-over-year % by province · Annual · 2000–2025</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:20 }}>
              {PROVINCES.map(p=>(<FilterPill key={p.key} label={p.code} color={PROV_COLORS[p.key]} active={activeProvs[p.key]} onClick={()=>setActiveProvs(prev=>({...prev,[p.key]:!prev[p.key]}))}/>))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={PROV_HISTORY} margin={{ top:4,right:8,left:-20,bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="year" tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }} axisLine={{ stroke:C.border }} tickLine={false}/>
                <YAxis tick={{ fill:C.textMuted,fontSize:10,fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <Tooltip content={<ChartTip/>}/>
                <ReferenceLine y={BOC} stroke={C.border2} strokeDasharray="4 3" label={{ value:"BoC 2%",fill:C.textMuted,fontSize:10,fontFamily:"'Plus Jakarta Sans',sans-serif",position:"insideTopRight" }}/>
                {PROVINCES.map(p=>activeProvs[p.key]?(<Line key={p.key} type="monotone" dataKey={p.key} stroke={PROV_COLORS[p.key]} strokeWidth={2} dot={false} name={p.name} activeDot={{ r:4,stroke:C.surface,strokeWidth:2 }}/>):null)}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className={`reveal ${vis?"in":""}`} style={{ textAlign:"center",fontSize:11,color:C.textMuted,fontWeight:500,lineHeight:2,transitionDelay:".28s",borderTop:`1px solid ${C.border}`,paddingTop:20 }}>
            © 2026 Canadianflation.ca · Data: Statistics Canada · Not an official government product
          </div>

        </>)}
      </div>
    </div>
  );
}
