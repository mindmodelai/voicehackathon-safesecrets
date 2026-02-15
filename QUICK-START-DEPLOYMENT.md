# Quick Start: Deploy SafeSecrets to Production

## TL;DR

```bash
# 1. Check if ready
./check-deployment-ready.sh

# 2. If first time, copy and run setup on EC2
scp -i ~/.ssh/safesecrets-key.pem ec2-setup.sh nginx-safesecrets.conf ec2-user@184.73.253.209:~
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
chmod +x ec2-setup.sh && ./ec2-setup.sh
sudo cp nginx-safesecrets.conf /etc/nginx/conf.d/safesecrets.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca
exit

# 3. Deploy
./deploy.sh

# 4. Start backend (first time only)
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
cd /opt/safesecrets/backend
pm2 start ecosystem.config.js
pm2 save
sudo pm2 startup
exit

# 5. Visit
open https://safesecrets.ca
```

## What Each Script Does

### `check-deployment-ready.sh`
Verifies:
- SSH key exists and works
- EC2 is accessible
- DNS is configured
- Node.js and Nginx are installed
- Application directories exist
- SSL certificate status

### `ec2-setup.sh`
One-time setup on EC2:
- Installs Node.js 20
- Installs Nginx
- Installs PM2
- Creates application directories
- Installs Certbot for SSL
- Configures firewall

### `deploy.sh`
Automated deployment:
- Builds frontend (React → static files)
- Builds backend (TypeScript → JavaScript)
- Uploads to EC2
- Installs dependencies
- Restarts backend service

## Files Created

- `deploy.sh` - Main deployment script
- `ec2-setup.sh` - One-time EC2 setup
- `nginx-safesecrets.conf` - Nginx configuration
- `check-deployment-ready.sh` - Pre-deployment checks
- `frontend/.env.production` - Production WebSocket URL
- `DEPLOYMENT.md` - Detailed deployment guide
- `DEPLOYMENT-CHECKLIST.md` - Step-by-step checklist
- `QUICK-START-DEPLOYMENT.md` - This file

## Current Status

✅ EC2 instance running (184.73.253.209)
✅ Route 53 configured (safesecrets.ca)
✅ IAM role attached (SafeSecretsEC2Role)
✅ Security group configured
✅ Deployment scripts ready

⏳ Pending:
- One-time EC2 setup
- SSL certificate installation
- First deployment

## Need Help?

See `DEPLOYMENT.md` for detailed instructions and troubleshooting.
