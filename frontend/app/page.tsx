"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { TrendingUp, Shield, Zap, BarChart2, Activity, Target, GitBranch, Clock, AlertTriangle } from "lucide-react";

function AnimatedCounter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) setStarted(true);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = 16;
    const increment = end / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, step);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return <span ref={ref}>{count % 1 === 0 ? Math.floor(count) : count.toFixed(1)}{suffix}</span>;
}

const features = [
  { icon: GitBranch, title: "Correlation Heatmap", desc: "Pairwise correlation matrix showing diversification opportunities across assets." },
  { icon: Clock, title: "Historical Backtesting", desc: "1-year equity curve vs SPY with drawdown analysis and alpha calculation." },
  { icon: AlertTriangle, title: "Stress Testing", desc: "6 historical crisis scenarios (2008, COVID, rate shocks) with simulated portfolio impact." },
  { icon: Activity, title: "Monte Carlo Simulations", desc: "200 simulated portfolio paths across 252 trading days with percentile breakdowns." },
  { icon: Target, title: "Efficient Frontier", desc: "MPT-based optimal risk/return curve with your portfolio plotted in real time." },
  { icon: Zap, title: "Portfolio Optimizer", desc: "Scipy max-Sharpe optimization with per-asset bounds and comparison charts." },
  { icon: Shield, title: "Risk Metrics Suite", desc: "VaR 95/99, CVaR, max drawdown, beta vs SPY — institutional-grade analytics." },
  { icon: TrendingUp, title: "Live Market Data", desc: "Real-time yfinance data powering every calculation — no static mocks." },
  { icon: BarChart2, title: "AI Insights Engine", desc: "Dynamic insights generated from your actual metrics, not hardcoded text." },
];

const stats = [
  { value: 200, suffix: "+", label: "Monte Carlo Paths" },
  { value: 5, suffix: "", label: "Risk Metrics" },
  { value: 99, suffix: "%", label: "VaR Precision" },
  { value: 252, suffix: "", label: "Trading Days Forecast" },
];

export default function Home() {
  const featuresRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.04] bg-white" />
        <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] rounded-full blur-3xl opacity-[0.03] bg-white" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/70">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-lg">
            <BarChart2 size={16} className="text-black" />
          </div>
          <span className="font-bold text-lg tracking-tight">Portfolio Intelligence</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-3"
        >
          <button
            onClick={() => featuresRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="px-5 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-sm transition-all"
          >
            Features
          </button>
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all"
            >
              Launch Dashboard →
            </motion.button>
          </Link>
        </motion.div>
      </nav>

      {/* Hero */}
      <div ref={heroRef} className="relative z-10">
        <motion.section
          style={{ y: heroY, opacity: heroOpacity }}
          className="flex flex-col items-center justify-center text-center px-6 pt-28 pb-24"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 text-zinc-400 text-xs font-medium mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Live market data · Real-time analytics
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-6xl md:text-8xl font-bold max-w-5xl leading-[1.05] tracking-tight"
          >
            AI-Powered
            <br />
            <span className="text-zinc-400">Portfolio Risk</span>
            <br />
            Intelligence
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-8 text-lg text-zinc-400 max-w-2xl leading-relaxed"
          >
            Institutional-grade analytics — Monte Carlo simulations, efficient frontier optimization,
            and AI-driven insights powered by live market data.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-4 rounded-2xl font-semibold text-base bg-white text-black hover:bg-zinc-100 transition-all"
              >
                Launch Dashboard →
              </motion.button>
            </Link>
            <button
              onClick={() => featuresRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="px-8 py-4 rounded-2xl border border-zinc-700 hover:border-zinc-500 font-medium text-base transition-all"
            >
              Explore Features
            </button>
          </motion.div>
        </motion.section>
      </div>

      {/* Stats */}
      <section className="relative z-10 border-y border-zinc-800/60 py-12 bg-zinc-900/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="text-4xl font-bold text-white">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-zinc-500 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} className="relative z-10 px-8 py-28 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold">Built for Strategic Investors</h2>
          <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
            Every feature backed by real quantitative finance — not demos.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 backdrop-blur-xl cursor-default transition-all"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 bg-zinc-800">
                <f.icon size={16} className="text-zinc-300" />
              </div>
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-8 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto p-12 rounded-3xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl"
        >
          <h2 className="text-4xl font-bold mb-4">Ready to analyze your portfolio?</h2>
          <p className="text-zinc-400 mb-8">Enter any tickers and weights — live data, real math, instant insights.</p>
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="px-10 py-4 rounded-2xl font-semibold text-base bg-white text-black hover:bg-zinc-100 transition-all"
            >
              Launch Dashboard →
            </motion.button>
          </Link>
        </motion.div>
      </section>

      <footer className="relative z-10 text-center py-8 border-t border-zinc-800/60 text-zinc-600 text-sm">
        © 2026 Portfolio Risk Intelligence Platform — Engineered for elite financial decision-making.
      </footer>
    </main>
  );
}
