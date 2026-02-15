#!/bin/bash

# SafeSecrets Deployment Script
# Deploys frontend and backend to EC2 instance

set -e

EC2_HOST="99.79.9.109"
EC2_USER="ec2-user"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/safesecrets-key.pem}"
BACKEND_DIR="/opt/safesecrets/backend"
FRONTEND_DIR="/var/www/safesecrets"

echo "🚀 SafeSecrets Deployment Starting..."
echo "Target: $EC2_USER@$EC2_HOST"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found at: $SSH_KEY"
    echo "Set SSH_KEY_PATH environment variable or place key at default location"
    exit 1
fi

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

# Build backend
echo "📦 Building backend..."
cd backend
npm run build
cd ..

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p deploy-temp
cp -r frontend/dist deploy-temp/frontend-dist
cp -r backend/dist deploy-temp/backend-dist
cp backend/package.json deploy-temp/
cp backend/package-lock.json deploy-temp/

# Upload to EC2
echo "📤 Uploading to EC2..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "sudo mkdir -p $BACKEND_DIR $FRONTEND_DIR"

# Upload frontend
echo "📤 Uploading frontend..."
scp -i "$SSH_KEY" -r deploy-temp/frontend-dist/* "$EC2_USER@$EC2_HOST:/tmp/frontend-dist/"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "sudo cp -r /tmp/frontend-dist/* $FRONTEND_DIR/ && sudo rm -rf /tmp/frontend-dist"

# Upload backend
echo "📤 Uploading backend..."
scp -i "$SSH_KEY" -r deploy-temp/backend-dist/* "$EC2_USER@$EC2_HOST:/tmp/backend-dist/"
scp -i "$SSH_KEY" deploy-temp/package*.json "$EC2_USER@$EC2_HOST:/tmp/"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "sudo cp -r /tmp/backend-dist/* $BACKEND_DIR/ && sudo cp /tmp/package*.json $BACKEND_DIR/ && sudo rm -rf /tmp/backend-dist /tmp/package*.json"

# Install dependencies on EC2
echo "📦 Installing dependencies on EC2..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "cd $BACKEND_DIR && sudo npm ci --production"

# Restart backend service
echo "🔄 Restarting backend service..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "sudo systemctl restart safesecrets || sudo pm2 restart safesecrets || echo 'Service not configured yet'"

# Cleanup
rm -rf deploy-temp

echo "✅ Deployment complete!"
echo "🌐 Visit: https://safesecrets.ca"
