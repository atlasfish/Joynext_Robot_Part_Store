FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM dependencies AS builder

WORKDIR /app
COPY . .

ARG NEXT_PUBLIC_BASE_PATH=/joynext
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NODE_ENV=production

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ARG NEXT_PUBLIC_BASE_PATH=/joynext
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/dist/standalone ./

EXPOSE 3000

CMD ["node", "server.js"]
