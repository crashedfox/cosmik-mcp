# Cosmik MCP server — builds and runs the stdio server locally.
# Tools fetch Cosmik's public keyless endpoints; no env vars required.
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
RUN npm install --omit=dev
CMD ["node", "server.js"]
