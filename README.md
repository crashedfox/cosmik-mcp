# Cosmik MCP Server

Live space data for AI agents — the MCP server behind [Cosmik](https://gocosmik.com),
the free real-time 3D satellite tracker.

**Endpoint (remote, streamable HTTP, no auth):**

```
https://gocosmik.com/api/mcp
```

Server card: [`/.well-known/mcp/server-card.json`](https://gocosmik.com/.well-known/mcp/server-card.json)

## Tools

| Tool | What it does |
|---|---|
| `get_next_launches` | Upcoming rocket launches worldwide — provider, pad, T-0, mission, webcast |
| `get_iss_passes` | Next visible ISS passes for a city (550+ known) or any lat/lon — live SGP4 propagation |
| `get_launch_news` | Latest launch news articles (7 languages) |

## Use it from Claude

```json
{
  "mcpServers": {
    "cosmik": {
      "type": "http",
      "url": "https://gocosmik.com/api/mcp"
    }
  }
}
```

Or in Claude Code: `claude mcp add --transport http cosmik https://gocosmik.com/api/mcp`

Ask things like *"When can I see the ISS from Paris tonight?"* or *"What's the next
SpaceX launch?"* — answers come from live orbital data, not training data.

## About

[Cosmik](https://gocosmik.com) tracks the ISS, Starlink and 20,000+ satellites in
real-time 3D in any browser — free, no login. This server exposes the same live
data (CelesTrak orbital elements, Launch Library 2) to AI agents. No API key, fair
use; data refreshes continuously.
