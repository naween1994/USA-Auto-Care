# USA Auto Care — Vehicle Service & Repair Workshop Management System

Complete full-stack MERN (MongoDB, Express, React + Vite, Node.js) application with Socket.IO real-time synchronization and TanStack Query server-state management for **USA Auto Care** in **Alawwa, Sri Lanka**.

- **Currency**: `LKR` (stored as integer minor units / cents to prevent floating-point drift)
- **Timezone**: `Asia/Colombo`
- **Architecture**: Separate `/client` (React + Vite + Tailwind CSS + TanStack Query + Socket.IO Client) and `/server` (Node.js + Express + Mongoose + Socket.IO + Zod + JWT HTTP-Only Cookie + CSRF)

## 1. Prerequisites & MongoDB Replica Set Setup

Multi-document ACID transactions are used when issuing or returning workshop parts, converting appointments into job cards, generating invoices, and recording payments or deposit allocations. MongoDB requires either **MongoDB Atlas** (which runs a replica set by default) or a **local single-node MongoDB replica set**.

To run a local single-node replica set (`rs0`):

```bash
mongod --dbpath /var/lib/mongodb --replSet rs0 --bind_ip 127.0.0.1
# In a second terminal, initialize the replica set once:
mongosh --eval "rs.initiate()"
```

## 2. Installation & Environment Configuration

1. Install root, backend, and frontend dependencies:
   ```bash
   npm run install:all
   ```
2. Copy the environment templates and set your secrets:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```
3. Generate secure random secrets for `JWT_SECRET` and `CSRF_SECRET` in `server/.env`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

## 3. Initial Admin Creation & Optional Development Seed

Public admin registration and hardcoded production credentials are prohibited. Create the initial Owner/Admin account via the secure CLI script:

```bash
npm run create-admin -- --name="Workshop Owner" --email="owner@usaautocare.lk" --password="YourStrongPassword123!"
```

For local development/testing only (blocked when `NODE_ENV=production`), you can populate sample Alawwa vehicles, suppliers, parts, and role accounts:

```bash
npm run seed:dev
```

## 4. Running in Development

In development, Vite runs on `http://localhost:5173` and proxies `/api`, `/uploads`, and `/socket.io` WebSocket traffic to Express on `http://localhost:5000`:

```bash
npm run dev
```

## 5. Production Build & Same-Origin Deployment

In production, build the React SPA into `client/dist` and start the Express server with `NODE_ENV=production` so Express serves both the static frontend and the API/Socket.IO server from the same origin:

```bash
npm run build
npm start
```

### Persistent Photo Upload Storage Requirement

Inspection and vehicle damage photos are validated (JPEG/PNG/WebP, max 5 MB) and stored on disk at `UPLOAD_DIR` (defaults to `server/uploads`), while photo metadata is saved in MongoDB on the `JobCard` document. In production (Docker, VPS, or cloud VMs), mount `UPLOAD_DIR` onto a persistent volume or attached block storage so uploaded vehicle photos survive container redeployments.

## 6. Automated Tests

Run the backend test suite covering role permissions, server-side LKR invoice calculations, partial payments, idempotency duplicate-payment prevention, concurrent stock consumption, and job-status transition validation:

```bash
npm test
```

## 7. Deploying to Google Cloud Platform (Cloud Run)

The repository includes a production multi-stage `Dockerfile`, `.dockerignore`, `cloudbuild.yaml`, and a one-command deployment script (`deploy-gcp.sh`) configured for **Google Cloud Run (`asia-east1`)** — the same region and architecture as `https://na-distributors-612049145024.asia-east1.run.app/`.

### Option A: One-Command Automated Deployment (`deploy-gcp.sh`)

1. Authenticate with Google Cloud CLI and set your project:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```
2. Export your MongoDB Atlas Replica Set connection string and run `./deploy-gcp.sh`:
   ```bash
   export MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/usa_auto_care?retryWrites=true&w=majority"
   ./deploy-gcp.sh
   ```
   This script automatically:
   - Enables Cloud Run, Cloud Build, Artifact Registry, and Cloud Storage APIs.
   - Creates a persistent GCS bucket and mounts it via Cloud Run Gen2 GCS FUSE at `/app/server/uploads` so vehicle inspection photos persist across container restarts.
   - Builds the multi-stage Docker image (compiling the React `/client` into `/app/client/dist` and serving it from Express on port `8080`).
   - Configures `--session-affinity` and `--timeout=3600` for uninterrupted Socket.IO real-time connections.

### Option B: Direct `gcloud run deploy` Command

```bash
gcloud run deploy usa-auto-care \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 8080 \
  --session-affinity \
  --timeout 3600 \
  --set-env-vars="NODE_ENV=production,MONGODB_URI=YOUR_ATLAS_URI,JWT_SECRET=YOUR_RANDOM_HEX,CSRF_SECRET=YOUR_RANDOM_HEX"
```
