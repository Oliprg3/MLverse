"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal";

const SHOWCASE_VIDEOS = [
  {
    src: "https://videos.pexels.com/video-files/3129671/3129671-hd_1280_720_30fps.mp4",
    hd: "https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_30fps.mp4",
    kicker: "01 / Analytics",
    title: "Data that speaks for itself",
    copy: "Transform raw numbers into actionable insights with interactive dashboards and real-time visualizations.",
    speed: 34,
    wide: false,
  },
  {
    src: "https://videos.pexels.com/video-files/853800/853800-hd_1280_720_25fps.mp4",
    hd: "https://videos.pexels.com/video-files/853800/853800-hd_1920_1080_25fps.mp4",
    kicker: "02 / Collaboration",
    title: "Teams that move together",
    copy: "Share insights, iterate faster, and deploy models with your entire organization aligned.",
    speed: 58,
    wide: false,
  },
  {
    src: "https://videos.pexels.com/video-files/5382181/5382181-hd_1280_720_24fps.mp4",
    hd: "https://videos.pexels.com/video-files/5382181/5382181-hd_1920_1080_24fps.mp4",
    kicker: "03 / Scale",
    title: "From prototype to production",
    copy: "Build once, deploy everywhere. Your ML pipelines scale seamlessly from laptop to cloud.",
    speed: 82,
    wide: false,
  },
  {
    src: "https://videos.pexels.com/video-files/3165321/3165321-hd_1280_720_24fps.mp4",
    hd: "https://videos.pexels.com/video-files/3165321/3165321-hd_1920_1080_24fps.mp4",
    kicker: "04 / Innovation",
    title: "The future of data science",
    copy: "No-code ML platforms are redefining how teams build, train, and deploy intelligent systems.",
    speed: 46,
    wide: true,
  },
];

/**
 * Cinematic band of real-world footage with scroll-linked parallax. Each card
 * drifts at its own speed while the clip inside counter-scales, so the section
 * feels in motion as the page scrolls. Closes with a full-width nature banner.
 */
export function VideoShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Progress of the band through the viewport: 0 before entering, 1 after leaving.
      const total = rect.height + vh;
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / total));

      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const { speed, wide } = SHOWCASE_VIDEOS[i];
        const drift = (progress - 0.5) * speed;
        const media = card.firstElementChild as HTMLElement | null;
        if (media) {
          const base = wide ? 1.18 : 1.12;
          media.style.transform = `scale(${base + Math.abs(drift) / 400}) translateY(${drift * -0.6}px)`;
        }
        card.style.transform = `translateY(${drift}px)`;
      });
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    if (!reduced) {
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-neutral-300 to-transparent dark:via-white/15" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-400 dark:text-zinc-500">
                [ Platform in action ]
              </p>
              <h2 className="max-w-xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-5xl">
                Built for modern
                <span className="text-neutral-400 dark:text-zinc-500"> data teams.</span>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-zinc-400">
              From analytics to deployment, see how teams transform data into intelligence with our no-code platform.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE_VIDEOS.slice(0, 3).map((video, i) => (
            <Reveal key={video.kicker} delay={i * 120} className={i === 1 ? "lg:-mt-10" : ""}>
              <div
                ref={(el) => { cardRefs.current[i] = el; }}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)] will-change-transform dark:border-white/[0.08] dark:bg-white/[0.02] dark:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.8)]"
                style={{ transform: "translateY(0)" }}
              >
                <video
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-100 dark:opacity-70 dark:mix-blend-screen dark:group-hover:opacity-90"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                >
                  <source src={video.src} type="video/mp4" />
                  <source src={video.hd} type="video/mp4" />
                </video>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">{video.kicker}</p>
                  <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-white">{video.title}</h3>
                  <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-white/70">{video.copy}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Full-width cinematic nature banner */}
        <Reveal delay={100} className="mt-5">
          <div
            ref={(el) => { cardRefs.current[3] = el; }}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)] will-change-transform sm:aspect-[21/9] dark:border-white/[0.08] dark:bg-white/[0.02] dark:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.8)]"
            style={{ transform: "translateY(0)" }}
          >
            <video
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-100 dark:opacity-75 dark:group-hover:opacity-90"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
            >
              <source src={SHOWCASE_VIDEOS[3].src} type="video/mp4" />
            </video>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">{SHOWCASE_VIDEOS[3].kicker}</p>
                <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">{SHOWCASE_VIDEOS[3].title}</h3>
                <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-white/70">{SHOWCASE_VIDEOS[3].copy}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default VideoShowcase;
