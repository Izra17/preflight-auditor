# PreFlight — persistent container image.
#
# Deliberately NOT a serverless function target. Playwright/Chromium needs
# a long-lived process with its browser binaries and system deps already
# present; cold-starting Chromium inside a sleeping serverless function is
# exactly the failure mode this project's deployment requirements call out.
#
# Base image ships Chromium + all required OS-level dependencies
# preinstalled, so there is no "npx playwright install" cold-start cost
# at runtime — only once, at build time.
FROM mcr.microsoft.com/playwright:v1.46.0-jammy AS base

WORKDIR /app
ENV NODE_ENV=production
ENV PREFLIGHT_STORE=file

COPY package*.json ./
RUN npm install --omit=dev=false

COPY . .
RUN npm run build

# Health check hits the real /api/health endpoint, which itself verifies
# Chromium can actually launch — not just that the process is alive.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3000
CMD ["npm", "start"]
