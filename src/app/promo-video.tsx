"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

/*
 * The mascot promo video, beside the pick loop. Its four edges are feathered
 * into the section background (`.healthy-feather` in globals.css) so it sits
 * softly on the page rather than as a hard box.
 *
 * It plays muted and looping while on screen, and pauses off screen. Under
 * reduced motion it does not start by itself; the play button still works.
 * The clip is square (720 x 720) and its last frame is its first, so the loop
 * has no visible seam.
 */
const SRC = "/healthy/video/mascot-promo.mp4";
const POSTER = "/healthy/video/mascot-promo-poster.webp";

export function PromoVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Set once the visitor pauses it themselves, so scrolling back does not restart it.
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) userPaused.current = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused.current) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function togglePlay() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  }

  function toggleSound() {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  const button =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-kinetic-primary shadow-sm transition-colors duration-200 hover:bg-white hover:text-kinetic-primary-electric focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kinetic-primary-electric";

  return (
    <div className={`mx-auto w-full ${className}`}>
      <video
        ref={ref}
        src={SRC}
        poster={POSTER}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label="GetBrian Healthy promo video featuring the mascot"
        className="healthy-feather aspect-square h-auto w-full object-cover"
      />
      {/* Centred below the frame, under the burned-in captions. Inside it there
          is no room: a disclaimer line runs along the frame's bottom edge, and
          the gap between it and a two-line caption is narrower than a button
          on a phone. */}
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" onClick={togglePlay} aria-label={playing ? "Pause video" : "Play video"} className={button}>
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <button type="button" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"} className={button}>
          <Icon name={muted ? "volumeOff" : "volume"} size={18} />
        </button>
      </div>
    </div>
  );
}
