"use client";

import { useState, useEffect } from "react";
import { Reveal } from "./Reveal";

interface MetricCard {
  label: string;
  value: string;
  change: string;
  color: string;
  icon: string;
}

interface ChartData {
  label: string;
  value: number;
  color: string;
}

const METRICS: MetricCard[] = [
  { label: "Total Revenue", value: "$2.4M", change: "+23%", color: "from-blue-500 to-cyan-400", icon: "💰" },
  { label: "Active Users", value: "45.2K", change: "+18%", color: "from-purple-500 to-pink-400", icon: "👥" },
  { label: "Conversion Rate", value: "4.8%", change: "+12%", color: "from-green-500 to-emerald-400", icon: "📈" },
  { label: "Avg Session", value: "8m 32s", change: "+8%", color: "from-orange-500 to-amber-400", icon: "⏱️" },
];

const CHART_DATA: ChartData[] = [
  { label: "Jan", value: 65, color: "#3b82f6" },
  { label: "Feb", value: 78, color: "#8b5cf6" },
  { label: "Mar", value: 52, color: "#ec4899" },
  { label: "Apr", value: 91, color: "#10b981" },
  { label: "May", value: 84, color: "#f59e0b" },
  { label: "Jun", value: 95, color: "#3b82f6" },
  { label: "Jul", value: 72, color: "#8b5cf6" },
  { label: "Aug", value: 88, color: "#ec4899" },
];

export function InteractiveDataGame() {
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [animatedValues, setAnimatedValues] = useState<number[]>(CHART_DATA.map(() => 0));

  useEffect(() => {
    const animateBars = () => {
      CHART_DATA.forEach((_, i) => {
        setTimeout(() => {
          setAnimatedValues((prev) => {
            const newValues = [...prev];
            newValues[i] = CHART_DATA[i].value;
            return newValues;
          });
        }, i * 100);
      });
    };
    animateBars();
  }, []);

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 bg-gradient-to-b from-neutral-50 via-white to-neutral-50 dark:from-[#0a0c10] dark:via-[#050506] dark:to-[#0a0c10]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center">
          <Reveal>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-400 dark:text-zinc-500">
              [ Real-time Analytics ]
            </p>
            <h2 className="max-w-2xl mx-auto text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-5xl">
              Data that comes
              <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"> alive.</span>
            </h2>
            <p className="mt-4 max-w-lg mx-auto text-sm leading-relaxed text-neutral-500 dark:text-zinc-400">
              Hover over metrics and charts to explore interactive data visualizations powered by our analytics engine.
            </p>
          </Reveal>
        </div>

        <Reveal delay={150}>
          <div className="mt-16 space-y-8">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {METRICS.map((metric, i) => (
                <div
                  key={metric.label}
                  onMouseEnter={() => setHoveredMetric(i)}
                  onMouseLeave={() => setHoveredMetric(null)}
                  className={`group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-105 hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)] dark:border-white/[0.08] dark:bg-[#0d1117] dark:hover:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] ${
                    hoveredMetric === i ? "ring-2 ring-blue-500/50" : ""
                  }`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${metric.color} opacity-0 transition-opacity duration-500 group-hover:opacity-10`}
                  />
                  <div className="relative">
                    <div className="mb-3 text-3xl">{metric.icon}</div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-zinc-500">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{metric.value}</p>
                    <p
                      className={`mt-1 text-sm font-medium ${
                        metric.change.startsWith("+") ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {metric.change}
                    </p>
                  </div>
                  <div
                    className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${metric.color} transition-all duration-500 ${
                      hoveredMetric === i ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Interactive Chart */}
            <div className="relative rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.2)] dark:border-white/[0.08] dark:bg-[#0d1117] dark:shadow-[0_40px_100px_-40px_rgba(0,0,0,0.6)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Monthly Performance</h3>
                  <p className="text-sm text-neutral-500 dark:text-zinc-400">Revenue growth over time</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-neutral-600 dark:text-zinc-400">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-xs text-neutral-600 dark:text-zinc-400">Growth</span>
                  </div>
                </div>
              </div>

              <div className="relative h-64">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="border-t border-dashed border-neutral-200 dark:border-white/[0.08]"
                      style={{ height: "20%" }}
                    />
                  ))}
                </div>

                {/* Chart Bars */}
                <div className="absolute inset-0 flex items-end justify-between gap-4 px-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/[0.2]" />
                  </div>

                  {CHART_DATA.map((data, i) => (
                    <div
                      key={data.label}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                      className="group relative flex-1 cursor-pointer"
                    >
                      <div
                        className="mx-auto w-full max-w-[40px] rounded-t-lg transition-all duration-500 ease-out hover:opacity-80"
                        style={{
                          height: `${animatedValues[i]}%`,
                          backgroundColor: data.color,
                          boxShadow: hoveredBar === i ? `0 0 30px ${data.color}80` : "none",
                          transform: hoveredBar === i ? "scale(1.05)" : "scale(1)",
                        }}
                      />
                      {hoveredBar === i && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-neutral-900 animate-fade-in">
                          <p className="font-semibold">{data.label}</p>
                          <p className="text-neutral-300 dark:text-neutral-600">{data.value}%</p>
                        </div>
                      )}
                      <p className="mt-2 text-center text-xs text-neutral-500 dark:text-zinc-400">
                        {data.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Flow Animation */}
            <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 p-8 dark:border-white/[0.08]">
              <div className="absolute inset-0">
                <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-500/50 to-transparent animate-pulse" />
                <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-purple-500/50 to-transparent animate-pulse" style={{ animationDelay: "0.5s" }} />
                <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-pink-500/50 to-transparent animate-pulse" style={{ animationDelay: "1s" }} />
              </div>

              <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm dark:bg-[#0d1117]/80">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <span className="text-xl">📊</span>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-zinc-400">Data Ingestion</p>
                      <p className="text-sm fontsemibold text-neutral-900 dark:text-white">2.4M records</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-cyan-400 animate-pulse" />
                  </div>
                </div>

                <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm dark:bg-[#0d1117]/80">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                      <span className="text-xl">🔄</span>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-zinc-400">Processing</p>
                      <p className="text-sm fontsemibold text-neutral-900 dark:text-white">1.8M records</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className="h-full w-1/2 bg-gradient-to-r from-purple-500 to-pink-400 animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                </div>

                <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm dark:bg-[#0d1117]/80">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <span className="text-xl">✅</span>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-zinc-400">Completed</p>
                      <p className="text-sm fontsemibold text-neutral-900 dark:text-white">1.2M records</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className="h-full w-1/3 bg-gradient-to-r from-green-500 to-emerald-400 animate-pulse" style={{ animationDelay: "0.6s" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default InteractiveDataGame;
