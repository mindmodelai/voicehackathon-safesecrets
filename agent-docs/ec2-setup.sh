#!/bin/bash

# EC2 Initial Setup Script for SafeSecrets
# Run this once on the EC2 instance to set up the environment

set -e

echo "🔧 Setting up SafeSecrets on EC2..."

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Nginx
echo "📦 Installing Nginx..."
sudo yum install -y nginx

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create directories
echo "📁 Creating application directories..."
sudo mkdir -p /opt/safesecrets/backend
sudo mkdir -p /var/www/safesecrets
sudo chown -R ec2-user:ec2-user /opt/safesecrets
sudo chown -R nginx:nginx /var/www/safesecrets

# Create .env file for backend
echo "📝 Creating environment file..."
sudo tee /opt/safesecrets/backend/.env > /dev/null <<EOF
AWS_REGION=ca-central-1
PORT=8080
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# Add your AWS credentials here or use IAM role
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=

# Optional: Smallest.ai API key for Full US mode
# SMALLEST_AI_API_KEY=
EOF

# Create PM2 ecosystem file
echo "📝 Creating PM2 configuration..."
sudo tee /opt/safesecrets/backend/ecosystem.config.js > /dev/null <<'EOF'
module.exports = {
  apps: [{
    name: 'safesecrets',
    script: './dist/index.js',
    cwd: '/opt/safesecrets/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/safesecrets-error.log',
    out_file: '/var/log/safesecrets-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Install Certbot for Let's Encrypt
echo "📦 Installing Certbot..."
sudo yum install -y certbot python3-certbot-nginx

# Start and enable Nginx
echo "🚀 Starting Nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Configure firewall (if firewalld is running)
if sudo systemctl is-active --quiet firewalld; then
    echo "🔥 Configuring firewall..."
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
fi

echo "✅ EC2 setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy Nginx config: sudo cp nginx-safesecrets.conf /etc/nginx/conf.d/safesecrets.conf"
echo "2. Test Nginx config: sudo nginx -t"
echo "3. Get SSL certificate: sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca"
echo "4. Deploy application: ./deploy.sh"
echo "5. Start backend: cd /opt/safesecrets/backend && pm2 start ecosystem.config.js"
echo "6. Save PM2 startup: pm2 save && sudo pm2 startup"
