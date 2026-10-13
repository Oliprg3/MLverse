"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/theme-provider";

/**
 * PipelineScene — a live 3D view of the pipeline topology the product runs.
 *
 * The hero previously looped a stock pexels video as its background. That was
 * the weakest element on the page: a heavyweight external asset standing in for
 * the thing the product actually does. This renders the real pipeline shape
 * (data -> preprocessing -> model -> visualisation) in depth instead, so the
 * hero shows the product rather than stock footage.
 *
 * Craft constraints handled here:
 *  - `three` is imported dynamically so it never enters the SSR or initial bundle.
 *  - Rendering pauses whenever the scene is offscreen or the tab is hidden.
 *  - `prefers-reduced-motion` renders one static frame and stops the loop.
 *  - DPR is capped, node count drops on small/coarse-pointer devices.
 *  - Everything (geometry, material, renderer) is disposed on unmount.
 *  - No WebGL support, or a lost context, degrades to an empty layer rather
 *    than throwing.
 */

type Stage = { key: string; label: string; accent: string; nodes: string[] };

const STAGES: Stage[] = [
  { key: "data", label: "data", accent: "#38bdf8", nodes: ["CSV", "API", "images"] },
  { key: "prep", label: "prep", accent: "#a1a1aa", nodes: ["scale", "impute", "PCA"] },
  { key: "model", label: "model", accent: "#fbbf24", nodes: ["MLP", "CNN"] },
  { key: "eval", label: "eval", accent: "#34d399", nodes: ["metrics", "charts"] },
];

/** Per-stage palette. Each theme needs its own inks: the hero is white in light
 *  mode, so light-grey nodes (which read well on near-black) disappear on it.
 *  These were originally one hardcoded light ramp, which made the scene
 *  invisible in light mode — the default for most visitors. */
const THEMES = {
  dark: {
    ink: ["#e4e4e7", "#a1a1aa", "#71717a", "#d4d4d8"],
    stars: "#a1a1aa",
    starOpacity: 0.5,
    edgeOpacity: 0.16,
    fog: 0x000000,
  },
  light: {
    ink: ["#18181b", "#3f3f46", "#71717a", "#52525b"],
    stars: "#52525b",
    starOpacity: 0.32,
    edgeOpacity: 0.3,
    fog: 0xffffff,
  },
} as const;

