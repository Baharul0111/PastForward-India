"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DURATION_SECONDS, LANGS, VISIBLE_LANGS, type JobStatus, type Lang } from "@/lib/types";
import { apiUrl, mediaUrl } from "@/lib/apiBase";
import { Engagement, type AnswerMap } from "./Engagement";
import styles from "./reel.module.css";

/** The UI ships English + Hindi. `LANGS` stays wide — see lib/types.ts. */
const LANG_PILLS = LANGS.filter((l) => VISIBLE_LANGS.includes(l.code));

interface TrustPayload {
  sources: { title: string; url: string }[];
  attributions: { shotIds: number[]; artist: string; license: string; sourcePage: string; title?: string }[];
  reconstructionRanges: string;
  narrationIsAI: boolean;
}

interface ReelPayload {
  slug: string;
  lang: Lang;
  cached: boolean;
  reelUrl: string | null;
  plan: { hook?: string; takeaway?: string; monument?: { name: string; city: string } } | null;
  trust: TrustPayload;
}

/* ------------------------------------------------------------------ */
/* Wait-screen music bed                                               */
/* ------------------------------------------------------------------ */

const MUSIC_SRC = "/audio/music.mp3";
/** Background, not the show. The reel's own soundtrack is the star. */
const MUSIC_LEVEL = 0.25;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 700;

/**
 * A quiet loop under the wait screen, gone the instant the reel appears.
 *
 * Autoplay is the whole difficulty. The visitor tapped a button on `/` to get
 * here, and because App Router navigation keeps the same document that sticky
 * activation usually carries over — but "usually" is not "always" (hard reload,
 * shared link, Safari). So every path is handled and every failure is silent:
 *
 *   play() resolves → fade up, nothing shown
 *   play() rejects  → a small "tap for sound" pill, plus a one-shot listener so
 *                     that ANY tap on the page (a question chip counts) starts it
 *   media errors    → the pill is never offered again; the screen stays silent
 *
 * Silence is always an acceptable outcome. A browser error on screen is not.
 */
