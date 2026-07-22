# Zero-dependency Node server — tiny, fast, predictable image.
# No npm install needed (server.js uses only Node built-ins), so the build is
# just: pull node:22-alpine, copy the files, run. Seconds, not minutes.
FROM node:22-alpine

WORKDIR /app

# App sources (static assets + server.js + package.json). No dependencies.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
