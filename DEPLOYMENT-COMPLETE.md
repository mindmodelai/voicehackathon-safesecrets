# SafeSecrets Deployment - COMPLETE ✅

**Deployment Date:** February 15, 2026  
**Domain:** https://safesecrets.ca  
**Status:** LIVE AND OPERATIONAL

## What's Running

### Frontend
- **URL:** https://safesecrets.ca
- **Location:** `/var/www/safesecrets/`
- **Server:** Nginx with SSL (Let's Encrypt)
- **Status:** ✅ Serving static files

### Backend
- **WebSocket:** wss://safesecrets.ca/ws
- **Health Check:** https://safesecrets.ca/health
- **Location:** `/opt/safesecrets/backend/`
- **Process Manager:** PM2 (auto-restart enabled)
- **Status:** ✅ Running on port 8080

### Infrastructure
- **EC2 Instance:** i-027ef930f941236c7
- **IP Address:** 99.79.9.109
- **Region:** ca-central-1 (Canada)
- **OS:** Amazon Linux 2023
- **User:** ec2-user

## Auto-Start Configuration ✅

Everything is configured to start automatically on server reboot:

1. **Nginx** - Enabled via systemd
   ```bash
   sudo systemctl status nginx
   ```

2. **PM2** - Enabled via systemd service `pm2-ec2-user`
   ```bash
   sudo systemctl status pm2-ec2-user
   ```

3. **Backend** - Managed by PM2, saved process list
   ```bash
   pm2 list
   ```

### What Happens on Reboot

1. Server boots up
2. Nginx starts automatically (serves frontend + proxies WebSocket)
3. PM2 service starts automatically
4. PM2 resurrects the saved process list
5. Backend starts automatically on port 8080
6. Everything is operational within ~30 seconds

## Environment Variables

Backend environment configured at `/opt/safesecrets/backend/.env`:

```bash
PORT=8080
AWS_REGION=ca-central-1
NODE_ENV=production
SMALLEST_AI_API_KEY=sk_7460d9085938b457f5c6ed24b55654d1
```

## File Structure on EC2

```
/opt/
├── safesecrets/
│   ├── backend/
│   │   ├── index.js (main entry point)
│   │   ├── .env (environment variables)
│   │   ├── package.json
│   │   └── node_modules/
│   └── shared/
│       ├── types.js
│       └── schema.js
└── shared/ (symlink to /opt/safesecrets/shared)

/var/www/
└── safesecrets/
    ├── index.html
    ├── assets/
    └── logos/
```

## SSH Access

**Key:** `D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem`  
**Passphrase:** 121314  
**User:** ec2-user  
**Host:** 99.79.9.109

**Connect:**
```powershell
ssh -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" ec2-user@99.79.9.109
```

## Management Commands

### PM2 Commands
```bash
# View status
pm2 list

# View logs
pm2 logs safesecrets

# Restart backend
pm2 restart safesecrets

# Stop backend
pm2 stop safesecrets

# Start backend
pm2 start safesecrets

# Save current state
pm2 save

# Monitor
pm2 monit
```

### Nginx Commands
```bash
# Check status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Test configuration
sudo nginx -t

# View logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### System Commands
```bash
# Check if backend is listening
sudo netstat -tlnp | grep 8080

# Test health endpoint locally
curl http://localhost:8080/health

# Check disk space
df -h

# Check memory
free -h

# View system logs
sudo journalctl -u pm2-ec2-user -f
```

## Testing

### Health Check
```powershell
Invoke-WebRequest -Uri "https://safesecrets.ca/health"
```

Expected response:
```json
{"status":"ok","sessions":0}
```

### WebSocket Test
1. Visit https://safesecrets.ca
2. Open Developer Console (F12)
3. Look for: `[SafeSecrets] WebSocket connected`
4. Speak to test the voice pipeline

## AWS Services Used

- **Bedrock:** AI/LLM (Claude models)
- **Transcribe:** Speech-to-Text
- **Polly:** Text-to-Speech
- **Smallest.ai:** Additional TTS provider

All services accessed via EC2 IAM role (no credentials needed in code).

## Security

- ✅ SSL/TLS enabled (Let's Encrypt)
- ✅ HTTPS enforced (HTTP redirects to HTTPS)
- ✅ S3 bucket private (no public access)
- ✅ EC2 security groups configured
- ✅ SSH key authentication only
- ✅ Environment variables secured
- ✅ API keys not in code

## Monitoring

### Check if Everything is Running
```bash
# Backend status
pm2 list

# Backend logs
pm2 logs safesecrets --lines 50

# Nginx status
sudo systemctl status nginx

# Check connections
sudo netstat -tlnp | grep -E '(80|443|8080)'
```

### Performance Metrics
```bash
# PM2 monitoring
pm2 monit

# System resources
htop

# Disk usage
df -h

# Memory usage
free -h
```

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
pm2 logs safesecrets

# Check if port is in use
sudo netstat -tlnp | grep 8080

# Restart
pm2 restart safesecrets

# Check environment
cat /opt/safesecrets/backend/.env
```

### WebSocket Connection Failed
```bash
# Check backend is running
pm2 list

# Check backend logs
pm2 logs safesecrets

# Test health endpoint
curl http://localhost:8080/health

# Check Nginx proxy
sudo nginx -t
sudo systemctl status nginx
```

### SSL Certificate Issues
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

## Backup & Recovery

### Backup Process List
```bash
pm2 save
```

### Restore Process List
```bash
pm2 resurrect
```

### Manual Backup
```bash
# Backup backend
tar -czf safesecrets-backend-backup.tar.gz /opt/safesecrets/backend/

# Backup frontend
tar -czf safesecrets-frontend-backup.tar.gz /var/www/safesecrets/

# Backup PM2 config
tar -czf pm2-backup.tar.gz ~/.pm2/
```

## Updates & Deployment

To deploy new code:

1. **Build locally:**
   ```powershell
   cd frontend
   npm run build
   cd ../backend
   npm run build
   ```

2. **Upload backend:**
   ```powershell
   scp -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" -r backend/dist/* ec2-user@99.79.9.109:/tmp/backend-new/
   ssh -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" ec2-user@99.79.9.109 "sudo cp -r /tmp/backend-new/* /opt/safesecrets/backend/ && pm2 restart safesecrets"
   ```

3. **Upload frontend:**
   ```powershell
   scp -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" -r frontend/dist/* ec2-user@99.79.9.109:/tmp/frontend-new/
   ssh -i "D:\MM-Gdrive\WinSCP Portable\k\safesecrets-key.pem" ec2-user@99.79.9.109 "sudo cp -r /tmp/frontend-new/* /var/www/safesecrets/"
   ```

## Cost Estimate

- EC2 t2.micro: ~$8-10/month
- Data transfer: ~$1-5/month
- Route 53: $0.50/month
- SSL certificate: Free (Let's Encrypt)
- **Total:** ~$10-15/month

## Success Metrics

✅ Frontend accessible at https://safesecrets.ca  
✅ SSL certificate valid  
✅ Backend running on port 8080  
✅ WebSocket connections working  
✅ Health endpoint responding  
✅ PM2 auto-start configured  
✅ Nginx auto-start configured  
✅ API keys configured  
✅ Logs accessible  
✅ All services operational  

## Support

For issues or questions:
1. Check logs: `pm2 logs safesecrets`
2. Check health: `curl http://localhost:8080/health`
3. Restart services: `pm2 restart safesecrets`
4. Review this document for troubleshooting steps

---

**Deployment completed successfully on February 15, 2026**  
**System is production-ready and fully operational** 🚀
