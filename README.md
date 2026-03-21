# Canadianflation

**canadianflation.ca** — A Canadian inflation tracker built on the principle that economic data belongs to everyone, presented clearly and without spin.

---

## Ethos

Most inflation coverage in Canada is either buried in government tables or filtered through media narratives. Canadianflation exists to cut through both — pulling directly from official sources and putting the raw numbers in front of you with no editorial layer.

**Core principles:**

- **No fake data.** If the API is down, the site says so. No fallback estimates, no interpolated guesses, no numbers we made up.
- **Primary sources only.** Every number on this site traces directly to Statistics Canada or the Bank of Canada. No scraping, no third-party aggregators.
- **Financial literacy is a right, not a privilege.** Understanding how inflation erodes your purchasing power, what your mortgage actually costs you, or whether the Bank of Canada is behind the curve — this is knowledge that affects every Canadian's financial life. It shouldn't require a economics degree or a Bloomberg terminal to access it.
- **Transparency over simplicity.** We show you the methodology — which vectors, which tables, which formula — so you can verify it yourself.

---

## What It Shows

### Inflation Rates
Year-over-year CPI change for Canada, broken down by category (Food, Shelter, Transport, etc.) and by province. Historical chart going back to 1975 using live StatCan monthly data.

### Purchasing Power
How much a Canadian dollar has lost in real value since 1914. Built from StatCan's annual CPI table (18-10-0005-01) merged with monthly data — fully live, no hardcoded history.

### Taylor Rule
Compares the Bank of Canada's actual overnight rate against what the Taylor Rule formula would prescribe given current inflation. A simple, honest benchmark for whether monetary policy is tight or loose.

### Interest Calculator
Compound interest calculator with adjustable frequency, monthly contributions, and rate variance range. Runs entirely client-side — nothing is sent anywhere.

### Mortgage Calculator
Three tools: mortgage payment calculator (with CMHC insurance detection), provincial property transfer tax estimator (all 10 provinces, 2024 brackets), and borrowing capacity calculator. All client-side.

---

## Data Sources

| Data | Source | Table / Series |
|---|---|---|
| Monthly CPI — national, categories, provinces | Statistics Canada WDS API | Table 18-10-0004-01 |
| Annual CPI 1914–present | Statistics Canada WDS API | Table 18-10-0005-01 |
| Bank of Canada overnight rate | Bank of Canada Valet API | STATIC_ATABLE_V39079 |

All data is fetched live on page load. There is no database, no caching layer, and no server — the browser talks directly to official government APIs.

---

## Tech Stack

- **React** (Create React App)
- **Recharts** for all charts
- **Vercel** for hosting and deploys
- **GitHub** for version control — every deploy is a commit

No backend. No database. No analytics. No cookies.

---

## Project Structure

```
canadianflation/
├── public/
│   ├── index.html          # No PWA manifest link — intentional
│   ├── manifest.json       # display: browser — disables install prompt
│   └── robots.txt
├── src/
│   ├── App.js              # Entire application — single file by design
│   ├── index.js
│   └── index.css
├── vercel.json             # Security headers
└── package.json
```

The entire application lives in `src/App.js` by design. Keeping it in one file makes it auditable — anyone can open it and read exactly what the site does.

---

## Running Locally

```bash
git clone https://github.com/THFCAEF/canadianflation.git
cd canadianflation
npm install
npm start
```

The app fetches live data from Statistics Canada and the Bank of Canada. An internet connection is required — if either API is unreachable, the site will display an error rather than show stale or estimated data.

---

## Deploying

Pushes to `main` trigger automatic deploys via Vercel. No build configuration needed beyond what's in `vercel.json`.

---

## A Note on the Data

Statistics Canada publishes CPI data with a one-month lag. The most recent month shown is always the latest officially released figure — not an estimate or projection.

Category-level and provincial CPI data is available from approximately 1979 onward. The national all-items CPI goes back to 1914. The Taylor Rule calculations begin in 1994, when the Bank of Canada formally adopted the overnight rate target.

---

*Not an official government product. For informational purposes only.*
