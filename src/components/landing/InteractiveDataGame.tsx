"use client";

import { useState, useEffect } from "react";
import { Reveal } from "./Reveal";

interface DataPoint {
  id: number;
  x: number;
  y: number;
  value: number;
  category: string;
  revealed: boolean;
}

const CATEGORIES = ["Revenue", "Users", "Growth", "Retention"];

export function InteractiveDataGame() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [score, setScore] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (gameStarted) {
      generateDataPoints();
    }
  }, [gameStarted]);

  const generateDataPoints = () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 20; i++) {
      points.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        value: Math.floor(Math.random() * 100) + 1,
        category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
        revealed: false,
      });
    }
    setDataPoints(points);
    setScore(0);
    setRevealedCount(0);
  };

  const handlePointClick = (point: DataPoint) => {
    if (!point.revealed) {
      setDataPoints((prev) =>
        prev.map((p) => (p.id === point.id ? { ...p, revealed: true } : p))
      );
      setScore((prev) => prev + point.value);
      setRevealedCount((prev) => prev + 1);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Revenue: "bg-blue-500",
      Users: "bg-green-500",
      Growth: "bg-purple-500",
      Retention: "bg-orange-500",
    };
    return colors[category] || "bg-gray-500";
  };

  const progress = (revealedCount / 20) * 100;

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 bg-gradient-to-b from-neutral-50 to-white dark:from-[#0a0c10] dark:to-[#050506]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center">
          <Reveal>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-400 dark:text-zinc-500">
              [ Interactive Demo ]
            </p>
            <h2 className="max-w-2xl mx-auto text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-5xl">
              Discover hidden
              <span className="text-neutral-400 dark:text-zinc-500"> insights.</span>
            </h2>
            <p className="mt-4 max-w-lg mx-auto text-sm leading-relaxed text-neutral-500 dark:text-zinc-400">
              Click on the data points to reveal insights and build your analytics score. Each point represents a different metric.
            </p>
          </Reveal>
        </div>

        {!gameStarted ? (
          <Reveal delay={150}>
            <div className="mt-12 flex justify-center">
              <button
                onClick={() => setGameStarted(true)}
                className="group relative px-8 py-4 bg-neutral-900 text-white rounded-xl font-medium transition-all hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Start Data Exploration
                <span className="absolute inset-0 rounded-xl ring-2 ring-neutral-900/20 ring-offset-2 transition-all group-hover:ring-neutral-900/40 dark:ring-white/20 dark:group-hover:ring-white/40" />
              </button>
            </div>
          </Reveal>
        ) : (
          <Reveal delay={150}>
            <div className="mt-12">
              {/* Score and Progress */}
              <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs font-medium text-neutral-400 dark:text-zinc-500">Total Score</p>
                    <p className="text-3xl font-bold text-neutral-900 dark:text-white">{score}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-400 dark:text-zinc-500">Revealed</p>
                    <p className="text-3xl font-bold text-neutral-900 dark:text-white">{revealedCount}/20</p>
                  </div>
                </div>
                <div className="w-full max-w-xs">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-neutral-400 dark:text-zinc-500">{Math.round(progress)}% Complete</p>
                </div>
              </div>

              {/* Interactive Grid */}
              <div className="relative aspect-[16/9] max-w-4xl mx-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.3)] dark:border-white/[0.08] dark:bg-[#0d1117] dark:shadow-[0_40px_100px_-40px_rgba(0,0,0,0.8)]">
                {/* Grid Lines */}
                <div className="absolute inset-6 pointer-events-none">
                  <div className="h-full w-full">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-dashed border-neutral-200 dark:border-white/[0.08]"
                        style={{ top: `${i * 25}%` }}
                      />
                    ))}
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-dashed border-neutral-200 dark:border-white/[0.08]"
                        style={{ left: `${i * 20}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Data Points */}
                {dataPoints.map((point) => (
                  <button
                    key={point.id}
                    onClick={() => handlePointClick(point)}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-125 ${
                      point.revealed ? "opacity-100" : "opacity-40"
                    }`}
                    style={{
                      left: `${point.x}%`,
                      top: `${100 - point.y}%`,
                    }}
                  >
                    <div
                      className={`w-4 h-4 rounded-full ${getCategoryColor(point.category)} ${
                        point.revealed ? "ring-4 ring-white/50 dark:ring-black/50" : ""
                      }`}
                    />
                    {point.revealed && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs text-white dark:bg-white dark:text-neutral-900">
                        {point.category}: {point.value}
                      </div>
                    )}
                  </button>
                ))}

                {/* Legend */}
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-3">
                  {CATEGORIES.map((cat) => (
                    <div key={cat} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getCategoryColor(cat)}`} />
                      <span className="text-xs text-neutral-600 dark:text-zinc-400">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              {revealedCount === 20 && (
                <Reveal>
                  <div className="mt-8 text-center">
                    <p className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
                      🎉 All insights revealed! Final score: {score}
                    </p>
                    <button
                      onClick={() => setGameStarted(false)}
                      className="px-6 py-3 bg-neutral-900 text-white rounded-lg font-medium transition-all hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      Play Again
                    </button>
                  </div>
                </Reveal>
              )}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

export default InteractiveDataGame;
