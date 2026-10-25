#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# USA Auto Care (Alawwa, Sri Lanka) — Google Cloud Run Deployment Script
# Deploys the full-stack MERN + Socket.IO app to Cloud Run (asia-east1)
# ==============================================================================

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="${SERVICE_NAME:-usa-auto-care}"
UPLOAD_BUCKET="${UPLOAD_BUCKET:-${PROJECT_ID}-usa-auto-care-uploads}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: GCP_PROJECT_ID is not set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "Error: Please export MONGODB_URI (your MongoDB Atlas connection string) before running."
  echo "Example: export MONGODB_URI='mongodb+srv://user:pass@cluster.mongodb.net/usa_auto_care?retryWrites=true&w=majority'"
  exit 1
fi

JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 48)}"
CSRF_SECRET="${CSRF_SECRET:-$(openssl rand -hex 32)}"

echo "==> 1. Enabling required Google Cloud APIs on project: $PROJECT_ID..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID"

echo "==> 2. Ensuring Cloud Storage bucket ($UPLOAD_BUCKET) exists for persistent vehicle photos..."
if ! gcloud storage buckets describe "gs://${UPLOAD_BUCKET}" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${UPLOAD_BUCKET}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access
fi

echo "==> 3. Building & Deploying $SERVICE_NAME to Cloud Run ($REGION)..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --session-affinity \
  --timeout 3600 \
  --min-instances 0 \
  --max-instances 1 \
  --execution-environment gen2 \
  --add-volume="name=uploads-vol,type=cloud-storage,bucket=${UPLOAD_BUCKET}" \
  --add-volume-mount="volume=uploads-vol,mount-path=/app/server/uploads" \
  --set-env-vars="NODE_ENV=production,MONGODB_URI=${MONGODB_URI},JWT_SECRET=${JWT_SECRET},CSRF_SECRET=${CSRF_SECRET},UPLOAD_DIR=/app/server/uploads,BUSINESS_NAME=USA Auto Care,BUSINESS_LOCATION=Alawwa Sri Lanka,BUSINESS_CURRENCY=LKR,BUSINESS_TIMEZONE=Asia/Colombo,BUSINESS_PHONE=0773995399 / 0703995399,BUSINESS_EMAIL=usaautocare66@gmail.com"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
echo "=============================================================================="
echo "SUCCESS! USA Auto Care is live on Google Cloud Run:"
echo "  URL: $SERVICE_URL"
echo "=============================================================================="
echo "Updating CLIENT_ORIGIN to match Cloud Run URL..."
gcloud run services update "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --update-env-vars="CLIENT_ORIGIN=${SERVICE_URL}"

echo "Done! To create your initial Owner/Admin account against MongoDB Atlas, run:"
echo "  MONGODB_URI="\$MONGODB_URI" npm run create-admin -- --name="Workshop Owner" --email="usaautocare66@gmail.com" --password="YourStrongPassword123!""
