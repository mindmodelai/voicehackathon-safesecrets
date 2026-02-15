# SafeSecrets Deployment Guide

## Prerequisites

- SSH access to EC2 instance (184.73.253.209)
- SSH key file (safesecrets-key.pem)
- Domain nameservers updated to AWS Route 53

## One-Time EC2 Setup

1. **Copy setup script to EC2:**
   ```bash
   scp -i ~/.ssh/safesecrets-key.pem ec2-setup.sh ec2-user@184.73.253.209:~
   ```

2. **Run setup script on EC2:**
   ```bash
   ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
   chmod +x ec2-setup.sh
   ./ec2-setup.sh
   ```

3. **Copy Nginx configuration:**
   ```bash
   # On your local machine
   scp -i ~/.ssh/safesecrets-key.pem nginx-safesecrets.conf ec2-user@184.73.253.209:~
   
   # On EC2
   sudo cp nginx-safesecrets.conf /etc/nginx/conf.d/safesecrets.conf
   sudo nginx -t
   ```

4. **Get SSL certificate:**
   ```bash
   # On EC2
   sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca
   ```

5. **Configure environment variables:**
   ```bash
   # On EC2
   sudo nano /opt/safesecrets/backend/.env
   # Add AWS credentials or ensure IAM role is attached
   ```

## Deploying Updates

After the one-time setup, deploy updates using:

```bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy (uses SSH_KEY_PATH env var or default location)
./deploy.sh

# Or specify SSH key location
SSH_KEY_PATH=/path/to/key.pem ./deploy.sh
```

The deploy script will:
1. Build frontend (React → static files)
2. Build backend (TypeScript → JavaScript)
3. Upload to EC2
4. Install dependencies
5. Restart backend service

## Manual Deployment Steps

If the automated script doesn't work, here's the manual process:

### 1. Build locally

```bash
# Build frontend
cd frontend
npm run build
cd ..

# Build backend
cd backend
npm run build
cd ..
```

### 2. Upload to EC2

```bash
# Upload frontend
scp -i ~/.ssh/safesecrets-key.pem -r frontend/dist/* ec2-user@184.73.253.209:/tmp/frontend-dist/
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209 "sudo cp -r /tmp/frontend-dist/* /var/www/safesecrets/"

# Upload backend
scp -i ~/.ssh/safesecrets-key.pem -r backend/dist/* ec2-user@184.73.253.209:/tmp/backend-dist/
scp -i ~/.ssh/safesecrets-key.pem backend/package*.json ec2-user@184.73.253.209:/tmp/
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209 "sudo cp -r /tmp/backend-dist/* /opt/safesecrets/backend/ && sudo cp /tmp/package*.json /opt/safesecrets/backend/"
```

### 3. Install dependencies and restart

```bash
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209

# Install dependencies
cd /opt/safesecrets/backend
sudo npm ci --production

# Start/restart with PM2
pm2 start ecosystem.config.js
# or
pm2 restart safesecrets

# Save PM2 configuration
pm2 save
```

## Verification

1. **Check backend health:**
   ```bash
   curl http://184.73.253.209:8080/health
   ```

2. **Check Nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

3. **Check PM2:**
   ```bash
   pm2 status
   pm2 logs safesecrets
   ```

4. **Visit site:**
   - http://safesecrets.ca (should redirect to HTTPS)
   - https://safesecrets.ca

## Troubleshooting

### Backend not starting
```bash
pm2 logs safesecrets --lines 100
```

### Nginx errors
```bash
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### WebSocket connection issues
- Check firewall: `sudo firewall-cmd --list-all`
- Check security group: Port 443 must be open
- Check Nginx WebSocket proxy configuration

## Architecture

```
Internet
    ↓
Route 53 (safesecrets.ca)
    ↓
EC2 Instance (184.73.253.209)
    ↓
Nginx (:443)
    ├── Static files → /var/www/safesecrets/
    └── /ws → Node.js (:8080)
            ↓
        Mastra + WebSocket Server
            ├── Transcribe (ca-central-1 or us-east-1)
            ├── Bedrock (ca-central-1 or us-east-1)
            └── Polly/Smallest.ai
```

## Files Created

- `deploy.sh` - Automated deployment script
- `ec2-setup.sh` - One-time EC2 setup script
- `nginx-safesecrets.conf` - Nginx configuration
- `DEPLOYMENT.md` - This file

## Security Notes

- Never commit SSH keys to git
- Use IAM roles instead of hardcoded AWS credentials when possible
- Keep SSL certificates up to date (Certbot auto-renews)
- Regularly update system packages: `sudo yum update -y`
