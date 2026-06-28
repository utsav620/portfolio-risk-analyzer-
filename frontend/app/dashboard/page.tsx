"use client";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, ScatterChart, Scatter,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Shield, Zap, Target, BarChart2, RefreshCw, Wifi, WifiOff, GitBranch, Clock, AlertTriangle } from "lucide-react";

const API = "https://portfolio-risk-intelligence-platform.onrender.com";

// ── Monochrome palette: white → zinc shades only ──────────────────
const SLICE_COLORS = ["#ffffff", "#a1a1aa", "#71717a", "#52525b"];

interface PortfolioMetrics {
  expected_return: number; volatility: number; sharpe_ratio: number;
  value_at_risk: number; var_99: number; cvar_95: number;
  max_drawdown: number; beta: number;
  individual: { ticker: string; weight: number; annual_return: number; volatility: number }[];
}
interface MonteCarloResult {
  simulations: number[][]; percentile_5: number; percentile_50: number;
  percentile_95: number; mean_final: number;
}
interface OptimizeResult {
  tickers: string[]; optimal_weights: number[];
  expected_return: number; volatility: number; sharpe_ratio: number;
}
interface FrontierPoint { volatility: number; return: number; }
interface CorrCell { x: string; y: string; value: number; }
interface EquityPoint { date: string; portfolio: number; spy: number; }
interface DrawdownPoint { date: string; drawdown: number; }
interface BacktestResult {
  equity_curve: EquityPoint[];
  drawdown_curve: DrawdownPoint[];
  total_return_portfolio: number;
  total_return_spy: number;
  alpha: number;
}
interface StressScenario {
  scenario: string;
  portfolio_impact: number;
  worst_day: number;
  path: number[];
}

// ── Demo data (shown when backend is offline) ─────────────────────
const DEMO_METRICS: PortfolioMetrics = {
  expected_return: 18.4, volatility: 22.1, sharpe_ratio: 2.31,
  value_at_risk: -1.82, var_99: -2.94, cvar_95: -2.41,
  max_drawdown: -18.7, beta: 1.14,
  individual: [
    { ticker: "AAPL", weight: 35, annual_return: 22.4, volatility: 24.1 },
    { ticker: "TSLA", weight: 25, annual_return: 31.2, volatility: 58.3 },
    { ticker: "MSFT", weight: 20, annual_return: 14.8, volatility: 19.7 },
    { ticker: "NVDA", weight: 20, annual_return: 87.3, volatility: 61.2 },
  ],
};

function makeDemoMC(): MonteCarloResult {
  const sims: number[][] = [];
  for (let s = 0; s < 120; s++) {
    const path = [10000];
    for (let d = 0; d < 252; d++) {
      const r = (Math.random() - 0.47) * 0.022;
      path.push(path[path.length - 1] * (1 + r));
    }
    sims.push(path);
  }
  const finals = sims.map((p) => p[p.length - 1]);
  finals.sort((a, b) => a - b);
  return {
    simulations: sims,
    percentile_5: finals[Math.floor(finals.length * 0.05)],
    percentile_50: finals[Math.floor(finals.length * 0.5)],
    percentile_95: finals[Math.floor(finals.length * 0.95)],
    mean_final: finals.reduce((a, b) => a + b, 0) / finals.length,
  };
}

const DEMO_OPTIMIZED: OptimizeResult = {
  tickers: ["AAPL", "TSLA", "MSFT", "NVDA"],
  optimal_weights: [28.4, 18.2, 32.1, 21.3],
  expected_return: 21.7, volatility: 19.8, sharpe_ratio: 2.74,
};

const DEMO_FRONTIER: FrontierPoint[] = Array.from({ length: 30 }, (_, i) => ({
  volatility: 10 + i * 1.2,
  return: 4 + Math.sqrt(i) * 3.8,
}));

