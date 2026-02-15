# SafeSecrets Deployment Guide

## Prerequisites

- AWS Account with EC2, Bedrock, Transcribe, and Polly access
- Domain name configured in Route 53
- SSH key pair for EC2 access
- Smallest.ai API key

## Quick Deployment

### 1. Prepare Environment

Copy example files and fill in your values:

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env.production
```

### 2. Build Application

```bash
# Build frontend
cd frontend
npm install
npm run build

# Build backend
cd ../backend
npm install
npm run build

# Build shared types
cd ../shared
npm install
npm run build
```

### 3. Deploy to EC2

#### Initial Setup

```bash
# SSH to your EC2 instance
ssh -i your-key.pem ec2-user@your-ip

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Nginx
sudo yum install -y nginx

# Install PM2
sudo npm install -g pm2

# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Create directories
sudo mkdir -p /opt/safesecrets/backend /var/www/safesecrets
sudo chown -R ec2-user:ec2-user /opt/safesecrets
sudo chown -R nginx:nginx /var/www/safesecrets
```

#### Upload Files

```bash
# Upload frontend
scp -i your-key.pem -r frontend/dist/* ec2-user@your-ip:/tmp/frontend/
ssh -i your-key.pem ec2-user@your-ip "sudo cp -r /tmp/frontend/* /var/www/safesecrets/"

# Upload backend
scp -i your-key.pem -r backend/dist/* ec2-user@your-ip:/tmp/backend/
scp -i your-key.pem backend/package*.json ec2-user@your-ip:/tmp/
ssh -i your-key.pem ec2-user@your-ip "sudo cp -r /tmp/backend/* /opt/safesecrets/backend/ && sudo cp /tmp/package*.json /opt/safesecrets/backend/"

# Upload shared types
scp -i your-key.pem -r shared ec2-user@your-ip:/tmp/
ssh -i your-key.pem ec2-user@your-ip "sudo mv /tmp/shared /opt/safesecrets/ && sudo ln -s /opt/safesecrets/shared /opt/shared"

# Upload environment file
scp -i your-key.pem backend/.env.production ec2-user@your-ip:/tmp/.env
ssh -i your-key.pem ec2-user@your-ip "sudo mv /tmp/.env /opt/safesecrets/backend/.env"
```

#### Configure Nginx

```bash
# Upload Nginx config
scp -i your-key.pem nginx-safesecrets-http-only.conf ec2-user@your-ip:/tmp/
ssh -i your-key.pem ec2-user@your-ip "sudo cp /tmp/nginx-safesecrets-http-only.conf /etc/nginx/conf.d/safesecrets.conf"

# Start Nginx
ssh -i your-key.pem ec2-user@your-ip "sudo systemctl start nginx && sudo systemctl enable nginx"

# Get SSL certificate
ssh -i your-key.pem ec2-user@your-ip
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
exit
```

#### Start Backend

```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@your-ip

# Install dependencies
cd /opt/safesecrets/backend
npm ci --production

# Start with PM2
pm2 start index.js --name safesecrets
pm2 save

# Enable auto-start
pm2 startup
# Run the sudo command it outputs

# Verify
pm2 list
pm2 logs safesecrets
curl http://localhost:8080/health
```

### 4. Verify Deployment

Visit your domain and test:
- Frontend loads
- WebSocket connects
- Voice pipeline works

## Environment Variables

### Backend (.env.production)

```bash
PORT=8080
AWS_REGION=ca-central-1
NODE_ENV=production
SMALLEST_AI_API_KEY=your_api_key_here
```

### Frontend (.env.production)

```bash
VITE_WS_URL=wss://yourdomain.com/ws
```

## Management

### PM2 Commands

```bash
pm2 list                    # View status
pm2 logs safesecrets        # View logs
pm2 restart safesecrets     # Restart
pm2 stop safesecrets        # Stop
pm2 monit                   # Monitor
```

### Nginx Commands

```bash
sudo systemctl status nginx     # Check status
sudo systemctl restart nginx    # Restart
sudo nginx -t                   # Test config
```

### Updates

To deploy updates:

1. Build locally
2. Upload new files
3. Restart services:
   ```bash
   pm2 restart safesecrets
   ```

## Troubleshooting

### Backend Not Starting

```bash
pm2 logs safesecrets
pm2 restart safesecrets
```

### WebSocket Connection Failed

```bash
# Check backend
curl http://localhost:8080/health

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
```

### SSL Certificate Issues

```bash
sudo certbot certificates
sudo certbot renew
```

## Security Checklist

- [ ] SSH key secured
- [ ] Environment variables not in source control
- [ ] SSL certificate installed
- [ ] Security groups configured
- [ ] IAM roles properly scoped
- [ ] API keys secured

## Architecture

```
Browser → Nginx (SSL) → Backend (WebSocket) → AWS Services
                ↓
         Static Files
```

## Support

For detailed information, see:
- `DEPLOYMENT-COMPLETE.md` - Full deployment details
- `DEPLOYMENT-CHECKLIST.md` - Step-by-step checklist
- `nginx-safesecrets.conf` - Nginx configuration