export function PipelineScene({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    let observer: IntersectionObserver | undefined;
    let onVisibility: (() => void) | undefined;

    (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        return; // bundle unavailable — leave the layer empty, hero text still reads
      }
      if (disposed) return;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", { antialias: true, alpha: true })
        ?? canvas.getContext("webgl", { antialias: true, alpha: true });
      if (!context) return; // no WebGL at all — degrade silently

      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const isSmall = window.matchMedia("(max-width: 640px)").matches;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const lean = isCoarse || isSmall;
      // Resolve the palette before anything is built — the hero is white in
      // light mode, so light-grey nodes would be invisible on it.
      const palette = THEMES[themeRef.current === "light" ? "light" : "dark"];

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
      } catch {
        return;
      }
      renderer.setClearColor(0x000000, 0);
      // Cap DPR: the scene is decorative depth, not a texture-heavy hero.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lean ? 1.25 : 1.75));

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x000000, 0.055);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0.6, 11);

      const group = new THREE.Group();
      scene.add(group);

      // ── Geometry: one row per stage, receding on Z for depth ──────────────
      const nodeGeo = new THREE.BoxGeometry(1.05, 0.42, 0.42);
      const edgeGeo = new THREE.PlaneGeometry(0.16, 0.9);
      const disposables: Array<{ dispose(): void }> = [nodeGeo, edgeGeo];

      const placed: Array<{ x: number; y: number; z: number; mesh: import("three").Mesh }> = [];
      const columns: Array<Array<{ x: number; y: number; z: number }>> = [];

      STAGES.forEach((stage, si) => {
        const colX = (si - (STAGES.length - 1) / 2) * 3.15;
        const colZ = -si * 1.55; // push each stage back so perspective does the work
        const col: Array<{ x: number; y: number; z: number }> = [];

        stage.nodes.forEach((label, ni) => {
          const spread = stage.nodes.length > 1 ? 1.05 : 0;
          const y = (ni - (stage.nodes.length - 1) / 2) * spread;
          const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(palette.ink[ni % palette.ink.length]),
            transparent: true,
            opacity: 0.9,
          });
          const mesh = new THREE.Mesh(nodeGeo, mat);
          mesh.position.set(colX, y, colZ);
          group.add(mesh);
          placed.push({ x: colX, y, z: colZ, mesh });
          col.push({ x: colX, y, z: colZ });
          disposables.push(mat);
        });
        columns.push(col);
      });

      // Connect every node in a stage to every node in the next — that is what
      // a canvas fan-out actually looks like, and it reads better in 3D than a
      // single chain.
      for (let si = 0; si < columns.length - 1; si++) {
        const from = columns[si];
        const to = columns[si + 1];
        if (lean && from.length * to.length > 4) continue; // keep mobile cheap
        for (const a of from) {
          for (const b of to) {
            const ax = a.x + 0.52;
            const bx = b.x - 0.52;
            const dx = bx - ax;
            const dy = b.y - a.y;
            const dz = b.z - a.z;
            const len = Math.hypot(dx, dy, dz);
            const mat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(STAGES[si].accent),
              transparent: true,
              opacity: palette.edgeOpacity,
              side: THREE.DoubleSide,
              depthWrite: false,
            });
            const link = new THREE.Mesh(edgeGeo, mat);
            link.scale.set(len / 0.16, 1, 1);
            link.position.set(ax + dx / 2, a.y + dy / 2, a.z + dz / 2);
            link.lookAt(bx, b.y, b.z);
            group.add(link);
            disposables.push(mat);
          }
        }
      }

      // Ambient point lights are pointless for MeshBasicMaterial, so depth is
      // carried purely by scale, fog and a size falloff instead.
      const starCount = lean ? 60 : 150;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 26;
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
        starPos[i * 3 + 2] = -Math.random() * 22 - 2;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.06,
        transparent: true,
        opacity: palette.starOpacity,
        color: new THREE.Color(palette.stars),
        sizeAttenuation: true,
      });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);
      disposables.push(starGeo, starMat);

      // ── Interaction: pointer parallax, not a mouse-chase effect ───────────
      const pointer = { x: 0, y: 0 };
      const onPointerMove = (event: PointerEvent) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Pull the camera back on narrow screens so the full pipeline stays in
        // frame instead of clipping the outer stages.
        camera.position.z = h > w ? 15.5 : 11;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      scene.fog = new THREE.FogExp2(palette.fog, 0.055);
      starMat.needsUpdate = true;

      // ── Loop ───────────────────────────────────────────────────────────────
      let raf = 0;
      let visible = true;
      let tabVisible = true;
      const clock = new THREE.Clock();

      const draw = (elapsed: number) => {
        // Slow drift plus a gentle sine bob — alive, never busy.
        group.rotation.y = Math.sin(elapsed * 0.16) * 0.16 + pointer.x * 0.1;
        group.rotation.x = Math.cos(elapsed * 0.13) * 0.05 + pointer.y * -0.06;
        stars.rotation.y = elapsed * 0.008;

        // Stagger the pulse so data packets appear to travel down the pipeline.
        for (let i = 0; i < placed.length; i++) {
          const node = placed[i];
          node.mesh.scale.setScalar(1 + Math.sin(elapsed * 1.4 - i * 0.42) * 0.055);
        }
        camera.lookAt(0, 0, -2.2);
        renderer.render(scene, camera);
      };

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!visible || !tabVisible) return;
        draw(clock.getElapsedTime());
      };

      const renderStatic = () => draw(0);

      if (reduceMotion) {
        renderStatic();
      } else {
        loop();
        observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.01 });
        observer.observe(host);
        onVisibility = () => { tabVisible = document.visibilityState === "visible"; if (tabVisible && !reduceMotion && visible) draw(clock.getElapsedTime()); };
        document.addEventListener("visibilitychange", onVisibility);
      }

      const onContextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); };
      const onContextRestored = () => { if (!reduceMotion) loop(); };
      canvas.addEventListener("webglcontextlost", onContextLost);
      canvas.addEventListener("webglcontextrestored", onContextRestored);

      host.appendChild(canvas);

      cleanup = () => {
        cancelAnimationFrame(raf);
        observer?.disconnect();
        ro.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);
        scene.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        for (const item of disposables) item.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} />;
}

export default PipelineScene;