"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

/*
 * The home hero's background: a silent 11.75 s loop of three scenes, one per job
 * (Strength: a home gym; Focus: a desk by a window; Calm: an armchair and a lamp),
 * each named by a small chip. It is the one looping piece of motion on the site
 * (owner's call, 4 Nov 2026; the rule and its reasons are in globals.css beside
 * the hero-zoom keyframes).
 *
 * Two cuts of the same takes: 16:9 from `lg` up, where the clip runs full-bleed
 * behind the copy, and a square crop below, where it sits as a band under the copy.
 * WIDE_QUERY must match the section's `lg:` breakpoint in page.tsx.
 *
 * The poster is the LCP element. It is server-rendered as a plain <picture>,
 * not next/image: each poster is frame 1 of its clip, written from the same
 * encode, so serving it unchanged means the video fades in over an identical
 * frame with no colour or quality step. The <video> is mounted only after
 * hydration, and only when motion is wanted: never under reduced motion or
 * Save-Data, which get the poster alone (about 30 KB against about 3 MB).
 */
export type VideoCut = { src: string; poster: string; width: number; height: number };
export type VideoCuts = { wide: VideoCut; tall: VideoCut };

export const HERO_VIDEO: VideoCuts = {
  wide: {
    src: "/healthy/video/home-hero-v2-16x9.mp4",
    poster: "/healthy/video/home-hero-v2-16x9-poster.webp",
    width: 1920,
    height: 1080,
  },
  // Square, not 9:16: the band below `lg` is about 375 x 416 on a phone and 768 x 480 on a tablet, so a
  // 1080 x 1080 crop around each scene's subject fills both. A 16:9 take cannot give a 9:16 frame anyway.
  tall: {
    src: "/healthy/video/home-hero-v2-1x1.mp4",
    poster: "/healthy/video/home-hero-v2-1x1-poster.webp",
    width: 1080,
    height: 1080,
  },
} as const;

/*
 * The "How Brian decides" clip on the method page: the same kitchen plate with a
 * frosted panel (sources, label, evidence grade, goal). It is the method page's
 * full-bleed hero: the wide cut from `lg` up (the panel sits in the right half, the
 * heading over the feathered left), the tall cut below, as a band cropped around
 * the panel (see the method page). The `wide` key means "above the query".
 */
export const METHOD_VIDEO: VideoCuts = {
  wide: {
    src: "/healthy/video/method-data-16x9.mp4",
    poster: "/healthy/video/method-data-16x9-poster.webp",
    width: 1920,
    height: 1080,
  },
  tall: {
    src: "/healthy/video/method-data-9x16.mp4",
    poster: "/healthy/video/method-data-9x16-poster.webp",
    width: 1080,
    height: 1920,
  },
};
export const METHOD_QUERY = "(min-width: 64rem)";

/** The section goes full-bleed at Tailwind's `lg` (64rem); so does the wide cut. */
export const WIDE_QUERY = "(min-width: 64rem)";

export type HeroVideoMode = "poster" | "wide" | "tall";

/**
 * Which source to mount, decided once the browser can be asked. Split out of
 * the component because it is the only decision here, and a test can make it
 * without a browser (the same shape as entranceMode in hero-mascot.tsx).
 *
 * - "poster": reduced motion, or data saver on. No video at all.
 * - "wide": the 16:9 clip, from `lg` up.
 * - "tall": the other cut (a 1:1 square on the home hero, 9:16 on the method page), below the query.
 */
export function heroVideoMode({
  reducedMotion,
  saveData = false,
  wide,
}: {
  reducedMotion: boolean;
  saveData?: boolean;
  wide: boolean;
}): HeroVideoMode {
  if (reducedMotion || saveData) return "poster";
  return wide ? "wide" : "tall";
}

