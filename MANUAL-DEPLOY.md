# Manual Deployment Instructions

The automated deployment script uploaded the backend files but timed out waiting for SSH passphrase input. Here's how to complete the deployment:

## What Was Successfully Deployed

✅ Frontend built locally
✅ Backend built locally  
✅ Backend files uploaded to EC2 at `/opt/safesecrets/backend`

## What Needs Manual Completion

### 1. SSH into EC2

```bash
ssh -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" ec2-user@99.79.9.109
```

### 2. Upload Frontend (if needed)

First, check if frontend was uploaded:
```bash
ls -la /var/www/safesecrets/
```

If the frontend directory is empty or outdated, upload it manually:

**From your local machine (PowerShell):**
```powershell
# Build frontend (if not already done)
cd frontend
npm run build
cd ..

# Upload to EC2
scp -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" -r frontend\dist\* ec2-user@99.79.9.109:/tmp/frontend-dist/
```

**Then on EC2:**
```bash
sudo cp -r /tmp/frontend-dist/* /var/www/safesecrets/
sudo rm -rf /tmp/frontend-dist
sudo chown -R nginx:nginx /var/www/safesecrets
```

### 3. Install Backend Dependencies & Restart

**On EC2:**
```bash
cd /opt/safesecrets/backend
sudo npm ci --production
pm2 restart safesecrets
pm2 logs safesecrets --lines 50
```

### 4. Verify Deployment

Check that the backend is running:
```bash
pm2 status
curl http://localhost:8080/health
```

Check Nginx is serving the frontend:
```bash
sudo systemctl status nginx
curl -I http://localhost/
```

### 5. Test the Live Site

Visit: https://safesecrets.ca

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              EC2 Instance                    │
│  99.79.9.109 (ca-central-1)                 │
├─────────────────────────────────────────────┤
│                                              │
│  Nginx (Port 80/443)                        │
│  ├─ Serves: /var/www/safesecrets/          │
│  │  (Static frontend files)                 │
│  └─ Proxies: /ws → localhost:8080/ws       │
│                                              │
│  Backend (Port 8080)                        │
│  ├─ Location: /opt/safesecrets/backend/    │
│  ├─ Process Manager: PM2                    │
│  └─ Service: safesecrets                    │
│                                              │
└─────────────────────────────────────────────┘
```

## Troubleshooting

### Backend not starting
```bash
pm2 logs safesecrets --lines 100
# Check for missing environment variables or AWS credentials
cat /opt/safesecrets/backend/.env
```

### Frontend not loading
```bash
sudo nginx -t
sudo systemctl restart nginx
ls -la /var/www/safesecrets/
```

### WebSocket connection failing
```bash
# Check if backend is listening on port 8080
sudo netstat -tlnp | grep 8080
# Check Nginx WebSocket proxy config
sudo cat /etc/nginx/conf.d/safesecrets.conf
```

## Quick Redeploy Script

For future deployments, you can use this simpler approach:

```bash
# On local machine - build
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..

# Upload backend
scp -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" -r backend/dist/* ec2-user@99.79.9.109:/tmp/backend-dist/
scp -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" backend/package*.json ec2-user@99.79.9.109:/tmp/

# Upload frontend
scp -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" -r frontend/dist/* ec2-user@99.79.9.109:/tmp/frontend-dist/

# SSH and deploy
ssh -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" ec2-user@99.79.9.109 << 'EOF'
sudo cp -r /tmp/backend-dist/* /opt/safesecrets/backend/
sudo cp /tmp/package*.json /opt/safesecrets/backend/
sudo cp -r /tmp/frontend-dist/* /var/www/safesecrets/
sudo rm -rf /tmp/backend-dist /tmp/frontend-dist /tmp/package*.json
cd /opt/safesecrets/backend
sudo npm ci --production
pm2 restart safesecrets
pm2 logs safesecrets --lines 20
EOF
```
