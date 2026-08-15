"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGS, VISIBLE_LANGS, type Lang } from "@/lib/types";
import { apiUrl } from "@/lib/apiBase";
import { isNative, pickPhotoNative } from "@/lib/nativeCamera";
import type { IdentifyResult } from "./api/identify/route";
import styles from "./home.module.css";

/**
 * Deliberately mixed: a monument, a second monument people know, an ANIMAL and a
 * NATURAL PLACE. The chips are the fastest way to say "this is not a monuments app".
 */
const SUGGESTIONS = ["Qutub Minar", "Taj Mahal", "Bengal Tiger", "Dal Lake"];

/** The UI ships English + Hindi. `LANGS` stays wide — see lib/types.ts. */
const LANG_PILLS = LANGS.filter((l) => VISIBLE_LANGS.includes(l.code));

/**
 * A phone camera photo is 4–6 MB, which becomes an 8 M-character base64 data URL
 * and adds ~19s of pure upload to the identify step — on screen during the
 * opening beat of the demo. Vision runs at `detail: "low"` server-side, so
 * nothing above ~1024px on the long edge is ever looked at.
 */
const MAX_PHOTO_EDGE = 1024;
const PHOTO_JPEG_QUALITY = 0.85;

/** Original, untouched — the last-resort path if a browser can't decode the file. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(file);
  });
}

interface Decoded {
  source: CanvasImageSource;
  w: number;
  h: number;
  release: () => void;
}

/**
 * `createImageBitmap` first: it decodes off the main thread AND, unlike
 * `<img>.decode()`, is not deferred while the document is hidden — a plain
 * <img> decode can hang indefinitely in a backgrounded tab. `from-image`
 * applies the EXIF rotation, which matters because a sideways photo is a
 * measurably worse photo to identify.
 */
