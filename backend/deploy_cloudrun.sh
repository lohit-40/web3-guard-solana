#!/bin/bash

echo "Deploying Web3 Guard Backend to Google Cloud Run..."

# Set your project ID here if needed, or rely on gcloud config
# PROJECT_ID="your-gcp-project-id"

gcloud run deploy web3guard-backend \
  --source . \
  --allow-unauthenticated \
  --timeout=300 \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY,DATABASE_URL=$DATABASE_URL,WEB3_RPC_URL=$WEB3_RPC_URL,WALLET_PRIVATE_KEY=$WALLET_PRIVATE_KEY,ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY" \
  --region=us-central1

echo "Deployment complete! Make sure your timeout is now 300 seconds (5 minutes) to allow the ReAct agent to finish thinking."
