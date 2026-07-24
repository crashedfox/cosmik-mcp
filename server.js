#!/usr/bin/env node
/**
 * Cosmik MCP server (stdio) — live space data for AI agents.
 *
 * Runs fully locally: tools fetch Cosmik's public, keyless JSON/RSS endpoints
 * (the same data that powers gocosmik.com) and return structured results.
 * No credentials, no configuration.
 *
 *   • get_next_launches — upcoming orbital launches (Launch Library 2 data)
 *   • get_iss_passes    — ISS pass predictions for 550+ cities
 *   • get_launch_news   — latest launch previews & recaps
 *
 * A hosted streamable-HTTP variant of this server also exists at
 * https://gocosmik.com/api/mcp for clients that prefer remote servers.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SITE = "https://gocosmik.com";
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

const server = new McpServer({ name: "cosmik-live-space-data", version: "1.1.0" });

function result(text, structuredContent) {
  return { content: [{ type: "text", text }], structuredContent };
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "cosmik-mcp/1.1" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

/* ── get_next_launches ─────────────────────────────────────────────────── */
server.registerTool(
  "get_next_launches",
  {
    title: "Upcoming rocket launches",
    description:
      "Live schedule of upcoming orbital rocket launches (SpaceX, NASA, Rocket Lab, ULA, Arianespace, China…) with liftoff times (UTC), pads, status and a live-tracking link. Optionally filter by provider/rocket name.",
    annotations: READ_ONLY,
    inputSchema: {
      provider: z.string().optional().describe("Case-insensitive filter matched against provider and rocket name, e.g. 'SpaceX', 'NASA', 'Rocket Lab'"),
      limit: z.number().int().min(1).max(20).default(5).describe("Maximum number of launches to return (1-20, default 5)"),
    },
  },
  async ({ provider, limit = 5 }) => {
    const json = await getJson(`${SITE}/api/launches`);
    let rows = (json.results ?? []).map((r) => ({
      name: String(r.name ?? ""),
      liftoff_utc: String(r.net ?? ""),
      status: r.status?.name ?? "",
      provider: r.launch_service_provider?.name ?? "",
      pad: r.pad?.name ?? "",
      watch_live: `${SITE}/?launch=${r.id}`,
    }));
    if (provider) {
      const p = provider.toLowerCase();
      rows = rows.filter((l) => `${l.provider} ${l.name}`.toLowerCase().includes(p));
    }
    rows = rows.filter((l) => new Date(l.liftoff_utc).getTime() > Date.now() - 3600_000).slice(0, limit);
    if (!rows.length)
      return result(`No upcoming launches found${provider ? ` for "${provider}"` : ""}. Full schedule: ${SITE}/launches`, { launches: [] });
    return result(
      rows
        .map((l) => `${l.name} — ${new Date(l.liftoff_utc).toUTCString()} — ${l.provider}${l.pad ? ` — ${l.pad}` : ""}${l.status ? ` — status: ${l.status}` : ""}\n  track live: ${l.watch_live}`)
        .join("\n") + `\n\nSource: Cosmik (${SITE}/launches), data via Launch Library 2.`,
      { launches: rows },
    );
  },
);

/* ── get_iss_passes ────────────────────────────────────────────────────── */
server.registerTool(
  "get_iss_passes",
  {
    title: "ISS pass times for a city",
    description:
      "When the International Space Station will pass over a city in the next 3 days: next pass start time (UTC and local), maximum elevation, duration, and whether it falls in a good viewing window. 550+ major world cities supported (city directory: gocosmik.com/iss-over).",
    annotations: READ_ONLY,
    inputSchema: {
      city: z.string().describe("City name, e.g. 'Paris', 'New York', 'São Paulo' — matched against 550+ major cities"),
    },
  },
  async ({ city }) => {
    const slug = city
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    let json;
    try {
      json = await getJson(`${SITE}/api/widget/iss/${slug}`);
    } catch {
      return result(
        `"${city}" is not in the 550+ known cities. Browse the directory at ${SITE}/iss-over, or use the live sky view for any location: ${SITE}/?view=ground`,
        { location: "unknown", passes: [] },
      );
    }
    const label = `${json.city}, ${json.country}`;
    if (!json.next_pass)
      return result(`No ISS passes above 10° over ${label} in the next 3 days (the ground track shifts daily). Live view: ${SITE}/?view=ground`, {
        location: label,
        passes: [],
      });
    const p = {
      start_utc: json.next_pass.start_utc,
      start_local: json.next_pass.start_local,
      max_elevation_deg: json.next_pass.max_elevation_deg,
      duration_min: json.next_pass.duration_min,
      good_viewing: Boolean(json.next_pass.good_viewing_window),
    };
    return result(
      `Next ISS pass over ${label}:\n${new Date(p.start_utc).toUTCString()} (local ${p.start_local}) — max ${p.max_elevation_deg}° — ~${p.duration_min} min${p.good_viewing ? " — good viewing window" : " — daylight (not visible to the eye)"}\nPasses in next 72h: ${json.passes_72h}\n\nLive tracking + free pass alerts: ${SITE}/iss-over/${json.slug}`,
      { location: label, passes: [p] },
    );
  },
);

/* ── get_launch_news ───────────────────────────────────────────────────── */
server.registerTool(
  "get_launch_news",
  {
    title: "Launch news & recaps",
    description:
      "Latest rocket-launch news articles (previews and post-launch recaps) from Cosmik, optionally filtered by a search term (mission, rocket, or provider name).",
    annotations: READ_ONLY,
    inputSchema: {
      query: z.string().optional().describe("Search term matched against article titles, e.g. 'Starship', 'Crew', 'Ariane'"),
      limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of articles to return (1-10, default 5)"),
    },
  },
  async ({ query, limit = 5 }) => {
    const res = await fetch(`${SITE}/feed.xml`, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "cosmik-mcp/1.1" } });
    if (!res.ok) return result(`Launch news: ${SITE}/news`, { articles: [] });
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const block = m[1];
      const pick = (tag) => {
        const mm = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
        return mm ? mm[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";
      };
      return { title: pick("title"), url: pick("link"), description: pick("description"), pub: pick("pubDate") };
    });
    let rows = items;
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((a) => a.title.toLowerCase().includes(q));
    }
    rows = rows.slice(0, limit).map((a) => ({ title: a.title, description: a.description, url: a.url, published: a.pub }));
    if (!rows.length) return result(`No articles matched${query ? ` "${query}"` : ""}. All launch news: ${SITE}/news`, { articles: [] });
    return result(rows.map((a) => `${a.title}\n  ${a.description}\n  ${a.url}`).join("\n\n"), { articles: rows });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[cosmik-mcp] stdio server ready — tools: get_next_launches, get_iss_passes, get_launch_news");
