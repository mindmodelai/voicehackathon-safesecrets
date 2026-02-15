# Setup SafeSecrets NOW - Step by Step

## Current Status
- ❌ Nginx not installed/running on EC2
- ❌ No web server responding on ports 80/443
- ✅ SSH access working (port 22)
- ✅ Security group configured correctly

## Quick Setup (5 minutes)

### Step 1: Run automated setup script

```bash
chmod +x setup-ec2-remote.sh
./setup-ec2-remote.sh
```

This will:
- Install Node.js 20
- Install Nginx
- Install PM2
- Create application directories
- Configure Nginx (HTTP only for now)
- Start Nginx

### Step 2: Verify Nginx is running

```bash
curl -I http://99.79.9.109
# Should return: HTTP/1.1 200 OK or 404 (not connection refused)
```

### Step 3: Get SSL certificate

```bash
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@99.79.9.109
sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca
exit
```

Certbot will:
- Verify domain ownership
- Install SSL certificate
- Update Nginx config automatically
- Set up auto-renewal

### Step 4: Deploy application

```bash
./deploy.sh
```

### Step 5: Start backend

```bash
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@99.79.9.109
cd /opt/safesecrets/backend
pm2 start ecosystem.config.js
pm2 save
sudo pm2 startup
exit
```

### Step 6: Test

Visit: https://safesecrets.ca

## Manual Setup (if script fails)

### 1. SSH to EC2

```bash
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@99.79.9.109
```

### 2. Install packages

```bash
# Update system
sudo yum update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Nginx
sudo amazon-linux-extras install nginx1 -y

# Install PM2
sudo npm install -g pm2

# Install Certbot
sudo yum install -y certbot python3-certbot-nginx
```

### 3. Create directories

```bash
sudo mkdir -p /opt/safesecrets/backend
sudo mkdir -p /var/www/safesecrets
sudo chown -R ec2-user:ec2-user /opt/safesecrets
sudo chown -R nginx:nginx /var/www/safesecrets
```

### 4. Copy Nginx config (from local machine)

```bash
scp -i ~/.ssh/safesecrets-key.pem nginx-safesecrets-http-only.conf ec2-user@99.79.9.109:/tmp/
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@99.79.9.109
sudo cp /tmp/nginx-safesecrets-http-only.conf /etc/nginx/conf.d/safesecrets.conf
sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx
exit
```

### 5. Get SSL certificate

```bash
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@99.79.9.109
sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca
exit
```

### 6. Deploy and start

```bash
./deploy.sh
ssh -i ~/.ssh/safesecrets-key.pem ec2-user@99.79.9.109
cd /opt/safesecrets/backend
pm2 start ecosystem.config.js
pm2 save
sudo pm2 startup
```

## Troubleshooting

### "Connection refused" on port 80/443
- Nginx not installed or not running
- Run: `sudo systemctl status nginx`
- Start: `sudo systemctl start nginx`

### Nginx won't start
- Check config: `sudo nginx -t`
- Check logs: `sudo tail -f /var/log/nginx/error.log`

### Certbot fails
- DNS must be pointing to 99.79.9.109 first
- Check: `nslookup safesecrets.ca`
- Wait for DNS propagation if needed

### Backend won't start
- Check logs: `pm2 logs safesecrets`
- Check env: `cat /opt/safesecrets/backend/.env`
- Ensure IAM role is attached to EC2

## Current EC2 Details

- **Instance ID**: i-027ef930f941236c7
- **Region**: ca-central-1
- **Public IP**: 99.79.9.109
- **Domain**: safesecrets.ca
- **SSH**: `ssh -i ~/.ssh/safesecrets-key.pem ec2-user@99.79.9.109`
