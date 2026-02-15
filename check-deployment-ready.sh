#!/bin/bash

# Check if deployment prerequisites are met

echo "🔍 Checking SafeSecrets deployment readiness..."
echo ""

EC2_HOST="99.79.9.109"
DOMAIN="safesecrets.ca"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/safesecrets-key.pem}"

# Check SSH key
echo "1. Checking SSH key..."
if [ -f "$SSH_KEY" ]; then
    echo "   ✅ SSH key found at: $SSH_KEY"
else
    echo "   ❌ SSH key not found at: $SSH_KEY"
    echo "   Set SSH_KEY_PATH environment variable or place key at default location"
    exit 1
fi

# Check SSH connectivity
echo ""
echo "2. Checking SSH connectivity..."
if ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no ec2-user@$EC2_HOST "echo 'SSH OK'" 2>/dev/null | grep -q "SSH OK"; then
    echo "   ✅ SSH connection successful"
else
    echo "   ❌ Cannot connect to EC2 instance"
    echo "   Check security group and SSH key permissions"
    exit 1
fi

# Check DNS resolution
echo ""
echo "3. Checking DNS resolution..."
DNS_IP=$(nslookup $DOMAIN 2>/dev/null | grep -A1 "Name:" | grep "Address:" | awk '{print $2}' | head -1)
if [ "$DNS_IP" == "$EC2_HOST" ]; then
    echo "   ✅ DNS resolves correctly: $DOMAIN → $EC2_HOST"
else
    echo "   ⚠️  DNS resolution: $DOMAIN → $DNS_IP (expected $EC2_HOST)"
    echo "   Nameservers may not be updated yet or DNS not propagated"
fi

# Check if Node.js is installed on EC2
echo ""
echo "4. Checking Node.js on EC2..."
NODE_VERSION=$(ssh -i "$SSH_KEY" ec2-user@$EC2_HOST "node --version 2>/dev/null" || echo "not installed")
if [[ "$NODE_VERSION" == v* ]]; then
    echo "   ✅ Node.js installed: $NODE_VERSION"
else
    echo "   ❌ Node.js not installed on EC2"
    echo "   Run ec2-setup.sh first"
    exit 1
fi

# Check if Nginx is installed
echo ""
echo "5. Checking Nginx on EC2..."
if ssh -i "$SSH_KEY" ec2-user@$EC2_HOST "which nginx" &>/dev/null; then
    echo "   ✅ Nginx installed"
else
    echo "   ❌ Nginx not installed on EC2"
    echo "   Run ec2-setup.sh first"
    exit 1
fi

# Check if directories exist
echo ""
echo "6. Checking application directories..."
if ssh -i "$SSH_KEY" ec2-user@$EC2_HOST "[ -d /opt/safesecrets/backend ] && [ -d /var/www/safesecrets ]" 2>/dev/null; then
    echo "   ✅ Application directories exist"
else
    echo "   ❌ Application directories not found"
    echo "   Run ec2-setup.sh first"
    exit 1
fi

# Check if SSL certificate exists
echo ""
echo "7. Checking SSL certificate..."
if ssh -i "$SSH_KEY" ec2-user@$EC2_HOST "sudo test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null; then
    echo "   ✅ SSL certificate exists"
else
    echo "   ⚠️  SSL certificate not found"
    echo "   Run: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

# Check local build tools
echo ""
echo "8. Checking local build tools..."
if command -v npm &>/dev/null; then
    echo "   ✅ npm installed"
else
    echo "   ❌ npm not found"
    exit 1
fi

# Check if frontend/backend can build
echo ""
echo "9. Checking if projects can build..."
if [ -f "frontend/package.json" ] && [ -f "backend/package.json" ]; then
    echo "   ✅ Frontend and backend package.json found"
else
    echo "   ❌ Missing package.json files"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment readiness check complete!"
echo ""
echo "Next steps:"
echo "1. If SSL certificate is missing, run on EC2:"
echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "2. Deploy the application:"
echo "   ./deploy.sh"
echo ""
echo "3. Start the backend service:"
echo "   ssh -i $SSH_KEY ec2-user@$EC2_HOST"
echo "   cd /opt/safesecrets/backend && pm2 start ecosystem.config.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
