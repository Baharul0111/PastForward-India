/**
 * The fixture ReelProps every Phase 3 iteration is built against.
 * Zero API calls, zero dollars. Mirrors what the orchestrator will hand Remotion.
 */

import type { AssetManifest, ReelPlan, ReelProps } from "../lib/types";
import fixture from "../public/mock/qutub-minar-en.json";

export const mockPlan = fixture as unknown as ReelPlan;

export const mockAssets: AssetManifest = {
  slug: "qutub-minar",
  userPhoto: "/mock/userphoto.jpg",
  shots: [
    { shotId: 1, kind: "userPhoto", src: "/mock/userphoto.jpg" },
    {
      shotId: 2,
      kind: "placeholder",
      src: "/mock/shot2.jpg",
      attribution: { sourcePage: "", artist: "Placeholder", license: "—", title: "Mock archival plate" },
    },
    { shotId: 3, kind: "placeholder", src: "/mock/shot3.jpg", stillSrc: "/mock/shot3.jpg", usedFallback: true },
    {
      shotId: 4,
      kind: "placeholder",
      src: "/mock/shot4.jpg",
      attribution: { sourcePage: "", artist: "Placeholder", license: "—", title: "Mock engraving" },
    },
    { shotId: 5, kind: "placeholder", src: "/mock/shot5.jpg", stillSrc: "/mock/shot5.jpg", usedFallback: true },
    {
      shotId: 6,
      kind: "placeholder",
      src: "/mock/shot6.jpg",
      attribution: { sourcePage: "", artist: "Placeholder", license: "—", title: "Mock painting" },
    },
    { shotId: 7, kind: "userPhoto", src: "/mock/userphoto.jpg" },
    { shotId: 8, kind: "placeholder", src: "/mock/userphoto.jpg" },
  ],
  vo: [
    "/mock/vo-shot1.mp3",
    "/mock/vo-shot2.mp3",
    "/mock/vo-shot3.mp3",
    "/mock/vo-shot4.mp3",
    "/mock/vo-shot5.mp3",
    "/mock/vo-shot6.mp3",
    "/mock/vo-shot7.mp3",
    "/mock/vo-shot8.mp3",
  ],
};

export const mockAudio = {
  music: "/audio/music.mp3",
  whoosh: "/audio/whoosh.mp3",
  stone: "/audio/stone.mp3",
  ambience: "/audio/ambience.mp3",
};

export const mockReelProps: ReelProps = {
  plan: mockPlan,
  assets: mockAssets,
  audio: mockAudio,
};
