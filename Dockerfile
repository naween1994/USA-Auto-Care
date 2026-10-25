# ==============================================================================
# Stage 1: Build React + Vite Frontend (/client)
# ==============================================================================
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Node.js + Express + Socket.IO Server (/server)
# ==============================================================================
FROM node:20-alpine AS production
WORKDIR /app

# Set production environment & Cloud Run default port (8080)
ENV NODE_ENV=production
ENV PORT=8080

# Install backend production dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy backend source & scripts
COPY server/ ./

# Copy built React SPA into /app/client/dist (served by Express same-origin)
COPY --from=client-builder /app/client/dist /app/client/dist

# Ensure persistent upload directory exists
RUN mkdir -p /app/server/uploads && chown -R node:node /app

USER node
EXPOSE 8080

CMD ["node", "src/index.js"]
