"use client";

import { useEffect, useRef, useState } from "react";

const BURST = "/healthy/mascot/hero-burst.webp";
const WAVE = "/healthy/mascot/hero-wave.webp";
const STILL = "/healthy/mascot/hero-burst-still.webp";

/**
 * All three files share this canvas: he is cut out, feet on the bottom edge.
 * It is wider than he is, with the spare room on his right-hand side (our
 * left), because that is where the waving hand travels.
 */
const WIDTH = 336;
const HEIGHT = 320;

/**
 * When the entrance footage's feet touch down, in ms from its first frame. The
 * flight from the button is timed to end on it, so the move across the hero
 * and the landing squash inside the footage read as one motion.
 */
export const LANDING_MS = 504;

/**
 * How long the entrance footage runs before its last frame. The looping wave
 * picks up from exactly that pose, so this is when the two are swapped.
 * Must match the frame timings in scripts/healthy-mascot/build.py.
 */
export const ENTRANCE_MS = 2856;

/** Held back this long past ENTRANCE_MS before the wave replaces the entrance. */
const SWAP_MARGIN_MS = 120;

/** How small he starts, as a fraction of his resting size. */
const START_SCALE = 0.18;

/** Past this much scroll the button he leaps from may be off screen. */
const MAX_SCROLL_FOR_BURST = 120;

export type MascotMode = "pending" | "bursting" | "waving" | "still";

/**
 * What he does on arrival. Split out of the component because it is the only
 * decision here, and it is one a test can make without a browser.
 *
 * - "still": reduced motion, or data saver on (the footage is three quarters
 *   of a megabyte, the still 18 KB). No animation at all.
 * - "bursting": the full entrance, then the looping wave.
 * - "waving": the looping wave with no entrance, for when the leap would not
 *   be seen. That is the case when there is no button to leap from, when the
 *   page is already scrolled, and when his landing spot is off screen, which
 *   on most phones it is: the hero is taller than the screen. The two clocks
 *   involved disagree off screen, because a browser stops advancing an
 *   animated image it is not showing while the flight carries on. He would
 *   finish a flight nobody saw, then leap on the spot once scrolled to.
 */
export function entranceMode({
  reducedMotion,
  scrollY,
  hasOrigin,
  restInView = true,
  saveData = false,
}: {
  reducedMotion: boolean;
  scrollY: number;
  hasOrigin: boolean;
  restInView?: boolean;
  saveData?: boolean;
}): "bursting" | "waving" | "still" {
  if (reducedMotion || saveData) return "still";
  if (!hasOrigin || !restInView || scrollY > MAX_SCROLL_FOR_BURST) {
    return "waving";
  }
  return "bursting";
}

type Box = { left: number; top: number; width: number; height: number };

/**
 * The flight's start, as an offset from the resting box: the translation that
 * puts the box's centre on the origin's centre.
 */
export function flightOffset(origin: Box, rest: Box) {
  return {
    dx: origin.left + origin.width / 2 - (rest.left + rest.width / 2),
    dy: origin.top + origin.height / 2 - (rest.top + rest.height / 2),
  };
}

/**
 * The Healthy mascot on the /healthy hero: he bursts out of the hero's
 * call-to-action button, lands at the foot of the hero, and waves for as long
 * as he is on screen.
 *
 * Two pieces of footage, both animated WebP with a real alpha channel, because
 * he lands on a photograph: a white-ground clip blended with `multiply` would
 * let the photo show through his white face. The entrance plays once. The wave
 * loops for ever and starts on the pose the entrance ends on, so the second is
 * laid over the first when the first runs out. One file cannot do both: an
 * animated image loops whole or not at all.
 *
 * Two wrappers move him, one per axis, because a thrown thing travels evenly
 * sideways while it accelerates downward, and a single transform can only have
 * one easing.
 *
 * The footage is downloaded first and handed to the <img>s as object URLs.
 * That is one download each whatever the cache headers say, and an image's
 * own clock starts only when it is on the page, which the flight and the swap
 * are timed against.
 *
 * He is decoration: hidden from assistive tech and ignores the pointer. If the
 * footage fails to load he is simply standing there.
 *
 * Place inside a positioned box whose bottom edge is the ground he lands on.
 */
