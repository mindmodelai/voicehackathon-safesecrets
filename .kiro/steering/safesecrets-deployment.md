---
inclusion: auto
---

# SafeSecrets Deployment Strategy

## EC2-Based Deployment (NOT S3 + CloudFront)

For this project, we are using a single EC2 instance deployment, NOT the S3 + CloudFront static site pattern.

### Architecture

**Single EC2 Instance (ca-central-1) runs:**
- Nginx web server (serves static React build)
- Node.js backend (Mastra + WebSocket server)
- All AWS service integrations (Transcribe, Bedrock, Polly)

### Why EC2 Instead of S3 + CloudFront?

1. WebSocket server must run on EC2 anyway
2. Simpler architecture - everything in one place
3. Lower latency - frontend and backend on same instance
4. Easier SSL setup with Let's Encrypt
5. No need for separate API Gateway or ALB

### Deployment Process

1. **Develop locally:**
   ```bash
   npm run dev  # Frontend on :3000, backend on :8080
   ```

2. **Build for production:**
   ```bash
   npm run build  # Creates dist/ folder with static files
   ```

3. **Deploy to EC2:**
   - Copy `dist/` to EC2: `/var/www/safesecrets/`
   - Copy backend code to EC2: `/opt/safesecrets/backend/`
   - Nginx serves static files from `/var/www/safesecrets/`
   - Nginx proxies `/ws` to Node backend on port 8080
   - PM2 manages the Node process

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name safesecrets.ca www.safesecrets.ca;
    
    # Serve static frontend
    root /var/www/safesecrets;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy WebSocket to backend
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### SSL/HTTPS

Use Let's Encrypt (Certbot) on EC2:
```bash
sudo certbot --nginx -d safesecrets.ca -d www.safesecrets.ca
```

ACM certificates cannot be used directly on EC2 (only with ALB/CloudFront).

## Important Notes

- Do NOT use S3 + CloudFront for this project
- Do NOT create separate infrastructure for static hosting
- Everything runs on the single EC2 instance in ca-central-1
- This keeps data sovereignty simple (all in Canada)
