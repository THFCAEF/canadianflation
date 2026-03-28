import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, Legend
} from "recharts";

const FREQS = {
  monthly: 12,
  biweekly: 26,
  weekly: 52
};

export default function App() {
  const [price, setPrice] = useState(1200000);
  const [down, setDown] = useState(20);
  const [downPct, setDownPct] = useState(true);
  const [rate, setRate] = useState(4.5);
  const [amort, setAmort] = useState(25);
  const [inflRate, setInflRate] = useState(3);
  const [payFreq, setPayFreq] = useState("monthly");
  const [result, setResult] = useState(null);

  function calc() {
    const P = parseFloat(price);
    const d = parseFloat(down) || 0;
    const r = parseFloat(rate) / 100;
    const a = parseFloat(amort);

    if (!P || !r || !a) return;

    const downAmt = downPct ? P * (d / 100) : d;
    const principal = P - downAmt;

    const n = FREQS[payFreq];
    const rn = r / n;
    const periods = a * n;

    // payment (unchanged)
    const payment =
      principal *
      (rn * Math.pow(1 + rn, periods)) /
      (Math.pow(1 + rn, periods) - 1);

    const totalPaid = payment * periods;
    const totalInt = totalPaid - principal;

    const inf = parseFloat(inflRate) / 100 || 0;

    // ✅ FIXED: correct present value calculation
    let realTotalPaid = 0;

    if (inf > 0) {
      const infPerPeriod = Math.pow(1 + inf, 1 / n) - 1;

      for (let t = 1; t <= periods; t++) {
        realTotalPaid += payment / Math.pow(1 + infPerPeriod, t);
      }
    } else {
      realTotalPaid = totalPaid;
    }

    const realTotalInt = realTotalPaid - principal;

    // amortization (unchanged)
    let bal = principal;
    let cumulativeInf = 1;
    const chartData = [];

    for (let yr = 1; yr <= a; yr++) {
      let intYr = 0;
      let prinYr = 0;

      cumulativeInf *= (1 + inf);

      for (let i = 0; i < n; i++) {
        const interest = bal * rn;
        const principalPaid = payment - interest;

        intYr += interest;
        prinYr += principalPaid;
        bal -= principalPaid;
      }

      const nomBal = Math.max(bal, 0);

      chartData.push({
        year: `Yr ${yr}`,
        Balance: +nomBal.toFixed(0),
        "Real Balance": inf > 0
          ? +(nomBal / cumulativeInf).toFixed(0)
          : null,
        Interest: +intYr.toFixed(0),
        Principal: +prinYr.toFixed(0),
      });
    }

    setResult({
      payment,
      totalPaid,
      totalInt,
      principal,
      downAmt,
      realTotalPaid,
      realTotalInt,
      chartData
    });
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Mortgage Calculator</h2>

      <input value={price} onChange={e => setPrice(e.target.value)} />
      <input value={down} onChange={e => setDown(e.target.value)} />
      <input value={rate} onChange={e => setRate(e.target.value)} />
      <input value={amort} onChange={e => setAmort(e.target.value)} />
      <input value={inflRate} onChange={e => setInflRate(e.target.value)} />

      <select value={payFreq} onChange={e => setPayFreq(e.target.value)}>
        <option value="monthly">Monthly</option>
        <option value="biweekly">Biweekly</option>
        <option value="weekly">Weekly</option>
      </select>

      <button onClick={calc}>Calculate</button>

      {result && (
        <>
          <p>Payment: {result.payment.toFixed(0)}</p>
          <p>Total Paid: {result.totalPaid.toFixed(0)}</p>
          <p>Total Interest: {result.totalInt.toFixed(0)}</p>
          <p>Real Total Paid: {result.realTotalPaid.toFixed(0)}</p>
          <p>Real Interest: {result.realTotalInt.toFixed(0)}</p>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={result.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="Balance" />
              <Line dataKey="Real Balance" />
            </LineChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={result.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Interest" stackId="a" />
              <Bar dataKey="Principal" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
