"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

/**
 * Cinematic scroll-driven AI field guide.
 *
 * A 420vh section pins a full-screen stage while the user scrolls. Scroll
 * position drives a 5-scene sequence: each scene is a real inference clip
 * that zooms in, crossfades, and paralaxes as it takes the stage. Only the
 * active clip keeps playing so mobile bandwidth stays flat; everything else
 * is transformed with transform/opacity in a single rAF pass (no React
 * renders per frame).
 */
const SCENES = [
  {
    src: "https://videos.pexels.com/video-files/18333010/18333010-hd_1280_720_25fps.mp4",
    hd: "https://videos.pexels.com/video-files/18333010/18333010-hd_1920_1080_25fps.mp4",
    kicker: "01 / Neural core",
    title: "A neural network learns to see",
    copy: "Inside the weight space, activations light up and prune as backpropagation re-shapes thousands of filters every step.",
    cmd: "brain.load(pretrained = \"checkpoints/vit.pt\")",
    chips: ["backprop", "attention", "activations"],
  },
  {
    src: "https://videos.pexels.com/video-files/3141210/3141210-hd_1280_720_25fps.mp4",
    hd: "https://videos.pexels.com/video-files/3141210/3141210-hd_1920_1080_25fps.mp4",
    kicker: "02 / Vector fields",
    title: "The geometry of language",
    copy: "Embeddings stretch into high-dimensional curves as the model carves structure out of raw tokens.",
    cmd: "model.embeddings.project(dim = 768)",
    chips: ["embeddings", "latent space", "projection"],
  },
  {
    src: "https://videos.pexels.com/video-files/8084494/8084494-hd_1280_720_25fps.mp4",
    hd: "https://videos.pexels.com/video-files/8084494/8084494-hd_1920_1080_25fps.mp4",
    kicker: "03 / Embodied AI",
    title: "Robots acquire perception",
    copy: "Vision, depth, and contact sensors fuse in real time while the policy maps pixels straight to torque.",
    cmd: "policy.observe(sensor_fusion = true)",
    chips: ["sensor fusion", "computer vision", "motion planning"],
  },
  {
    src: "https://videos.pexels.com/video-files/8084624/8084624-hd_1280_720_25fps.mp4",
    hd: "https://videos.pexels.com/video-files/8084624/8084624-hd_1920_1080_25fps.mp4",
    kicker: "04 / Motor control",
    title: "Learning to move",
    copy: "Reinforcement loops chew through millions of timesteps until coordinated motion feels effortless.",
    cmd: "agent.step(replay_buffer, episodes = 1e6)",
    chips: ["reinforcement", "policy", "sim-to-real"],
  },
  {
    src: "https://videos.pexels.com/video-files/8566674/8566674-hd_1280_720_30fps.mp4",
    hd: "https://videos.pexels.com/video-files/8566674/8566674-hd_1920_1080_30fps.mp4",
    kicker: "05 / Deployment",
    title: "From lab to the field",
    copy: "Frozen graphs shrink onto edge silicon, and the model that trained on a dev box now walks the floor.",
    cmd: "runtime.export(quantize = bool, target = \"edge\")",
    chips: ["inference", "edge", "autonomy"],
  },
];

const SECTION_HEIGHT_VH = 420;