const DEMO_INSIGHTS = [
  "Strong risk-adjusted performance with a Sharpe ratio of 2.31 — well above the institutional benchmark of 1.0.",
  "Concentration risk detected: AAPL represents 35.0% of the portfolio. Consider capping single-asset exposure at 30–35%.",
  "Portfolio annualized volatility of 22.1% is within an acceptable institutional range.",
  "Daily 95% VaR of -1.82% implies that on the worst 5% of trading days, losses could exceed this threshold on a $1M portfolio (≈$18,200).",
  "Portfolio is generating 4.20% alpha over SPY. Outperforming the benchmark.",
];

const DEMO_CORRELATION: CorrCell[] = [
  { x: "AAPL", y: "AAPL", value: 1.0 }, { x: "TSLA", y: "AAPL", value: 0.42 }, { x: "MSFT", y: "AAPL", value: 0.78 }, { x: "NVDA", y: "AAPL", value: 0.61 },
  { x: "AAPL", y: "TSLA", value: 0.42 }, { x: "TSLA", y: "TSLA", value: 1.0 }, { x: "MSFT", y: "TSLA", value: 0.38 }, { x: "NVDA", y: "TSLA", value: 0.51 },
  { x: "AAPL", y: "MSFT", value: 0.78 }, { x: "TSLA", y: "MSFT", value: 0.38 }, { x: "MSFT", y: "MSFT", value: 1.0 }, { x: "NVDA", y: "MSFT", value: 0.69 },
  { x: "AAPL", y: "NVDA", value: 0.61 }, { x: "TSLA", y: "NVDA", value: 0.51 }, { x: "MSFT", y: "NVDA", value: 0.69 }, { x: "NVDA", y: "NVDA", value: 1.0 },
];

function makeDemoBacktest(): BacktestResult {
  const days = 252;
  const equity: EquityPoint[] = [];
  const drawdown: DrawdownPoint[] = [];
  let portVal = 10000, spyVal = 10000, maxPort = 10000;
  for (let i = 0; i < days; i++) {
    portVal *= 1 + (Math.random() - 0.46) * 0.018;
    spyVal *= 1 + (Math.random() - 0.48) * 0.012;
    maxPort = Math.max(maxPort, portVal);
    const dd = ((portVal - maxPort) / maxPort) * 100;
    equity.push({ date: `2024-${String(Math.floor(i / 21) + 1).padStart(2, "0")}-${String((i % 21) + 1).padStart(2, "0")}`, portfolio: portVal, spy: spyVal });
    drawdown.push({ date: equity[i].date, drawdown: dd });
  }
  return {
    equity_curve: equity,
    drawdown_curve: drawdown,
    total_return_portfolio: ((portVal / 10000 - 1) * 100),
    total_return_spy: ((spyVal / 10000 - 1) * 100),
    alpha: ((portVal - spyVal) / 10000 * 100),
  };
}

const DEMO_STRESS: StressScenario[] = [
  { scenario: "2008 Financial Crisis", portfolio_impact: -38.2, worst_day: -9.4, path: Array.from({ length: 61 }, (_, i) => 10000 * (1 - 0.382 * (i / 60))) },
  { scenario: "COVID Crash (Mar 2020)", portfolio_impact: -28.7, worst_day: -11.2, path: Array.from({ length: 61 }, (_, i) => 10000 * (1 - 0.287 * (i / 60))) },
  { scenario: "2022 Rate Hike Selloff", portfolio_impact: -19.4, worst_day: -4.8, path: Array.from({ length: 61 }, (_, i) => 10000 * (1 - 0.194 * (i / 60))) },
  { scenario: "Dot-com Bust (2000–02)", portfolio_impact: -42.1, worst_day: -8.1, path: Array.from({ length: 61 }, (_, i) => 10000 * (1 - 0.421 * (i / 60))) },
  { scenario: "Flash Crash (May 2010)", portfolio_impact: -7.8, worst_day: -7.8, path: Array.from({ length: 61 }, (_, i) => 10000 * (1 - 0.078 * Math.min(1, i / 5))) },
  { scenario: "+200bps Rate Shock", portfolio_impact: -12.3, worst_day: -3.2, path: Array.from({ length: 61 }, (_, i) => 10000 * (1 - 0.123 * (i / 60))) },
];

