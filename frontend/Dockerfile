# Build from the repository root: docker build -f frontend/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY mobile/package.json ./mobile/package.json
RUN npm ci --workspace frontend --include-workspace-root=false --ignore-scripts
COPY frontend ./frontend
ARG BACKEND_URL=http://backend:4000
ARG NEXT_PUBLIC_COACH_API_URL
ENV BACKEND_URL=$BACKEND_URL NEXT_PUBLIC_COACH_API_URL=$NEXT_PUBLIC_COACH_API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace frontend

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "frontend/server.js"]
