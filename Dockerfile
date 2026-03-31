# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the app (GEMINI_API_KEY must be provided as a build arg or env var here)
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --only=production

# Copy build artifacts and server script
COPY --from=build /app/dist ./dist
COPY server.js ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1


EXPOSE 3000

CMD ["node", "server.js"]
