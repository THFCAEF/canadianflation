import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from "recharts";

const FREQS = { monthly: 12, biweekly: 26, weekly: 52 };

const fmt = (n) =>
  "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function App() {
  const [price, setPrice] = useState(1200000);
  const [down, setDown] = useState(20);
  const [downPct, setDownPct] = useState(true);
  const [rate, setRate] = useState(4.5);
  const [amort, setAmort] = useState(25);
  const [infl, setInfl] = useState(3);
  const [income, setIncome] = useState(200000);
  const [freq, setFreq] = useState("monthly");
  const [showReal, setShowReal] = useState(false);
  const [res, setRes] = useState(null);

  function calc() {
    const P = +price;
    const d = +down;
    const r = +rate / 100;
    const a = +amort;

    if (!P || !r || !a) return;

    const downAmt = downPct ? P * (d / 100) : d;
    let principal = P - downAmt;

    let cmhcRate = 0;
    if (downPct && d < 20) {
      if (d < 5) cmhcRate = 0.04;
      else if (d < 10) cmhcRate = 0.031;
      else cmhcRate = 0.028;
    }

    const cmhc = principal * cmhcRate;
    principal += cmhc;

    const n = FREQS[freq];
    const rn = r / n;
    const periods = a * n;

    const payment =
      principal *
      (rn * Math.pow(1 + rn, periods)) /
      (Math.pow(1 + rn, periods) - 1);

    const totalPaid = payment * periods;
    const totalInt = totalPaid - principal;

    const infRate = +infl / 100;
    let realTotalPaid = 0;
    let realPayment = payment;

    if (infRate > 0) {
      const infPer = Math.pow(1 + infRate, 1 / n) - 1;

      for (let t = 1; t <= periods; t++) {
        realTotalPaid += payment / Math.pow(1 + infPer, t);
      }

      realPayment = payment / (1 + infPer);
    } else {
      realTotalPaid = totalPaid;
    }

    const realTotalInt = realTotalPaid - principal;

    const monthly = payment * (freq === "monthly" ? 1 : freq === "biweekly" ? 26/12 : 52/12);
    const ratio = monthly / (income / 12);

    let bal = principal;
    let cumInf = 1;
    const data = [];

    for (let yr = 1; yr <= a; yr++) {
      let intY = 0, prinY = 0;
      cumInf *= (1 + infRate);

      for (let i = 0; i < n; i++) {
        const interest = bal * rn;
        const principalPaid = payment - interest;
        intY += interest;
        prinY += principalPaid;
        bal -= principalPaid;
      }

      data.push({
        year: `Yr ${yr}`,
        Balance: Math.max(0, bal),
        "Real Balance": bal / cumInf,
        Interest: intY,
        Principal: prinY
      });
    }

    setRes({
      payment, realPayment,
      totalPaid, totalInt,
      realTotalPaid, realTotalInt,
      principal, cmhc, ratio,
      data
    });
  }

  const card = {
    background: "#111",
    color: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0b", minHeight: "100vh", color: "white" }}>
      <h1 style={{ marginBottom: 20 }}>Mortgage Dashboard</h1>

      {/* INPUTS */}
      <div style={card}>
        <h3>Inputs</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input placeholder="Home Price" value={price} onChange={e => setPrice(e.target.value)} />
          <input placeholder="Down Payment" value={down} onChange={e => setDown(e.target.value)} />

          <input placeholder="Rate %" value={rate} onChange={e => setRate(e.target.value)} />
          <input placeholder="Years" value={amort} onChange={e => setAmort(e.target.value)} />

          <input placeholder="Inflation %" value={infl} onChange={e => setInfl(e.target.value)} />
          <input placeholder="Income" value={income} onChange={e => setIncome(e.target.value)} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label>
            <input type="checkbox" checked={downPct} onChange={() => setDownPct(!downPct)} />
            Down is %
          </label>

          <br />

          <label>
            <input type="checkbox" checked={showReal} onChange={() => setShowReal(!showReal)} />
            Show Real Values
          </label>
        </div>

        <select value={freq} onChange={e => setFreq(e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="biweekly">Biweekly</option>
          <option value="weekly">Weekly</option>
        </select>

        <button onClick={calc} style={{ marginTop: 10 }}>Calculate</button>
      </div>

      {/* METRICS */}
      {res && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={card}>
              <h4>Payment</h4>
              <p>{fmt(showReal ? res.realPayment : res.payment)}</p>
            </div>

            <div style={card}>
              <h4>Total Interest</h4>
              <p>{fmt(showReal ? res.realTotalInt : res.totalInt)}</p>
            </div>

            <div style={card}>
              <h4>Loan Size</h4>
              <p>{fmt(res.principal)}</p>
            </div>

            <div style={card}>
              <h4>CMHC</h4>
              <p>{fmt(res.cmhc)}</p>
            </div>

            <div style={card}>
              <h4>Income Ratio</h4>
              <p>{(res.ratio * 100).toFixed(1)}%</p>
            </div>

            <div style={card}>
              <h4>Total Paid</h4>
              <p>{fmt(showReal ? res.realTotalPaid : res.totalPaid)}</p>
            </div>
          </div>

          {/* CHARTS */}
          <div style={card}>
            <h3>Balance Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={res.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="Balance" />
                <Line dataKey="Real Balance" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={card}>
            <h3>Interest vs Principal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={res.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Interest" stackId="a" />
                <Bar dataKey="Principal" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
