"use client";

import { useState, useEffect, useRef } from "react";
import { Reveal } from "./Reveal";

interface DataOrb {
  id: number;
  x: number;
  y: number;
  value: number;
  type: "revenue" | "users" | "growth" | "retention";
  collected: boolean;
  velocity: { x: number; y: number };
}

const ORB_TYPES = {
  revenue: { color: "#3b82f6", label: "Revenue", icon: "💰" },
  users: { color: "#8b5cf6", label: "Users", icon: "👥" },
  growth: { color: "#10b981", label: "Growth", icon: "📈" },
  retention: { color: "#f59e0b", label: "Retention", icon: "⭐" },
};

export function InteractiveDataGame() {
  const [orbs, setOrbs] = useState<DataOrb[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && gameActive) {
      setGameActive(false);
    }
  }, [gameActive, timeLeft]);

  useEffect(() => {
    if (gameActive) {
      const interval = setInterval(() => {
        setOrbs((prev) => {
          const newOrbs = [...prev];
          if (newOrbs.length < 8) {
            const types = Object.keys(ORB_TYPES) as Array<keyof typeof ORB_TYPES>;
            const type = types[Math.floor(Math.random() * types.length)];
            newOrbs.push({
              id: Date.now() + Math.random(),
              x: Math.random() * 80 + 10,
              y: Math.random() * 80 + 10,
              value: Math.floor(Math.random() * 50) + 10,
              type,
              collected: false,
              velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
            });
          }
          return newOrbs;
        });
      }, 1500);

      const animate = () => {
        setOrbs((prev) =>
          prev.map((orb) => {
            if (orb.collected) return orb;
            let newX = orb.x + orb.velocity.x;
            let newY = orb.y + orb.velocity.y;
            let newVelX = orb.velocity.x;
            let newVelY = orb.velocity.y;

            if (newX <= 5 || newX >= 95) newVelX *= -1;
            if (newY <= 5 || newY >= 95) newVelY *= -1;

            newX = Math.max(5, Math.min(95, newX));
            newY = Math.max(5, Math.min(95, newY));

            return { ...orb, x: newX, y: newY, velocity: { x: newVelX, y: newVelY } };
          })
        );
        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        clearInterval(interval);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }
  }, [gameActive]);

  const handleOrbClick = (orb: DataOrb) => {
    if (!orb.collected) {
      setOrbs((prev) => prev.map((o) => (o.id === orb.id ? { ...o, collected: true } : o)));
      setScore((prev) => prev + orb.value * (1 + combo * 0.1));
      setCombo((prev) => prev + 1);
      setTimeout(() => setCombo((prev) => Math.max(0, prev - 1)), 2000);
    }
  };

  const startGame = () => {
    setOrbs([]);
    setScore(0);
    setCombo(0);
    setTimeLeft(30);
    setGameActive(true);
  };

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 bg-gradient-to-b from-neutral-900 via-blue-900/20 to-purple-900/20 dark:from-[#0a0c10] dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center">
          <Reveal>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-blue-400">
              [ Data Collection Challenge ]
            </p>
            <h2 className="max-w-2xl mx-auto text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-white sm:text-5xl">
              Catch the
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"> data orbs.</span>
            </h2>
            <p className="mt-4 max-w-lg mx-auto text-sm leading-relaxed text-neutral-300">
              Click on floating data orbs to collect insights. Build combos for bonus points!
            </p>
          </Reveal>
        </div>

        {!gameActive ? (
          <Reveal delay={150}>
            <div className="mt-12 text-center">
              <button
                onClick={startGame}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold transition-all hover:scale-105 hover:shadow-[0_20px_60px_-20px_rgba(59,130,246,0.5)]"
              >
                Start Collection
                <span className="absolute inset-0 rounded-xl ring-2 ring-white/20 ring-offset-2 ring-offset-transparent transition-all group-hover:ring-white/40" />
              </button>
              {score > 0 && (
                <div className="mt-8">
                  <p className="text-2xl font-bold text-white">Final Score: {Math.round(score)}</p>
                </div>
              )}
            </div>
          </Reveal>
        ) : (
          <Reveal delay={150}>
            <div className="mt-12 space-y-6">
              {/* Game Stats */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Score</p>
                    <p className="text-2xl font-bold text-white">{Math.round(score)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Combo</p>
                    <p className="text-2xl font-bold text-purple-400">{combo}x</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Time</p>
                    <p className="text-2xl font-bold text-blue-400">{timeLeft}s</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {Object.entries(ORB_TYPES).map(([key, { color, icon }]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-neutral-300">{icon}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Game Area */}
              <div
                ref={canvasRef}
                className="relative aspect-[16/9] max-w-5xl mx-auto rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 overflow-hidden"
              >
                {/* Grid Background */}
                <div className="absolute inset-0 opacity-20">
                  <div className="h-full w-full">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-white/30"
                        style={{ top: `${i * 10}%` }}
                      />
                    ))}
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-white/30"
                        style={{ left: `${i * 10}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Data Orbs */}
                {orbs.map((orb) => (
                  <button
                    key={orb.id}
                    onClick={() => handleOrbClick(orb)}
                    disabled={orb.collected}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                      orb.collected
                        ? "opacity-0 scale-0"
                        : "hover:scale-125 cursor-pointer"
                    }`}
                    style={{
                      left: `${orb.x}%`,
                      top: `${orb.y}%`,
                    }}
                  >
                    <div
                      className="relative"
                      style={{
                        width: "60px",
                        height: "60px",
                      }}
                    >
                      {/* Glow Effect */}
                      <div
                        className="absolute inset-0 rounded-full blur-xl opacity-60 animate-pulse"
                        style={{ backgroundColor: ORB_TYPES[orb.type].color }}
                      />
                      {/* Orb */}
                      <div
                        className="relative flex items-center justify-center rounded-full text-2xl shadow-lg"
                        style={{
                          backgroundColor: ORB_TYPES[orb.type].color,
                          boxShadow: `0 0 30px ${ORB_TYPES[orb.type].color}80`,
                        }}
                      >
                        {ORB_TYPES[orb.type].icon}
                      </div>
                      {/* Value Label */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs font-bold text-white">
                        +{orb.value}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

export default InteractiveDataGame;