export function HealthyHeroMascot({
  originSelector,
  className = "",
}: {
  originSelector: string;
  className?: string;
}) {
  const [mode, setMode] = useState<MascotMode>("pending");
  const [urls, setUrls] = useState<{ burst?: string; wave: string } | null>(
    null,
  );
  const [landed, setLanded] = useState(false);
  // The image is in place a moment before its flight is set up. Kept hidden
  // until then, or he would flash at the landing spot and then leap to it.
  const [airborne, setAirborne] = useState(false);
  // "due": the entrance has run out and the wave is being put on the page.
  // "on": the wave has decoded and the entrance underneath can go.
  const [wave, setWave] = useState<"waiting" | "due" | "on">("waiting");
  const boxRef = useRef<HTMLDivElement>(null);
  const xRef = useRef<HTMLDivElement>(null);
  const yRef = useRef<HTMLDivElement>(null);
  const flights = useRef<Animation[]>([]);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const stopWatchingVisibility = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];

    const stand = () => {
      if (cancelled) return;
      setMode("still");
      setLanded(true);
    };

    /** His ground is the box's bottom edge; on screen means that edge is. */
    const restInView = () => {
      const box = boxRef.current;
      if (!box || document.hidden) return false;
      const { bottom } = box.getBoundingClientRect();
      return bottom > 0 && bottom <= window.innerHeight;
    };

    const objectUrl = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      made.push(url);
      return url;
    };

    const download = (src: string) =>
      fetch(src).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      });

    /** No entrance: he is just there, waving. */
    const justWave = (waving: Blob) => {
      setUrls({ wave: objectUrl(waving) });
      setMode("waving");
      setLanded(true);
    };

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;

    const decided = entranceMode({
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
      scrollY: window.scrollY,
      hasOrigin: document.querySelector(originSelector) !== null,
      restInView: restInView(),
      saveData: connection?.saveData === true,
    });

    let raf = 0;
    if (decided === "still") {
      // From a frame callback, not the effect body: no synchronous setState
      // in an effect.
      raf = requestAnimationFrame(stand);
    } else if (decided === "waving") {
      download(WAVE)
        .then((waving) => {
          if (!cancelled) justWave(waving);
        })
        .catch(stand);
    } else {
      // Both before either is shown: the wave has to be ready the instant the
      // entrance ends, not start downloading then.
      Promise.all([download(BURST), download(WAVE)])
        .then(([burst, waving]) => {
          if (cancelled) return;
          // Asked again now rather than trusted from mount: the files are
          // large, and the reader may have scrolled on while they arrived.
          if (window.scrollY > MAX_SCROLL_FOR_BURST || !restInView()) {
            return justWave(waving);
          }
          setUrls({ burst: objectUrl(burst), wave: objectUrl(waving) });
          setMode("bursting");
        })
        .catch(stand);
    }

    const running = flights.current;
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(swapTimer.current);
      stopWatchingVisibility.current?.();
      running.forEach((flight) => flight.cancel());
      running.length = 0;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [originSelector]);

  /** Runs when the entrance image has decoded: its clock starts here, so ours does. */
  const startFlight = () => {
    const origin = document.querySelector(originSelector);
    const x = xRef.current;
    const y = yRef.current;
    setAirborne(true);
    // The margin is for the image's clock starting a frame or two after its
    // load event. Late is free: the entrance holds its last frame, and that
    // frame is the wave's first pose. Early would cut in mid-move.
    swapTimer.current = setTimeout(
      () => setWave("due"),
      ENTRANCE_MS + SWAP_MARGIN_MS,
    );
    // A hidden tab stops the image's clock but not the timer, so the two
    // would part company. Nobody is watching: go straight to the wave.
    const onHide = () => {
      if (!document.hidden) return;
      clearTimeout(swapTimer.current);
      setWave((now) => (now === "waiting" ? "due" : now));
    };
    document.addEventListener("visibilitychange", onHide);
    stopWatchingVisibility.current = () =>
      document.removeEventListener("visibilitychange", onHide);
    if (!origin || !x || !y) return setLanded(true);
    const { dx, dy } = flightOffset(
      origin.getBoundingClientRect(),
      x.getBoundingClientRect(),
    );
    const timing = { duration: LANDING_MS, fill: "backwards" as const };
    const across = x.animate(
      [
        { transform: `translateX(${dx}px) scale(${START_SCALE})` },
        { transform: "translateX(0) scale(1)" },
      ],
      { ...timing, easing: "cubic-bezier(0.3, 0.6, 0.6, 1)" },
    );
    // Up out of the button first, then down faster and faster.
    const down = y.animate(
      [
        { transform: `translateY(${dy}px)`, easing: "ease-out" },
        {
          transform: `translateY(${dy - 36}px)`,
          offset: 0.25,
          easing: "cubic-bezier(0.5, 0, 0.9, 0.6)",
        },
        { transform: "translateY(0)" },
      ],
      timing,
    );
    down.onfinish = () => setLanded(true);
    flights.current.push(across, down);
  };

  /** Footage downloaded but would not decode: stand him there instead. */
  const giveUp = () => {
    clearTimeout(swapTimer.current);
    setMode("still");
    setLanded(true);
  };

  const burstUrl = mode === "bursting" ? urls?.burst : undefined;
  const entranceShowing = burstUrl !== undefined && wave !== "on";
  const waveUrl =
    mode === "waving" || (mode === "bursting" && wave !== "waiting")
      ? urls?.wave
      : undefined;
  // While the entrance is still up the wave sits over it unseen, decoding.
  // The same render that removes the entrance reveals the wave, so the two
  // are never both visible: his hand moves, and the entrance's frozen hand
  // would show through the wave's transparent parts as a ghost.
  const waveOverlaid = entranceShowing;
  const visible = mode === "still" || mode === "waving" || airborne;

  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className={`pointer-events-none ${visible ? "opacity-100" : "opacity-0"} ${className}`}
    >
      {/* Ground shadow: only once he is on the ground. Off centre because he
          is: the canvas keeps its spare room on the waving side. */}
      <span
        className={`absolute bottom-0 left-[57%] h-[7%] w-[52%] -translate-x-1/2 translate-y-1/3 rounded-[50%] bg-slate-950/30 blur-[6px] transition-opacity duration-300 ${
          landed ? "opacity-100" : "opacity-0"
        }`}
      />
      <div ref={xRef}>
        <div ref={yRef} className="relative">
          {/* eslint-disable @next/next/no-img-element -- animated WebP: next/image would re-encode it to a single frame */}
          {mode === "still" && (
            <img
              src={STILL}
              alt=""
              width={WIDTH}
              height={HEIGHT}
              className="relative block h-auto w-full"
            />
          )}
          {entranceShowing && (
            <img
              src={burstUrl}
              alt=""
              width={WIDTH}
              height={HEIGHT}
              onLoad={startFlight}
              onError={giveUp}
              className="relative block h-auto w-full"
            />
          )}
          {waveUrl !== undefined && (
            <img
              src={waveUrl}
              alt=""
              width={WIDTH}
              height={HEIGHT}
              onLoad={mode === "bursting" ? () => setWave("on") : undefined}
              onError={giveUp}
              className={
                waveOverlaid
                  ? "absolute inset-0 block h-full w-full opacity-0"
                  : "relative block h-auto w-full"
              }
            />
          )}
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      </div>
    </div>
  );
}
