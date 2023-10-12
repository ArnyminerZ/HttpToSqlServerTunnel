FROM oven/bun:alpine

COPY package.json ./
COPY bun.lockb ./
COPY src ./

RUN bun install

ENTRYPOINT bun run src/index.ts