function useWaitMusic(active: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** the bed is actually audible right now */
  const startedRef = useRef(false);
  /** the file will not decode — never offer sound again */
  const deadRef = useRef(false);
  /** the reel arrived (or blew up); nothing may restart the bed */
  const overRef = useRef(false);
  const [needsTap, setNeedsTap] = useState(false);

  const clearFade = useCallback(() => {
    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  const fade = useCallback(
    (to: number, ms: number, then?: () => void) => {
      const a = audioRef.current;
      if (!a) return;
      clearFade();
      const from = a.volume;
      const t0 = Date.now();
      fadeRef.current = setInterval(() => {
        const el = audioRef.current;
        if (!el) return clearFade();
        const k = ms <= 0 ? 1 : Math.min(1, (Date.now() - t0) / ms);
        el.volume = Math.min(1, Math.max(0, from + (to - from) * k));
        if (k >= 1) {
          clearFade();
          then?.();
        }
      }, 40);
    },
    [clearFade]
  );

  const enableSound = useCallback(() => {
    const a = audioRef.current;
    if (!a || deadRef.current || overRef.current || startedRef.current) return;
    a.volume = 0;
    let p: Promise<void> | undefined;
    try {
      p = a.play() as Promise<void> | undefined;
    } catch {
      setNeedsTap(true);
      return;
    }
    const up = () => {
      startedRef.current = true;
      setNeedsTap(false);
      if (!overRef.current) fade(MUSIC_LEVEL, FADE_IN_MS);
    };
    if (!p || typeof p.then !== "function") return up();
    p.then(up).catch(() => {
      // Blocked, not broken. Offer the tap; never surface the rejection.
      if (!deadRef.current && !overRef.current) setNeedsTap(true);
    });
  }, [fade]);

  // Own the element for the life of the screen so that stopping can be a fade
  // rather than a cut. Declared before the active effect so it runs first.
  useEffect(() => {
    const a = new Audio(mediaUrl(MUSIC_SRC));
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    audioRef.current = a;

    const onErr = () => {
      deadRef.current = true;
      setNeedsTap(false);
    };
    a.addEventListener("error", onErr);

    // Any gesture anywhere unblocks audio — tapping a question chip is enough,
    // so most people never see the pill at all.
    const onGesture = () => enableSound();
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      a.removeEventListener("error", onErr);
      clearFade();
      a.pause();
      a.src = "";
      audioRef.current = null;
      startedRef.current = false;
    };
  }, [enableSound, clearFade]);

  useEffect(() => {
    if (active) {
      overRef.current = false;
      enableSound();
      return;
    }
    // done / error — get out of the reel's way immediately.
    overRef.current = true;
    setNeedsTap(false);
    const a = audioRef.current;
    if (!a) return;
    if (!startedRef.current) {
      clearFade();
      a.pause();
      return;
    }
    fade(0, FADE_OUT_MS, () => {
      audioRef.current?.pause();
      startedRef.current = false;
    });
  }, [active, enableSound, fade, clearFade]);

  return { needsTap, enableSound };
}

/**
 * The pipeline's raw error can be a provider blob or a stack. Show it only when
 * it reads like a sentence a person wrote; otherwise the calm headline stands
 * on its own.
 */
function calmDetail(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s.length > 110) return null;
  if (s === "Something broke.") return null;
  if (/[\n{}]|\bat\s+\S+:\d|error:|https?:\/\/|\.(ts|js|tsx):/i.test(s)) return null;
  return s;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function ReelPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const search = useSearchParams();
  const monumentName = decodeURIComponent(params.slug);
  const initialLang = (search.get("lang") as Lang) || "en";

  const [lang, setLang] = useState<Lang>(initialLang);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [payload, setPayload] = useState<ReelPayload | null>(null);
  const [showTrust, setShowTrust] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Wait-screen answers. Client-side only, never sent anywhere.
  const [answers, setAnswers] = useState<AnswerMap>({});
  /** Ticks once a second so the wait screen is never motionless. */
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Monotonic token: every start() claims one; only the newest may poll.
  const runIdRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadTrust = useCallback(async (slug: string, l: Lang) => {
    try {
      const r = await fetch(apiUrl(`/api/reel/${encodeURIComponent(slug)}?lang=${l}`), { cache: "no-store" });
      if (r.ok) setPayload((await r.json()) as ReelPayload);
    } catch {
      /* the card is additive — never block playback on it */
    }
  }, []);

  const start = useCallback(
    async (l: Lang) => {
      const myRun = ++runIdRef.current;
      stopPolling();
      setStatus(null);
      setFailure(null);
      setPayload(null);
      startedAtRef.current = Date.now();
      setElapsedMs(0);

      let photo: string | undefined;
      if (search.get("photo")) {
        try {
          photo = sessionStorage.getItem("pf:photo") ?? undefined;
        } catch {
          photo = undefined;
        }
      }

      let job: string;
      let slug: string;
      try {
        const res = await fetch(apiUrl("/api/generate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: monumentName, lang: l, photo }),
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Generation failed");
        const j = (await res.json()) as { job: string; slug: string; cached: boolean };
        job = j.job;
        slug = j.slug;
      } catch (e) {
        setFailure(e instanceof Error ? e.message : "Generation failed");
        return;
      }

      const tick = async () => {
        if (runIdRef.current !== myRun) return stopPolling();
        try {
          const r = await fetch(apiUrl(`/api/status/${job}`), { cache: "no-store" });
          if (!r.ok) return;
          const s = (await r.json()) as JobStatus;
          if (runIdRef.current !== myRun) return stopPolling();
          setStatus(s);
          if (s.step === "done" || s.step === "error") {
            stopPolling();
            if (s.step === "error") setFailure(s.error ?? "Something broke.");
            else void loadTrust(slug, l);
          }
        } catch {
          /* transient — the next tick retries */
        }
      };

      // A newer start() may have been kicked off while the POST above was in
      // flight (StrictMode double-invoke, or a fast language switch). If so,
      // this run is stale — do not install a poller that can never be cleared.
      if (runIdRef.current !== myRun) return;

      void tick();
      stopPolling();
      pollRef.current = setInterval(tick, 1500);
    },
    [monumentName, search, loadTrust]
  );

  useEffect(() => {
    void start(lang);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const done = status?.step === "done";
  const reelUrl = status?.reelUrl ?? payload?.reelUrl ?? null;
  const displayName = payload?.plan?.monument?.name ?? monumentName;
  const waiting = !done && !failure;

  // One tick a second: the elapsed clock is the proof-of-life that a progress
  // bar sitting on one number cannot give.
  useEffect(() => {
    if (!waiting) return;
    setElapsedMs(Date.now() - startedAtRef.current);
    const id = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  const { needsTap, enableSound } = useWaitMusic(waiting);
  const detail = calmDetail(failure);

  return (
    <main className={styles.main}>
      <button className={styles.back} onClick={() => router.push("/")} type="button">
        ← New place
      </button>

      <h1 className={styles.name}>{displayName}</h1>
      {payload?.plan?.hook && done && <p className={styles.hook}>{payload.plan.hook}</p>}

      {waiting && (
        <section className={styles.progress}>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${Math.max(3, status?.pct ?? 4)}%` }} />
          </div>

          {status?.cached ? (
            <p className={styles.cachedNote}>Already in the archive — playing instantly.</p>
          ) : (
            /* Said plainly, once, before the wait starts to feel wrong. */
            <p className={styles.eta}>
              Nothing about this is pre-made — a first look at somewhere new takes about{" "}
              <strong>3–5 minutes</strong> to build. Keep this open; it plays the second it&rsquo;s ready.
            </p>
          )}

          {/* While-you-wait micro-conversation. The reel always wins: this whole
              block unmounts the moment status flips to done. */}
          <Engagement
            pct={status?.pct ?? 4}
            label={status?.label}
            elapsed={clock(elapsedMs)}
            startYear={status?.startYear}
            questions={status?.questions}
            category={status?.category}
            onAnswers={setAnswers}
          />

          {needsTap && (
            <button type="button" className={styles.soundOn} onClick={enableSound}>
              ♪ Tap for sound
            </button>
          )}
        </section>
      )}

      {failure && (
        <section className={styles.failure}>
          <p className={styles.failureHead}>That one didn&rsquo;t come together.</p>
          <p className={styles.failureBody}>
            Nothing is lost — the archive work already done is saved. Try again and it picks up from
            there.
          </p>
          {detail && <p className={styles.failureDetail}>{detail}</p>}
          <button type="button" className={styles.retry} onClick={() => void start(lang)}>
            Try again
          </button>
        </section>
      )}

      {done && reelUrl && (
        <section className={styles.player}>
          {answers.visit === "First time" && <p className={styles.forYou}>Made for your first visit ✨</p>}
          <video
            ref={videoRef}
            className={styles.video}
            src={mediaUrl(reelUrl)}
            playsInline
            loop
            autoPlay
            muted
            controls
            onClick={() => {
              const v = videoRef.current;
              if (v) v.muted = !v.muted;
            }}
          />
          <p className={styles.tapHint}>Tap the video for sound</p>

          <div className={styles.langs}>
            {LANG_PILLS.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`${styles.lang} ${lang === l.code ? styles.langOn : ""}`}
                onClick={() => setLang(l.code)}
              >
                {l.native}
              </button>
            ))}
          </div>

          <button type="button" className={styles.trustToggle} onClick={() => setShowTrust((s) => !s)}>
            How do we know this? {showTrust ? "▴" : "▾"}
          </button>

          {showTrust && payload && (
            <div className={styles.trust}>
              <h2 className={styles.trustHead}>Sources</h2>
              {payload.trust.sources.length ? (
                <ul className={styles.trustList}>
                  {payload.trust.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer noopener">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.trustEmpty}>Sources are attached in Phase 2.</p>
              )}

              <h2 className={styles.trustHead}>Archival material</h2>
              {payload.trust.attributions.length ? (
                <ul className={styles.trustList}>
                  {payload.trust.attributions.map((a) => (
                    <li key={a.sourcePage}>
                      <a href={a.sourcePage} target="_blank" rel="noreferrer noopener">
                        {a.title?.replace(/\.(jpe?g|png|tif|webp)$/i, "") ?? `Shot ${a.shotIds[0]}`}
                      </a>{" "}
                      — {a.artist} · {a.license}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.trustEmpty}>Wikimedia attributions are attached in Phase 4.</p>
              )}

              <h2 className={styles.trustHead}>Reconstructed scenes</h2>
              <p className={styles.trustBody}>
                {payload.trust.reconstructionRanges} — these seconds are AI reconstructions of what no camera
                recorded, labelled in-frame. Everything else is real archival material or code-drawn graphics.
              </p>
              <p className={styles.trustFoot}>
                Narration is AI-generated. This is a {Math.round(DURATION_SECONDS)}-second introduction,
                never the complete history.
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