// ── Animated counter ──────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 2, suffix = "" }: {
  value: number; decimals?: number; suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let start = display;
    const end = value;
    const steps = 60;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplay(start + (end - start) * (step / steps));
      if (step >= steps) { setDisplay(end); clearInterval(timer); }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toFixed(decimals)}{suffix}</>;
}

// ── Metric card ───────────────────────────────────────────────────
function MetricCard({ label, value, sub, suffix = "", positive, icon: Icon }: {
  label: string; value: number; sub?: string; suffix?: string;
  positive?: boolean; icon: React.ElementType;
}) {
  const accent = positive === true ? "text-white" : positive === false ? "text-zinc-400" : "text-white";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 280 }}
      className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors cursor-default"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">{label}</span>
        <Icon size={14} className="text-zinc-600" />
      </div>
      <div className={`text-3xl font-bold tabular-nums ${accent}`}>
        <AnimatedNumber value={value} decimals={2} suffix={suffix} />
      </div>
      {sub && <p className="text-xs text-zinc-600 mt-1.5">{sub}</p>}
    </motion.div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label, prefix = "", suffix = "" }: {
  active?: boolean; payload?: { value: number; name?: string }[];
  label?: string | number; prefix?: string; suffix?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-2xl text-xs">
      {label !== undefined && <p className="text-zinc-500 mb-1.5">Day {label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-white font-semibold">
          {p.name ? `${p.name}: ` : ""}{prefix}{Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}{suffix}
        </p>
      ))}
    </div>
  );
};

