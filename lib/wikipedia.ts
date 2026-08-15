/**
 * Wikipedia research (architecture.md §7). FREE — no OpenAI, no key.
 * The plan call is told to use ONLY this text; anything not in here must not
 * appear in the reel.
 */

const UA = "PastForwardIndia/0.1 (hackathon build; contact via app)";

export interface Research {
  title: string;
  url: string;
  text: string;
  wordCount: number;
  thin: boolean;
}

/** ~6,000 words keeps the plan call cheap and well inside context. */
const MAX_WORDS = 6000;

function truncateWords(s: string, max: number): string {
  const words = s.split(/\s+/);
  return words.length <= max ? s : words.slice(0, max).join(" ");
}

/** One retry with a short backoff — these APIs occasionally return a bare body. */
async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return (await res.json()) as T;
    } catch {
      /* fall through to retry */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

/** Resolve a typed name to the real article title (handles redirects + near misses). */
export async function resolveTitle(name: string): Promise<string | null> {
  return (await resolveAliases(name)).title;
}

/**
 * Spelling aliases for Commons search. Wikipedia's `searchinfo.suggestion` is
 * exactly the canonical spelling ("Qutub Minar" → suggestion "qutb minar"), and
 * on Commons that spelling is the difference between modern tourist snaps and
 * 1858 photographs — so take both.
 */
export async function resolveAliases(name: string): Promise<{ title: string | null; suggestion: string | null }> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(name)}&srlimit=1&format=json&origin=*`;
  const data = await getJson<{
    query?: { search?: { title: string }[]; searchinfo?: { suggestion?: string } };
  }>(url);
  return {
    title: data?.query?.search?.[0]?.title ?? null,
    suggestion: data?.query?.searchinfo?.suggestion ?? null,
  };
}

/**
 * Plaintext extract for a monument. Returns `thin: true` when the article is too
 * short to build a reel from — the caller then follows the failure ladder
 * (architecture.md §11 step 2).
 */
export async function research(name: string): Promise<Research | null> {
  const title = (await resolveTitle(name)) ?? name;

  const url =
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1` +
    `&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; extract?: string; missing?: string }> };
  };
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined || !page.extract) return null;

  // Drop the tail sections — they are citations and navigation, never history.
  const cleaned = page.extract
    .split(/\n==\s*(See also|References|Further reading|External links|Notes|Bibliography|Gallery)\s*==/i)[0]
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const text = truncateWords(cleaned, MAX_WORDS);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    title: page.title ?? title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title ?? title).replace(/ /g, "_"))}`,
    text,
    wordCount,
    thin: wordCount < 250,
  };
}

/** Where a monument is, for the title card. Free, via Wikidata via Wikipedia. */
export async function locate(title: string): Promise<{ city: string; state: string }> {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item` +
      `&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return { city: "", state: "" };
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> };
    };
    const qid = Object.values(data.query?.pages ?? {})[0]?.pageprops?.wikibase_item;
    if (!qid) return { city: "", state: "" };

    const wd = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { "User-Agent": UA },
    });
    if (!wd.ok) return { city: "", state: "" };
    const body = (await wd.json()) as {
      entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: { id?: string } } } }[]> }>;
    };
    const claims = body.entities?.[qid]?.claims;
    // P131 = located in the administrative territorial entity
    const adminIds = (claims?.P131 ?? [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter(Boolean) as string[];
    if (!adminIds.length) return { city: "", state: "" };

    const labels = await Promise.all(
      adminIds.slice(0, 2).map(async (id) => {
        const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, {
          headers: { "User-Agent": UA },
        });
        if (!r.ok) return "";
        const b = (await r.json()) as {
          entities?: Record<string, { labels?: { en?: { value?: string } } }>;
        };
        return b.entities?.[id]?.labels?.en?.value ?? "";
      })
    );

    return { city: labels[0] ?? "", state: labels[1] ?? "" };
  } catch {
    return { city: "", state: "" };
  }
}