export function HeroVideo({
  alt,
  video = HERO_VIDEO,
  query = WIDE_QUERY,
  fit = "object-[center_60%] lg:object-center",
  label = "background video",
}: {
  alt: string;
  video?: VideoCuts;
  /** Media query under which the wide cut is used. */
  query?: string;
  /** object-position classes for the poster and the clip. */
  fit?: string;
  /** Names the clip in the pause button: "Pause <label>". */
  label?: string;
}) {
  // "pending" until the mount effect runs: the server and the first client
  // render both show the poster alone, so there is nothing to hydrate apart.
  const [mode, setMode] = useState<HeroVideoMode | "pending">("pending");
  // Set once the visitor pauses it themselves. Lives here, above the clip, so
  // their choice survives both scrolling back and a swap between the cuts.
  // Handed down as two stable functions rather than the ref itself, so the
  // clip never writes to a prop.
  const userPaused = useRef(false);
  const isUserPaused = useCallback(() => userPaused.current, []);
  const setUserPaused = useCallback((paused: boolean) => {
    userPaused.current = paused;
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const saveData = connection?.saveData === true;
    const wideQuery = window.matchMedia(query);
    const decide = () => setMode(heroVideoMode({ reducedMotion: reduced, saveData, wide: wideQuery.matches }));
    decide();
    // Crossing `lg` swaps the cut; the key on <HeroClip> below remounts it
    // with fresh per-clip state.
    wideQuery.addEventListener("change", decide);
    return () => wideQuery.removeEventListener("change", decide);
  }, [query]);

  const source = mode === "wide" || mode === "tall" ? video[mode] : null;

  return (
    <div className="healthy-hero-video absolute inset-0">
      {/* The poster, art-directed by the same breakpoint as the clip. A plain
          <img> inside <picture>, fetched at high priority: it is the largest
          thing above the fold on every screen. */}
      <picture>
        <source media={query} srcSet={video.wide.poster} width={video.wide.width} height={video.wide.height} />
        <img
          src={video.tall.poster}
          width={video.tall.width}
          height={video.tall.height}
          alt={alt}
          fetchPriority="high"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${fit}`}
        />
      </picture>
      {/* A source the browser cannot decode leaves the poster in place. */}
      {source && <HeroClip key={mode} source={source} isUserPaused={isUserPaused} setUserPaused={setUserPaused} onFail={() => setMode("poster")} fit={fit} label={label} />}
    </div>
  );
}

/**
 * One cut, with the state that belongs to that one <video>: whether it has
 * painted a frame yet and whether it is playing. The parent keys this on the
 * mode, so swapping cuts starts over from a transparent, not-yet-playing clip
 * rather than carrying the old clip's flags across.
 */
function HeroClip({
  source,
  isUserPaused,
  setUserPaused,
  onFail,
  fit,
  label,
}: {
  source: VideoCut;
  isUserPaused: () => boolean;
  setUserPaused: (paused: boolean) => void;
  onFail: () => void;
  fit: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // True from the first frame the browser actually paints; the video is
  // transparent until then, so the poster covers the load and any refusal.
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    // A visitor who paused the other cut keeps this one paused too: the
    // autoPlay attribute would otherwise start it against their choice.
    if (isUserPaused()) video.pause();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isUserPaused()) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      },
      { threshold: 0.1 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [isUserPaused]);

  function togglePlay() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  }

  return (
    <>
      <video
        ref={ref}
        src={source.src}
        poster={source.poster}
        width={source.width}
        height={source.height}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
        onPlaying={() => {
          setReady(true);
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onError={onFail}
        className={`absolute inset-0 h-full w-full object-cover ${fit} transition-opacity duration-700 ease-out ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {/* WCAG 2.2.2: anything that moves for more than five seconds needs a
          way to stop it. One 44 px button, bottom-right, above the mascot
          layer (z-20) so it stays clickable at every width. */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="absolute right-4 bottom-4 z-30 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-kinetic-primary shadow-sm transition-colors duration-200 hover:bg-white hover:text-kinetic-primary-electric focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric"
      >
        <Icon name={playing ? "pause" : "play"} size={18} />
      </button>
    </>
  );
}
