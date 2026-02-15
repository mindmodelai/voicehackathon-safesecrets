#!/bin/bash

# Remote EC2 Setup Script - Run this from your local machine
# This will SSH into the EC2 instance and set everything up

set -e

EC2_HOST="99.79.9.109"
EC2_USER="ec2-user"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/safesecrets-key.pem}"

echo "🚀 Setting up SafeSecrets on EC2 (${EC2_HOST})..."

# Check SSH key
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found at: $SSH_KEY"
    exit 1
fi

# Run setup commands directly via SSH
echo "📦 Installing system packages..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << 'ENDSSH'
set -e

# Update system
echo "Updating system packages..."
sudo yum update -y

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Nginx
echo "Installing Nginx..."
sudo amazon-linux-extras install nginx1 -y || sudo yum install -y nginx

# Install PM2
echo "Installing PM2..."
sudo npm install -g pm2

# Create directories
echo "Creating application directories..."
sudo mkdir -p /opt/safesecrets/backend
sudo mkdir -p /var/www/safesecrets
sudo chown -R ec2-user:ec2-user /opt/safesecrets
sudo chown -R nginx:nginx /var/www/safesecrets

# Create .env file
echo "Creating environment file..."
sudo tee /opt/safesecrets/backend/.env > /dev/null <<EOF
AWS_REGION=ca-central-1
PORT=8080
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
NODE_ENV=production
EOF

# Create PM2 ecosystem file
echo "Creating PM2 configuration..."
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

# Install Certbot
echo "Installing Certbot..."
sudo yum install -y certbot python3-certbot-nginx

# Start Nginx
echo "Starting Nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

echo "✅ EC2 setup complete!"
ENDSSH

# Copy Nginx config
echo "📝 Copying Nginx configuration..."
scp -i "$SSH_KEY" nginx-safesecrets.conf "$EC2_USER@$EC2_HOST:/tmp/"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "sudo cp /tmp/nginx-safesecrets.conf /etc/nginx/conf.d/safesecrets.conf && sudo rm /tmp/nginx-safesecrets.conf"

# Test and reload Nginx
echo "🔄 Testing and reloading Nginx..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "sudo nginx -t && sudo systemctl reload nginx"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Get SSL certificate:"
echo "   ssh -i $SSH_KEY $EC2_USER@$EC2_HOST"
echo "   sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca"
echo ""
echo "2. Deploy application:"
echo "   ./deploy.sh"
echo ""
echo "3. Start backend:"
echo "   ssh -i $SSH_KEY $EC2_USER@$EC2_HOST"
echo "   cd /opt/safesecrets/backend && pm2 start ecosystem.config.js && pm2 save"
