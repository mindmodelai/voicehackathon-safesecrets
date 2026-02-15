# SafeSecrets EC2 Deployment Script for Windows (EXAMPLE/TEMPLATE)
# 
# This is a template deployment script. To use it:
# 1. Copy this file to deploy-to-ec2.ps1 (which is gitignored)
# 2. Update .env.local with your EC2 details
# 3. Run: .\deploy-to-ec2.ps1
#
# Deploys the latest build to EC2

$ErrorActionPreference = "Stop"

# Load environment variables
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$EC2_HOST = $env:EC2_PUBLIC_IP
$EC2_USER = $env:EC2_USER
$SSH_KEY = $env:SSH_KEY_PATH
$BACKEND_DIR = "/opt/safesecrets/backend"
$FRONTEND_DIR = "/var/www/safesecrets"

Write-Host "SafeSecrets Deployment Starting..." -ForegroundColor Green
Write-Host "Target: $EC2_USER@$EC2_HOST" -ForegroundColor Cyan

# Check if variables are set
if (-not $EC2_HOST -or $EC2_HOST -eq "your_ec2_ip") {
    Write-Host "EC2_PUBLIC_IP not set in .env.local" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $SSH_KEY)) {
    Write-Host "SSH key not found at: $SSH_KEY" -ForegroundColor Red
    exit 1
}

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed" -ForegroundColor Red
    exit 1
}
Set-Location ..

# Build backend
Write-Host "Building backend..." -ForegroundColor Yellow
Set-Location backend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend build failed" -ForegroundColor Red
    exit 1
}
Set-Location ..

# Create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow
if (Test-Path "deploy-temp") {
    Remove-Item -Recurse -Force "deploy-temp"
}
New-Item -ItemType Directory -Path "deploy-temp" | Out-Null
New-Item -ItemType Directory -Path "deploy-temp\frontend-dist" | Out-Null
New-Item -ItemType Directory -Path "deploy-temp\backend-dist" | Out-Null
Copy-Item -Recurse "frontend\dist\*" "deploy-temp\frontend-dist\"
Copy-Item -Recurse "backend\dist\*" "deploy-temp\backend-dist\"
Copy-Item "backend\package.json" "deploy-temp\"
Copy-Item "backend\package-lock.json" "deploy-temp\"

# Upload to EC2
Write-Host "Uploading to EC2..." -ForegroundColor Yellow

# Upload frontend
Write-Host "Uploading frontend..." -ForegroundColor Cyan
scp -i "$SSH_KEY" -r "deploy-temp\frontend-dist\*" "${EC2_USER}@${EC2_HOST}:/tmp/frontend-dist/"
ssh -i "$SSH_KEY" "${EC2_USER}@${EC2_HOST}" "sudo cp -r /tmp/frontend-dist/* $FRONTEND_DIR/; sudo rm -rf /tmp/frontend-dist"

# Upload backend
Write-Host "Uploading backend..." -ForegroundColor Cyan
scp -i "$SSH_KEY" -r "deploy-temp\backend-dist\*" "${EC2_USER}@${EC2_HOST}:/tmp/backend-dist/"
scp -i "$SSH_KEY" "deploy-temp\package*.json" "${EC2_USER}@${EC2_HOST}:/tmp/"
ssh -i "$SSH_KEY" "${EC2_USER}@${EC2_HOST}" "sudo cp -r /tmp/backend-dist/* $BACKEND_DIR/; sudo cp /tmp/package*.json $BACKEND_DIR/; sudo rm -rf /tmp/backend-dist /tmp/package*.json"

# Install dependencies on EC2
Write-Host "Installing dependencies on EC2..." -ForegroundColor Yellow
ssh -i "$SSH_KEY" "${EC2_USER}@${EC2_HOST}" "cd $BACKEND_DIR; sudo npm ci --production"

# Restart backend service
Write-Host "Restarting backend service..." -ForegroundColor Yellow
ssh -i "$SSH_KEY" "${EC2_USER}@${EC2_HOST}" "pm2 restart safesecrets"

# Cleanup
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "deploy-temp"

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Visit: https://safesecrets.ca" -ForegroundColor Cyan