async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      return { source: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch {
      /* older engine or an unsupported format — fall through to <img> */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = objectUrl;
    await img.decode();
    return {
      source: img,
      w: img.naturalWidth,
      h: img.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (e) {
    URL.revokeObjectURL(objectUrl);
    throw e;
  }
}

/**
 * Decode → draw to a canvas at ≤1024px on the long edge → re-encode as JPEG.
 * Aspect ratio is preserved and the source File is never mutated. Any failure
 * (HEIC, no 2d context, tainted canvas) falls back to the full-size data URL, so
 * this can only ever make the photo path faster, never break it.
 */
async function toDownscaledDataUrl(file: File): Promise<string> {
  const img = await decodeImage(file);
  try {
    if (!img.w || !img.h) throw new Error("no dimensions");

    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.w, img.h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.w * scale));
    canvas.height = Math.max(1, Math.round(img.h * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);

    const out = canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
    if (!out.startsWith("data:image/jpeg")) throw new Error("encode failed");
    return out;
  } finally {
    img.release();
  }
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  // Low-confidence identification → "Is this what you're looking at?"
  const [pending, setPending] = useState<{ result: IdentifyResult; photo?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function go(subject: string, photo?: string) {
    const q = subject.trim();
    if (!q) {
      setError("Name something, or photograph what's in front of you.");
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(null);
    if (photo) {
      try {
        sessionStorage.setItem("pf:photo", photo);
      } catch {
        /* photo is a nicety, never a blocker */
      }
    }
    router.push(`/reel/${encodeURIComponent(q)}?lang=${lang}${photo ? "&photo=1" : ""}`);
  }

  /**
   * The ONE entry point. Typing and photographing are the same journey:
   * identify → (confirm if unsure) → generate. A typed subject is passed through
   * identify unchanged and costs nothing; a photo is identified by vision.
   */
  async function identifyThenGo(input: { name?: string; photo?: string }) {
    const typed = (input.name ?? "").trim();
    if (!typed && !input.photo) {
      setError("Name something, or photograph what's in front of you.");
      return;
    }

    setBusy(true);
    setError(null);
    setPending(null);
    setIdentifying(true);

    try {
      // The PHOTO decides what this is — never assume a default subject.
      const res = await fetch(apiUrl("/api/identify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: typed || undefined, photo: input.photo }),
      });
      const data = (await res.json()) as IdentifyResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Could not work out what that is");

      setIdentifying(false);
      if (data.confidence < 0.85 && data.alternatives?.length) {
        // architecture.md §4 — let the visitor confirm before we spend anything.
        setPending({ result: data, photo: input.photo });
        setBusy(false);
        return;
      }
      go(data.name || typed, input.photo);
    } catch (err) {
      setIdentifying(false);
      // A typed subject never gets blocked by identify — the pipeline resolves
      // the real title from Wikipedia anyway.
      if (typed) {
        go(typed, input.photo);
        return;
      }
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not work out what that is");
    }
  }

  /** Web: the hidden <input type="file">. Android (Capacitor): the native sheet. */
  async function onPhotoTrigger(e: React.MouseEvent<HTMLButtonElement>) {
    if (isNative()) {
      e.preventDefault();
      const photo = await pickPhotoNative();
      if (!photo) return; // cancelled — silently do nothing
      void identifyThenGo({ name, photo });
      return;
    }
    fileRef.current?.click();
  }

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    // Let the same file be picked twice in a row.
    input.value = "";

    setBusy(true);
    setError(null);
    setIdentifying(true);

    let photo: string;
    try {
      photo = await toDownscaledDataUrl(file);
    } catch {
      try {
        photo = await readAsDataUrl(file);
      } catch {
        setIdentifying(false);
        setBusy(false);
        setError("That photo couldn't be read. Try another one.");
        return;
      }
    }
    void identifyThenGo({ name, photo });
  }

  return (
    <main className={styles.main}>
      <div className={styles.top}>
        <h1 className={styles.logo}>
          PastForward <span className={styles.accent}>India</span>
        </h1>
        <p className={styles.tagline}>POINT AT HISTORY. WATCH TIME MOVE.</p>
      </div>

      <div className={styles.center}>
        <div className={styles.paths}>
          {/* ---- Path A: name it ---- */}
          <form
            className={styles.path}
            onSubmit={(e) => {
              e.preventDefault();
              void identifyThenGo({ name });
            }}
          >
            <p className={styles.pathLabel}>NAME IT</p>
            <div className={styles.pathBody}>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bengal tiger, Dal Lake, Qutub Minar…"
                aria-label="Name any place, building, landscape or creature in India"
                autoComplete="off"
                disabled={busy}
              />
            </div>
            <button className={styles.action} type="submit" disabled={busy}>
              {busy && !identifying ? "Opening…" : "Generate my time travel →"}
            </button>
          </form>

          <div className={styles.or}>
            <span />
            or
            <span />
          </div>

          {/* ---- Path B: show it ---- */}
          <div className={styles.path}>
            <p className={styles.pathLabel}>SHOW IT</p>
            <div className={styles.pathBody}>
              <p className={styles.pathHint}>
                Point your camera at whatever is in front of you — we&rsquo;ll work out what it is.
              </p>
            </div>
            <button
              className={`${styles.action} ${styles.actionPhoto}`}
              onClick={onPhotoTrigger}
              disabled={busy}
              type="button"
            >
              <span className={styles.cameraGlyph} aria-hidden>
                ◎
              </span>
              Take a photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void onPhotoFile(e)}
              hidden
            />
          </div>
        </div>

        <div className={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.chip}
              onClick={() => void identifyThenGo({ name: s })}
              disabled={busy}
            >
              {s}
            </button>
          ))}
        </div>

        {identifying && <p className={styles.identifying}>Working out what you&rsquo;re looking at…</p>}

        {pending && (
          <div className={styles.confirm}>
            <p className={styles.confirmTitle}>Is this what you&rsquo;re looking at?</p>
            <button
              type="button"
              className={styles.confirmOpt}
              onClick={() => go(pending.result.name, pending.photo)}
            >
              {pending.result.name}
              {pending.result.city ? <span className={styles.confirmCity}> · {pending.result.city}</span> : null}
            </button>
            {pending.result.alternatives.map((a) => (
              <button
                key={a.slug}
                type="button"
                className={styles.confirmOpt}
                onClick={() => go(a.name, pending.photo)}
              >
                {a.name}
                {a.city ? <span className={styles.confirmCity}> · {a.city}</span> : null}
              </button>
            ))}
            <button type="button" className={styles.confirmSkip} onClick={() => setPending(null)}>
              None of these
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.bottom}>
        <p className={styles.langLabel}>NARRATION LANGUAGE</p>
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
        <p className={styles.disclosure}>
          Narration is AI-generated. Reconstructed scenes are labelled in-frame.
        </p>
      </div>
    </main>
  );
}
