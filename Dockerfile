# Stdio entry point for the Cosmik MCP server.
#
# Cosmik is a hosted, keyless remote server (streamable HTTP at
# https://gocosmik.com/api/mcp). This image exists so registries that boot
# servers locally for evaluation (e.g. Glama) can start it and run
# introspection: mcp-remote bridges stdio <-> the remote endpoint.
FROM node:22-alpine
# Pre-install so container start is instant and offline-safe apart from the endpoint itself
RUN npm install -g mcp-remote@latest
CMD ["mcp-remote", "https://gocosmik.com/api/mcp"]
