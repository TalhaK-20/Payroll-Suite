# 🚀 Production Deployment Guide

## Pre-Deployment Checklist

- [ ] All tests passed
- [ ] Environment variables configured
- [ ] MongoDB setup (Atlas or self-hosted)
- [ ] SSL certificate obtained
- [ ] Domain name configured
- [ ] Backup strategy in place

## Deployment Platforms

### Option 1: Heroku (Easiest)

#### Setup:
1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Login: `heroku login`
3. Create app: `heroku create payroll-system`
4. Add MongoDB Atlas URI:
   ```powershell
   heroku config:set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/payroll_system
   heroku config:set NODE_ENV=production
   heroku config:set PORT=5000
   ```
5. Deploy:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

#### Monitor:
```powershell
heroku logs --tail
```

### Option 2: AWS EC2

#### Setup:
1. Launch Ubuntu 20.04 EC2 instance
2. Connect via SSH
3. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. Install MongoDB or use Atlas
5. Clone project:
   ```bash
   git clone <your-repo-url>
   cd Payroll\ App
   npm install
   ```
6. Create `.env` with production settings
7. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start app.js --name "payroll-system"
   pm2 startup
   pm2 save
   ```
8. Setup Nginx reverse proxy:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Option 3: DigitalOcean App Platform

#### Setup:
1. Connect GitHub repository
2. Select "Node.js"
3. Set environment variables
4. Configure health check: `/`
5. Deploy

### Option 4: Azure App Service

#### Setup:
1. Create App Service (Node.js)
2. Configure deployment from Git
3. Set application settings:
   ```
   MONGODB_URI = mongodb+srv://...
   NODE_ENV = production
   PORT = 8080
   ```
4. Deploy via Git push

## Environment Configuration for Production

### `.env` Production Settings:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/payroll_system?retryWrites=true&w=majority

# Server
PORT=5000
NODE_ENV=production

# Security
SESSION_SECRET=your-long-random-secret-key-here

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/tmp/payroll_uploads
```

## Security Best Practices

### 1. SSL/TLS Certificate
- Use Let's Encrypt for free certificates
- Auto-renew with certbot

### 2. Environment Variables
- Never commit `.env` to Git
- Use platform-specific configuration management
- Rotate secrets regularly

### 3. Database
- Use MongoDB Atlas for managed service
- Enable IP whitelist
- Create dedicated database user
- Enable encryption at rest

### 4. Application Security
- Enable CORS properly:
  ```javascript
  const cors = require('cors');
  app.use(cors({
    origin: 'https://yourdomain.com',
    credentials: true
  }));
  ```
- Add rate limiting:
  ```javascript
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  });
  app.use(limiter);
  ```
- Add helmet for security headers:
  ```javascript
  const helmet = require('helmet');
  app.use(helmet());
  ```

### 5. Input Validation
- Already implemented with express-validator
- Never trust user input
- Sanitize file uploads

### 6. File Upload Security
- Restrict file types to Excel only
- Limit file size to 10MB
- Scan uploaded files for malware (optional)

## Monitoring & Logging

### 1. Application Logging
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Use in code:
logger.info('Payroll record created', { id: recordId });
```

### 2. Error Tracking (Sentry)
```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.errorHandler());
```

### 3. Monitoring Tools
- **New Relic**: Application performance monitoring
- **Datadog**: Infrastructure monitoring
- **Uptime Robot**: Uptime monitoring

## Backup Strategy

### 1. Database Backups
```bash
# Monthly backup
mongodump --uri "mongodb+srv://..." --out ./backups/$(date +%Y-%m-%d)
```

### 2. Cloud Storage
- Upload backups to AWS S3
- Store in separate region
- Test restore procedures monthly

### 3. Backup Automation
```bash
# Add to crontab for daily backups at 2 AM
0 2 * * * /home/user/backup.sh
```

## Performance Optimization

### 1. Database Indexing
- Already implemented in Payroll.js:
  ```javascript
  payrollSchema.index({ clientName: 1 });
  payrollSchema.index({ guardName: 1 });
  payrollSchema.index({ createdAt: -1 });
  ```

### 2. Caching
```javascript
const redis = require('redis');
const client = redis.createClient();

// Cache payroll records for 5 minutes
app.get('/api/payroll', async (req, res) => {
  const cached = await client.get('payroll:all');
  if (cached) return res.json(JSON.parse(cached));
  
  const data = await Payroll.find();
  await client.setEx('payroll:all', 300, JSON.stringify(data));
  res.json(data);
});
```

### 3. CDN Configuration
- Use CloudFront or Cloudflare for static assets
- Configure caching headers

## Scaling

### 1. Horizontal Scaling
```javascript
// Use load balancer (Nginx, HAProxy)
// Run multiple instances on different ports
```

### 2. Database Scaling
- MongoDB sharding for large datasets
- Read replicas for distributed load

### 3. Queue System (for future)
```javascript
// Use Bull for job queue
const Queue = require('bull');
const pdfQueue = new Queue('pdf-generation');

pdfQueue.process(async (job) => {
  // Generate PDF asynchronously
});
```

## Disaster Recovery

### 1. RTO & RPO
- Recovery Time Objective: 4 hours
- Recovery Point Objective: 1 day

### 2. Failover Setup
- Maintain standby server
- Use database replication
- DNS failover automation

### 3. Testing
- Test backup restore monthly
- Document recovery procedures
- Train team on procedures

## Health Check Endpoint

```javascript
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await mongoose.connection.db.admin().ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

## Post-Deployment

1. **Monitor Logs**: Check error logs regularly
2. **Performance**: Monitor response times
3. **Database**: Check index usage
4. **Backups**: Verify daily backups complete
5. **Security**: Run security scans monthly
6. **Updates**: Apply security patches promptly

## Troubleshooting Production Issues

### High CPU Usage
- Check slow database queries
- Optimize indexes
- Implement caching

### High Memory Usage
- Check for memory leaks
- Implement pagination
- Use streaming for large exports

### Database Connection Timeouts
- Increase connection pool
- Check MongoDB Atlas connection limits
- Optimize query performance

### File Upload Issues
- Check disk space
- Verify write permissions
- Monitor upload directory size

## Rollback Procedure

If deployment fails:

1. Identify failed version
2. Revert to last stable:
   ```bash
   git revert <commit-hash>
   git push heroku main
   ```
3. Restore database from backup if needed
4. Notify stakeholders
5. Post-mortem analysis

---

## Deployment Checklist - Final

- [ ] Security headers configured
- [ ] SSL/TLS enabled
- [ ] Environment variables set
- [ ] Database backups enabled
- [ ] Logging configured
- [ ] Error tracking setup
- [ ] Health checks working
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] File upload restrictions applied
- [ ] Production database verified
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team trained on procedures

**Congratulations! Your Payroll System is ready for production! 🚀**
