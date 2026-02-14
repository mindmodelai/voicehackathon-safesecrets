# SafeSecrets Domain Setup

## Route 53 Hosted Zone

**Domain**: safesecrets.ca  
**Hosted Zone ID**: Z06560531GZI9GQ8C4GMT

### Nameservers (Update at your registrar)
Point your domain registrar to these AWS nameservers:
- ns-1135.awsdns-13.org
- ns-420.awsdns-52.com
- ns-1595.awsdns-07.co.uk
- ns-595.awsdns-10.net

## DNS Records Created

### A Records (pointing to EC2)
- **safesecrets.ca** → 99.79.9.109 (TTL: 300)
- **www.safesecrets.ca** → 99.79.9.109 (TTL: 300)

### CNAME Record (ACM validation)
- **_e2d31b65283efb7dc9d9871f829e256b.safesecrets.ca** → _6fc235a186f5cf856ed2b1eb2d69d8fe.jkddzztszm.acm-validations.aws. (TTL: 300)

## SSL Certificate (ACM)

**Certificate ARN**: arn:aws:acm:us-east-1:068531506413:certificate/ae3f6d67-9d0b-4d0f-9fde-666ddd0b68cd  
**Region**: us-east-1 (required for CloudFront/ALB)  
**Domains Covered**:
- safesecrets.ca
- *.safesecrets.ca (wildcard)

**Validation Method**: DNS  
**Status**: Pending validation (will auto-validate once nameservers are updated at registrar)

## Next Steps

1. **Update nameservers at your domain registrar** to the AWS nameservers listed above
2. **Wait for DNS propagation** (can take 24-48 hours, but usually faster)
3. **Certificate will auto-validate** once DNS propagation completes
4. **Set up web server on EC2** (Nginx or Node) to serve the frontend
5. **Configure SSL** on the web server using the ACM certificate

## Web Server Options

### Option A: Nginx (Recommended)
- Nginx serves static React build
- Reverse proxy `/ws` to Node WebSocket server
- SSL termination with Let's Encrypt (since ACM certs can't be exported to EC2)

### Option B: Application Load Balancer + ACM
- ALB handles SSL with ACM certificate
- Routes traffic to EC2 target group
- More expensive but easier SSL management

### Option C: CloudFront + S3 + API Gateway
- S3 hosts static frontend
- API Gateway WebSocket for backend
- CloudFront uses ACM certificate
- Most scalable but more complex

## Verification Commands

Check DNS propagation:
```bash
nslookup safesecrets.ca
dig safesecrets.ca
```

Check certificate status:
```bash
aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:068531506413:certificate/ae3f6d67-9d0b-4d0f-9fde-666ddd0b68cd --region us-east-1 --query "Certificate.Status"
```

## Important Notes

- ACM certificates in us-east-1 can be used with CloudFront or ALB
- For direct EC2 use, you'll need Let's Encrypt or import a certificate
- WebSocket requires HTTPS for microphone access in browsers
- The EC2 instance is in ca-central-1, but ACM cert is in us-east-1 (standard practice)