function StaticShowcase({ videos }: { videos: typeof SCENES }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-5 sm:grid-cols-2 lg:grid-cols-3 sm:px-8">
      {videos.map((v) => (
        <article key={v.kicker} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.3)] dark:border-white/10 dark:bg-[#070709]">
          <div className="relative aspect-video overflow-hidden bg-neutral-100 dark:bg-white/[0.02]">
            <video
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            >
              <source src={v.src} type="video/mp4" />
              <source src={v.hd} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <p className="nf-hud-label absolute left-4 top-4 text-white/70">{v.kicker}</p>
          </div>
          <div className="p-5">
            <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">{v.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-zinc-400">{v.copy}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.chips.map((c) => (
                <span key={c} className="rounded-md border border-neutral-200 px-1.5 py-0.5 font-mono text-[9px] text-neutral-500 dark:border-white/[0.09] dark:text-zinc-400">{c}</span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function VideoShowcase() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const activeRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const span = rect.height - vh;
      const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 1;
      const cursor = progress * SCENES.length;
      const idx = Math.min(SCENES.length - 1, Math.max(0, Math.floor(cursor)));

      if (idx !== activeRef.current) {
        const prev = activeRef.current;
        activeRef.current = idx;
        videoRefs.current[prev]?.pause();
        const nextVideo = videoRefs.current[idx];
        if (nextVideo) {
          nextVideo.play().catch(() => { /* muted autoplay may be throttled — ignore */ });
        }
      }

      if (railRef.current) {
        railRef.current.style.transform = `scaleX(${progress})`;
      }

      for (let i = 0; i < SCENES.length; i++) {
        const el = layerRefs.current[i];
        if (!el) continue;
        const d = cursor - i;
        if (d < -0.38 || d > 1.38) {
          el.style.visibility = "hidden";
          el.style.opacity = "0";
          continue;
        }
        const clamped = Math.min(1, Math.max(0, d));
        const edge = Math.min(clamped / 0.16, (1 - clamped) / 0.16);
        const drift = (0.5 - clamped) * 46;
        el.style.visibility = "visible";
        el.style.opacity = String(Math.max(0, Math.min(1, edge)));
        el.style.zIndex = String(i);
        el.style.transform = `scale(${1.08 - 0.08 * clamped}) translateY(${drift.toFixed(2)}px)`;
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    <section className="relative py-28 sm:py-36">
      {/* Section intro */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-400 dark:text-zinc-500">
              [ AI field guide ]
            </p>
            <h2 className="max-w-xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-5xl">
              Watch intelligence
              <span className="text-neutral-400 dark:text-zinc-500"> take shape.</span>
            </h2>
          </div>
          {!reduced ? (
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400 dark:text-zinc-500">
              Scroll to play <CaretDown size={12} />
            </div>
          ) : null}
        </div>
      </div>

      {reduced ? (
        <div className="mt-14">
          <StaticShowcase videos={SCENES} />
        </div>
      ) : (
        <div
          ref={sectionRef}
          className="relative"
          style={{ height: `${SECTION_HEIGHT_VH}vh` }}
        >
          {/* Pinned stage */}
          <div
            ref={stageRef}
            className="sticky top-0 flex h-svh items-center justify-center overflow-hidden"
          >
            <div className="relative aspect-video h-[62svh] max-h-[70vh] w-[min(128rem,96vw)] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-[0_60px_160px_-60px_rgba(0,0,0,0.8)] dark:border-white/10">
              {/* Global progress rail */}
              <div className="absolute inset-x-0 top-0 z-40 h-[3px] bg-white/15">
                <span
                  ref={railRef}
                  className="block h-full w-full origin-left scale-x-0 bg-gradient-to-r from-emerald-400 to-sky-400"
                />
              </div>
              {/* Scene layers */}
              {SCENES.map((scene, i) => (
                <div
                  key={scene.kicker}
                  ref={(el) => { layerRefs.current[i] = el; }}
                  className="absolute inset-0 will-change-transform"
                  style={{ visibility: i === 0 ? "visible" : "hidden", zIndex: i }}
                >
                  <video
                    ref={(el) => { videoRefs.current[i] = el; }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
                    autoPlay={i === 0}
                    muted
                    loop
                    playsInline
                    preload={i === 0 ? "auto" : "metadata"}
                    aria-hidden="true"
                  >
                    <source src={scene.src} type="video/mp4" />
                    <source src={scene.hd} type="video/mp4" />
                  </video>

                  {/* Legibility scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/25" />

                  {/* HUD — scene readout */}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5">
                    <p className="nf-hud-label text-white/75">{scene.kicker}</p>
                    <span className="font-mono text-[10px] tabular-nums tracking-[0.2em] text-white/80">SCENE {(i + 1).toString().padStart(2, "0")}/{String(SCENES.length).padStart(2, "0")}</span>
                  </div>

                  {/* Scene content */}
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
                    <div className="max-w-2xl">
                      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/90">{scene.kicker}</p>
                      <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                        {scene.title}
                      </h3>
                      <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-white/80">{scene.copy}</p>
                      <p className="mt-4 hidden max-w-lg truncate font-mono text-[10.5px] text-white/45 sm:block">
                        {scene.cmd}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {scene.chips.map((c) => (
                          <span key={c} className="rounded-md border border-white/20 bg-black/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/70 backdrop-blur">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default VideoShowcase;