// ── Ticker tape ───────────────────────────────────────────────────
function TickerTape({ individual }: { individual: PortfolioMetrics["individual"] }) {
  const items = [...individual, ...individual, ...individual];
  return (
    <div className="overflow-hidden border-y border-zinc-800/60 py-2.5 mb-8">
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ["0%", "-33.33%"] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      >
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-300 font-bold tracking-wide">{item.ticker}</span>
            <span className={item.annual_return >= 0 ? "text-white" : "text-zinc-500"}>
              {item.annual_return >= 0 ? "▲" : "▼"} {Math.abs(item.annual_return).toFixed(2)}%
            </span>
            <span className="text-zinc-700">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Subtle grid background ────────────────────────────────────────
function GridBg() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
      style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const [tickers, setTickers] = useState("AAPL,TSLA,MSFT,NVDA");
  const [weights, setWeights] = useState("35,25,20,20");
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "montecarlo" | "frontier" | "optimize" | "insights" | "correlation" | "backtest" | "stress">("overview");

  const [metrics, setMetrics] = useState<PortfolioMetrics>(DEMO_METRICS);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult>(() => makeDemoMC());
  const [optimized, setOptimized] = useState<OptimizeResult>(DEMO_OPTIMIZED);
  const [frontier, setFrontier] = useState<FrontierPoint[]>(DEMO_FRONTIER);
  const [insights, setInsights] = useState<string[]>(DEMO_INSIGHTS);
  const [correlation, setCorrelation] = useState<CorrCell[]>(DEMO_CORRELATION);
  const [backtest, setBacktest] = useState<BacktestResult>(() => makeDemoBacktest());
  const [stress, setStress] = useState<StressScenario[]>(DEMO_STRESS);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { tickers, weights };
      const [metricsRes, mcRes, optRes, frontierRes, insightsRes, corrRes, backtestRes, stressRes] = await Promise.all([
        axios.get(`${API}/portfolio`, { params }),
        axios.get(`${API}/monte-carlo`, { params: { ...params, simulations: 200 } }),
        axios.get(`${API}/optimize`, { params: { tickers } }),
        axios.get(`${API}/efficient-frontier`, { params: { tickers } }),
        axios.get(`${API}/insights`, { params }),
        axios.get(`${API}/correlation`, { params: { tickers } }),
        axios.get(`${API}/backtest`, { params }),
        axios.get(`${API}/stress-test`, { params }),
      ]);
      setMetrics(metricsRes.data);
      setMonteCarlo(mcRes.data);
      setOptimized(optRes.data);
      setFrontier(frontierRes.data.frontier);
      setInsights(insightsRes.data.insights);
      setCorrelation(corrRes.data.cells);
      setBacktest(backtestRes.data);
      setStress(stressRes.data.scenarios);
      setIsLive(true);
    } catch {
      setError("Backend offline — showing demo data. Run: uvicorn main:app --reload in /backend");
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [tickers, weights]);

  useEffect(() => { fetchAll(); }, []);

  // Allocation from current input
  const allocationData = tickers.split(",").map((t, i) => ({
    name: t.trim().toUpperCase(),
    value: parseFloat(weights.split(",")[i] ?? "0") || 0,
  }));

  // Radar
  const radarData = metrics.individual.map((item) => ({
    subject: item.ticker,
    Return: Math.max(0, item.annual_return + 30),
    Risk: Math.max(0, 80 - item.volatility),
  }));

  // MC chart data — subsample 60 paths
  const mcSample = monteCarlo.simulations.slice(0, 60);
  const mcChartData = Array.from({ length: Math.min(mcSample[0]?.length ?? 0, 253) }, (_, day) => {
    const entry: Record<string, number> = { day };
    mcSample.forEach((sim, i) => { entry[`s${i}`] = sim[day]; });
    return entry;
  });

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "correlation", label: "Correlation", icon: GitBranch },
    { id: "backtest", label: "Backtest", icon: Clock },
    { id: "stress", label: "Stress Test", icon: AlertTriangle },
    { id: "montecarlo", label: "Monte Carlo", icon: Activity },
    { id: "frontier", label: "Efficient Frontier", icon: Target },
    { id: "optimize", label: "Optimizer", icon: Zap },
    { id: "insights", label: "AI Insights", icon: Shield },
  ] as const;

  return (
    <div className="min-h-screen bg-black text-white relative">
      <GridBg />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-zinc-800/60 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <BarChart2 size={14} className="text-black" />
          </div>
          <span className="font-semibold text-base tracking-tight">Portfolio Intelligence</span>
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${isLive ? "border-white/20 text-white bg-white/5" : "border-zinc-700 text-zinc-500"}`}>
            {isLive ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isLive ? "Live" : "Demo"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.95 }} onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm transition-all disabled:opacity-40">
            <motion.div animate={loading ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: loading ? Infinity : 0, ease: "linear" }}>
              <RefreshCw size={13} />
            </motion.div>
            {loading ? "Fetching..." : "Refresh"}
          </motion.button>
          <Link href="/"><button className="px-4 py-2 rounded-xl border border-zinc-800 hover:border-zinc-600 text-sm transition-all">← Home</button></Link>
        </div>
      </nav>

      <div className="relative z-10 px-6 py-8 max-w-screen-xl mx-auto">

        {/* Input */}
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 mb-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-44">
              <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5 block">Tickers</label>
              <input value={tickers} onChange={(e) => setTickers(e.target.value)}
                placeholder="AAPL,TSLA,MSFT,NVDA"
                className="w-full px-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:outline-none focus:border-zinc-500 text-sm transition-all" />
            </div>
            <div className="flex-1 min-w-44">
              <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5 block">Weights (%)</label>
              <input value={weights} onChange={(e) => setWeights(e.target.value)}
                placeholder="35,25,20,20"
                className="w-full px-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:outline-none focus:border-zinc-500 text-sm transition-all" />
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={fetchAll} disabled={loading}
              className="px-7 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-100 transition-all disabled:opacity-40">
              {loading ? "Analyzing..." : "Analyze"}
            </motion.button>
          </div>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-3 text-zinc-400 text-xs bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2">
              ⚠ {error}
            </motion.p>
          )}
        </motion.section>

        {/* Ticker tape */}
        <TickerTape individual={metrics.individual} />

        {/* Metric cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard label="Expected Return" value={metrics.expected_return} suffix="%" icon={TrendingUp} positive={metrics.expected_return > 10} sub="Annualized" />
          <MetricCard label="Volatility" value={metrics.volatility} suffix="%" icon={Activity} sub="Annualized std dev" />
          <MetricCard label="Sharpe Ratio" value={metrics.sharpe_ratio} icon={Zap} positive={metrics.sharpe_ratio > 1} sub="Risk-adjusted return" />
          <MetricCard label="VaR 95%" value={metrics.value_at_risk} suffix="%" icon={Shield} sub="Daily worst-case" />
          <MetricCard label="CVaR 95%" value={metrics.cvar_95} suffix="%" icon={TrendingDown} sub="Expected shortfall" />
          <MetricCard label="Max Drawdown" value={metrics.max_drawdown} suffix="%" icon={TrendingDown} sub="Peak-to-trough" />
          <MetricCard label="Beta vs SPY" value={metrics.beta} icon={Target} sub="Market sensitivity" />
          <MetricCard label="VaR 99%" value={metrics.var_99} suffix="%" icon={Shield} sub="Tail risk" />
        </section>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <motion.button key={tab.id} onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                activeTab === tab.id
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}>
              <tab.icon size={13} />
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab panels */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Donut */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-0.5">Asset Allocation</h2>
                  <p className="text-xs text-zinc-500 mb-4">Portfolio weight distribution</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={allocationData} dataKey="value" nameKey="name"
                          outerRadius={100} innerRadius={55} paddingAngle={3}
                          label={({ name, value, cx, cy, midAngle, outerRadius: or }) => {
                            const R = Math.PI / 180;
                            const a = (midAngle ?? 0);
                            const r = (or as number) + 28;
                            const x = (cx as number) + r * Math.cos(-a * R);
                            const y = (cy as number) + r * Math.sin(-a * R);
                            return <text x={x} y={y} fill="#a1a1aa" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{name} {value}%</text>;
                          }}
                          labelLine={false}
                        >
                          {allocationData.map((_, i) => (
                            <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
                              <p className="text-white font-semibold">{payload[0]?.name}: {payload[0]?.value}%</p>
                            </div>
                          ) : null
                        } />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center mt-1">
                    {allocationData.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <div className="w-2 h-2 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                        {item.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Radar */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-0.5">Asset Comparison</h2>
                  <p className="text-xs text-zinc-500 mb-4">Return vs risk-adjusted score</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#27272a" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "#71717a", fontSize: 11 }} />
                        <Radar name="Return" dataKey="Return" stroke="#ffffff" fill="#ffffff" fillOpacity={0.08} strokeWidth={1.5} />
                        <Radar name="Risk Score" dataKey="Risk" stroke="#71717a" fill="#71717a" fillOpacity={0.08} strokeWidth={1} />
                        <Tooltip content={<ChartTip />} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Asset table */}
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-4">Individual Asset Breakdown</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
                        <th className="text-left pb-3 pr-4">Ticker</th>
                        <th className="text-right pb-3 pr-4">Weight</th>
                        <th className="text-right pb-3 pr-4">Annual Return</th>
                        <th className="text-right pb-3 pr-4">Volatility</th>
                        <th className="text-right pb-3">Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.individual.map((row, i) => (
                        <motion.tr key={row.ticker}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-200">{row.ticker}</span>
                          </td>
                          <td className="py-3 pr-4 text-right text-zinc-400 text-xs">{row.weight}%</td>
                          <td className={`py-3 pr-4 text-right font-semibold text-xs ${row.annual_return >= 0 ? "text-white" : "text-zinc-500"}`}>
                            {row.annual_return >= 0 ? "+" : ""}{row.annual_return}%
                          </td>
                          <td className="py-3 pr-4 text-right text-zinc-500 text-xs">{row.volatility}%</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end">
                              <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, Math.abs(row.annual_return) * 1.2)}%` }}
                                  transition={{ duration: 0.9, delay: i * 0.1 }}
                                  className="h-full rounded-full"
                                  style={{ background: row.annual_return >= 0 ? "#ffffff" : "#52525b" }}
                                />
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── MONTE CARLO ── */}
            {activeTab === "montecarlo" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Bear (5th pct)", value: monteCarlo.percentile_5, dim: true },
                    { label: "Median", value: monteCarlo.percentile_50, dim: false },
                    { label: "Mean", value: monteCarlo.mean_final, dim: false },
                    { label: "Bull (95th pct)", value: monteCarlo.percentile_95, dim: false },
                  ].map((item) => (
                    <motion.div key={item.label}
                      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -2 }}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">{item.label}</p>
                      <p className={`text-2xl font-bold tabular-nums ${item.dim ? "text-zinc-400" : "text-white"}`}>
                        $<AnimatedNumber value={item.value} decimals={0} />
                      </p>
                      <p className="text-xs text-zinc-700 mt-1">from $10,000</p>
                    </motion.div>
                  ))}
                </div>

                {/* Paths chart */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-0.5">Simulation Paths — 200 runs</h2>
                  <p className="text-xs text-zinc-500 mb-5">252 trading days · starting $10,000</p>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mcChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="day" stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 10 }}
                          label={{ value: "Trading Days", position: "insideBottom", offset: -3, fill: "#52525b", fontSize: 10 }} />
                        <YAxis stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 10 }}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
                              <p className="text-zinc-500">Day {label}</p>
                              <p className="text-white font-semibold">${Number(payload[0]?.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                          ) : null
                        } />
                        {mcSample.map((_, i) => (
                          <Line key={i} dataKey={`s${i}`} dot={false}
                            stroke={i < 8 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.04)"}
                            strokeWidth={i < 4 ? 1.5 : 1} isAnimationActive={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Distribution */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-0.5">Terminal Value Distribution</h2>
                  <p className="text-xs text-zinc-500 mb-5">Histogram of final portfolio values across all simulations</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={(() => {
                        const finals = monteCarlo.simulations.map((s) => s[s.length - 1]);
                        const min = Math.min(...finals), max = Math.max(...finals);
                        const buckets = 28;
                        const step = (max - min) / buckets;
                        return Array.from({ length: buckets }, (_, i) => {
                          const lo = min + i * step;
                          return { value: Math.round(lo + step / 2), count: finals.filter((f) => f >= lo && f < lo + step).length };
                        });
                      })()}>
                        <defs>
                          <linearGradient id="distG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="value" stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 10 }}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 10 }} />
                        <Tooltip content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
                              <p className="text-zinc-500">~${Number(payload[0]?.payload?.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-white font-semibold">{payload[0]?.value} paths</p>
                            </div>
                          ) : null
                        } />
                        <Area type="monotone" dataKey="count" stroke="#ffffff" fill="url(#distG)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── EFFICIENT FRONTIER ── */}
            {activeTab === "frontier" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-sm font-semibold mb-0.5">Efficient Frontier</h2>
                <p className="text-xs text-zinc-500 mb-6">Modern Portfolio Theory — optimal risk/return curve. White dot = your portfolio.</p>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                      <XAxis dataKey="volatility" name="Volatility" stroke="#3f3f46"
                        tick={{ fill: "#52525b", fontSize: 10 }}
                        label={{ value: "Volatility (%)", position: "insideBottom", offset: -4, fill: "#52525b", fontSize: 10 }} />
                      <YAxis dataKey="return" name="Return" stroke="#3f3f46"
                        tick={{ fill: "#52525b", fontSize: 10 }}
                        label={{ value: "Return (%)", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 10 }} />
                      <Tooltip content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs space-y-1">
                            <p className="text-zinc-400">Portfolio</p>
                            <p className="text-zinc-300">Vol: {Number(payload[0]?.value ?? 0).toFixed(2)}%</p>
                            <p className="text-white font-semibold">Return: {Number(payload[1]?.value ?? 0).toFixed(2)}%</p>
                          </div>
                        ) : null
                      } />
                      <Scatter name="Frontier" data={frontier} fill="#52525b" opacity={0.8} r={4} />
                      <Scatter name="Your Portfolio"
                        data={[{ volatility: metrics.volatility, return: metrics.expected_return }]}
                        fill="#ffffff" r={8} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-4 text-xs text-zinc-500">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-zinc-600" /> Frontier portfolios</div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-white" /> Your portfolio</div>
                </div>
              </div>
            )}

            {/* ── OPTIMIZER ── */}
            {activeTab === "optimize" && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Optimal Return", value: optimized.expected_return, suffix: "%" },
                    { label: "Optimal Volatility", value: optimized.volatility, suffix: "%" },
                    { label: "Optimal Sharpe", value: optimized.sharpe_ratio, suffix: "" },
                  ].map((item) => (
                    <motion.div key={item.label} whileHover={{ y: -2 }}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">{item.label}</p>
                      <p className="text-3xl font-bold text-white tabular-nums">
                        <AnimatedNumber value={item.value} decimals={2} suffix={item.suffix} />
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-0.5">Optimal Weights</h2>
                  <p className="text-xs text-zinc-500 mb-5">Max-Sharpe optimization · 5–60% per-asset bounds</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {optimized.tickers.map((ticker, i) => (
                      <motion.div key={ticker}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="bg-zinc-800/60 rounded-xl p-4 text-center border border-zinc-700">
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{ticker}</p>
                        <p className="text-2xl font-bold text-white tabular-nums">
                          <AnimatedNumber value={optimized.optimal_weights[i]} decimals={1} suffix="%" />
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Current vs optimal area chart */}
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={optimized.tickers.map((t, i) => ({
                        ticker: t,
                        current: parseFloat(weights.split(",")[i] ?? "0"),
                        optimal: optimized.optimal_weights[i],
                      }))}>
                        <defs>
                          <linearGradient id="curG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#71717a" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#71717a" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="optG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="ticker" stroke="#3f3f46" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                        <YAxis stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs space-y-1">
                              <p className="text-zinc-300 font-semibold">{label}</p>
                              {payload.map((p) => (
                                <p key={p.name} style={{ color: p.color }}>{p.name}: {Number(p.value).toFixed(1)}%</p>
                              ))}
                            </div>
                          ) : null
                        } />
                        <Area type="monotone" dataKey="current" name="Current" stroke="#71717a" fill="url(#curG)" strokeWidth={1.5} />
                        <Area type="monotone" dataKey="optimal" name="Optimal" stroke="#ffffff" fill="url(#optG)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── CORRELATION HEATMAP ── */}
            {activeTab === "correlation" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-sm font-semibold mb-0.5">Correlation Matrix</h2>
                <p className="text-xs text-zinc-500 mb-6">Pairwise correlation between asset returns — key for diversification analysis</p>
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${tickers.split(",").length}, minmax(0, 1fr))` }}>
                  {correlation.map((cell, i) => {
                    const intensity = Math.abs(cell.value);
                    const bg = cell.value === 1 ? "#ffffff" : cell.value > 0 ? `rgba(255,255,255,${intensity * 0.6})` : `rgba(113,113,122,${intensity * 0.6})`;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="aspect-square flex items-center justify-center rounded-lg text-xs font-mono font-semibold"
                        style={{ background: bg, color: intensity > 0.5 ? "#000" : "#fff" }}
                      >
                        {cell.value.toFixed(2)}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex gap-6 mt-6 text-xs text-zinc-500">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-white" /> Strong positive (1.0)</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-zinc-600" /> Weak/negative</div>
                </div>
              </div>
            )}

            {/* ── BACKTEST ── */}
            {activeTab === "backtest" && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Portfolio Return", value: backtest.total_return_portfolio, suffix: "%" },
                    { label: "SPY Return", value: backtest.total_return_spy, suffix: "%" },
                    { label: "Alpha", value: backtest.alpha, suffix: "%" },
                  ].map((item) => (
                    <motion.div key={item.label} whileHover={{ y: -2 }}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">{item.label}</p>
                      <p className={`text-3xl font-bold tabular-nums ${item.value >= 0 ? "text-white" : "text-zinc-500"}`}>
                        {item.value >= 0 ? "+" : ""}<AnimatedNumber value={item.value} decimals={2} suffix={item.suffix} />
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-0.5">Historical Equity Curve (1 Year)</h2>
                  <p className="text-xs text-zinc-500 mb-5">Portfolio vs SPY benchmark · starting $10,000</p>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={backtest.equity_curve}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="date" stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 9 }}
                          tickFormatter={(v) => v.slice(5)} />
                        <YAxis stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 10 }}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                        <Tooltip content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs space-y-1">
                              <p className="text-zinc-500">{label}</p>
                              {payload.map((p) => (
                                <p key={p.name} style={{ color: p.color }} className="font-semibold">
                                  {p.name}: ${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                              ))}
                            </div>
                          ) : null
                        } />
                        <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#ffffff" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="spy" name="SPY" stroke="#52525b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold mb-0.5">Drawdown Analysis</h2>
                  <p className="text-xs text-zinc-500 mb-5">Peak-to-trough decline over time</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={backtest.drawdown_curve}>
                        <defs>
                          <linearGradient id="ddG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#71717a" stopOpacity={0.05} />
                            <stop offset="100%" stopColor="#71717a" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                        <XAxis dataKey="date" stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 9 }}
                          tickFormatter={(v) => v.slice(5)} />
                        <YAxis stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
                              <p className="text-zinc-500">{label}</p>
                              <p className="text-zinc-300 font-semibold">{Number(payload[0]?.value).toFixed(2)}%</p>
                            </div>
                          ) : null
                        } />
                        <Area type="monotone" dataKey="drawdown" stroke="#71717a" fill="url(#ddG)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── STRESS TEST ── */}
            {activeTab === "stress" && (
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-1">
                  <h2 className="text-sm font-semibold">Stress Test Scenarios</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Historical crisis simulations — 60-day portfolio impact</p>
                </div>
                {stress.map((scenario, i) => (
                  <motion.div key={scenario.scenario}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-600 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{scenario.scenario}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Simulated 60-day stressed path</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold tabular-nums ${scenario.portfolio_impact >= 0 ? "text-white" : "text-zinc-400"}`}>
                          {scenario.portfolio_impact >= 0 ? "+" : ""}{scenario.portfolio_impact}%
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">Worst day: {scenario.worst_day}%</p>
                      </div>
                    </div>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={scenario.path.map((v, d) => ({ day: d, value: v }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                          <XAxis dataKey="day" stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 9 }} />
                          <YAxis stroke="#3f3f46" tick={{ fill: "#52525b", fontSize: 9 }}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip content={({ active, payload }) =>
                            active && payload?.length ? (
                              <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
                                <p className="text-white font-semibold">${Number(payload[0]?.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              </div>
                            ) : null
                          } />
                          <Line type="monotone" dataKey="value" stroke={scenario.portfolio_impact >= 0 ? "#ffffff" : "#71717a"} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── AI INSIGHTS ── */}
            {activeTab === "insights" && (
              <div className="space-y-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-1">
                  <h2 className="text-sm font-semibold">AI Investment Insights</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Generated from live portfolio metrics</p>
                </div>
                {insights.map((insight, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-4 items-start p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors">
                    <span className="text-zinc-600 font-mono text-xs mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-zinc-300 text-sm leading-relaxed">{insight}</p>
                  </motion.div>
                ))}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Loading overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 rounded-full border border-transparent border-t-white border-r-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 text-sm">Fetching live market data...</p>
                <p className="text-zinc-600 text-xs mt-1">Running Monte Carlo & optimization</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
