# SafeSecrets Deployment Checklist

## Pre-Deployment Checklist

### ✅ Completed
- [x] EC2 instance running (184.73.253.209)
- [x] Route 53 hosted zone created (safesecrets.ca)
- [x] DNS A records pointing to EC2
- [x] ACM certificate requested
- [x] IAM role attached to EC2 (SafeSecretsEC2Role)
- [x] Security group configured (ports 22, 80, 443, 8080)
- [x] Frontend production env configured (.env.production)
- [x] Deployment scripts created

### ⏳ To Do Before First Deployment

1. **Update nameservers at domain registrar** (if not done)
   - Point to AWS Route 53 nameservers
   - Wait for DNS propagation (check with `nslookup safesecrets.ca`)

2. **Verify SSH access**
   ```bash
   ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
   ```

3. **Run one-time EC2 setup**
   ```bash
   # Copy setup script
   scp -i ~/.ssh/safesecrets-key.pem ec2-setup.sh ec2-user@184.73.253.209:~
   
   # SSH to EC2 and run
   ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
   chmod +x ec2-setup.sh
   ./ec2-setup.sh
   ```

4. **Copy Nginx configuration**
   ```bash
   scp -i ~/.ssh/safesecrets-key.pem nginx-safesecrets.conf ec2-user@184.73.253.209:~
   ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
   sudo cp nginx-safesecrets.conf /etc/nginx/conf.d/safesecrets.conf
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Get SSL certificate**
   ```bash
   # On EC2
   sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca
   ```

6. **Configure AWS credentials on EC2**
   - Option A: Use IAM role (recommended, already attached)
   - Option B: Add credentials to `/opt/safesecrets/backend/.env`

## Deployment Steps

### First Deployment

1. **Make deploy script executable**
   ```bash
   chmod +x deploy.sh
   ```

2. **Run deployment**
   ```bash
   ./deploy.sh
   ```

3. **Start backend service**
   ```bash
   ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
   cd /opt/safesecrets/backend
   pm2 start ecosystem.config.js
   pm2 save
   sudo pm2 startup
   ```

### Subsequent Deployments

Just run:
```bash
./deploy.sh
```

The script will automatically restart the backend service.

## Verification Steps

1. **Check DNS resolution**
   ```bash
   nslookup safesecrets.ca
   # Should return 184.73.253.209
   ```

2. **Check SSL certificate**
   ```bash
   curl -I https://safesecrets.ca
   # Should return 200 OK with valid SSL
   ```

3. **Check backend health**
   ```bash
   curl https://safesecrets.ca/health
   # Should return {"status":"ok"}
   ```

4. **Check WebSocket**
   - Open https://safesecrets.ca in browser
   - Open browser console
   - Click "Start Conversation"
   - Should see WebSocket connection established

5. **Check PM2 status**
   ```bash
   ssh -i ~/.ssh/safesecrets-key.pem ec2-user@184.73.253.209
   pm2 status
   pm2 logs safesecrets --lines 50
   ```

## Troubleshooting

### DNS not resolving
- Check nameservers at registrar
- Wait for DNS propagation (can take up to 48 hours)
- Use `dig safesecrets.ca` to check

### SSL certificate not working
- Ensure DNS is resolving first
- Check Certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`
- Verify Nginx config: `sudo nginx -t`

### Backend not starting
- Check logs: `pm2 logs safesecrets`
- Check environment: `cat /opt/safesecrets/backend/.env`
- Check IAM role: EC2 should have SafeSecretsEC2Role attached

### WebSocket connection failing
- Check security group: Port 443 must be open
- Check Nginx config: WebSocket proxy must be configured
- Check browser console for errors

## Current Status

- **EC2 Instance**: Running (184.73.253.209)
- **Domain**: safesecrets.ca
- **DNS**: Configured in Route 53
- **SSL**: Pending (needs Certbot setup)
- **Application**: Ready to deploy

## Next Action

Run the one-time EC2 setup, then deploy!
