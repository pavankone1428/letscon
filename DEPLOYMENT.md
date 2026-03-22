# LeTsCoN - Deployment Guide

## 🚀 Production Deployment

### Prerequisites
- Python 3.8+
- PostgreSQL or MySQL (for production)
- Domain name
- SSL certificate
- SMS service (Twilio/AWS SNS)

## 📋 Pre-Deployment Checklist

### 1. Environment Variables
Create a `.env` file:

```bash
# Flask Configuration
SECRET_KEY=your-super-secret-key-here
FLASK_ENV=production
DEBUG=False

# Database
DATABASE_URL=postgresql://user:password@localhost/letscon

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Or AWS SNS
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# File Storage (AWS S3)
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY=your-s3-access-key
S3_SECRET_KEY=your-s3-secret-key

# Security
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Lax
```

### 2. Update app.py for Production

```python
import os
from dotenv import load_dotenv

load_dotenv()

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Use PostgreSQL instead of SQLite
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///letscon.db')
```

### 3. Install Production Dependencies

```bash
pip install gunicorn psycopg2-binary python-dotenv twilio boto3
```

Update `requirements.txt`:
```
flask==3.0.0
gunicorn==21.2.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
twilio==8.10.0
boto3==1.29.0
```

## 🌐 Deployment Options

### Option 1: Heroku

1. **Install Heroku CLI**
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

2. **Create Heroku App**
```bash
heroku login
heroku create letscon-app
```

3. **Add PostgreSQL**
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

4. **Set Environment Variables**
```bash
heroku config:set SECRET_KEY=your-secret-key
heroku config:set TWILIO_ACCOUNT_SID=your-sid
heroku config:set TWILIO_AUTH_TOKEN=your-token
```

5. **Create Procfile**
```
web: gunicorn app:app
```

6. **Deploy**
```bash
git init
git add .
git commit -m "Initial deployment"
git push heroku main
```

### Option 2: AWS EC2

1. **Launch EC2 Instance**
   - Ubuntu 22.04 LTS
   - t2.micro (free tier)
   - Open ports 80, 443, 22

2. **SSH into Instance**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

3. **Install Dependencies**
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx postgresql
```

4. **Setup Application**
```bash
git clone your-repo
cd letscon
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

5. **Configure Nginx**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

6. **Setup Systemd Service**
```ini
[Unit]
Description=LeTsCoN Flask App
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/letscon
Environment="PATH=/home/ubuntu/letscon/venv/bin"
ExecStart=/home/ubuntu/letscon/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app

[Install]
WantedBy=multi-user.target
```

7. **Start Service**
```bash
sudo systemctl enable letscon
sudo systemctl start letscon
```

### Option 3: DigitalOcean App Platform

1. **Connect GitHub Repository**
2. **Configure Build Settings**
   - Build Command: `pip install -r requirements.txt`
   - Run Command: `gunicorn app:app`
3. **Add Environment Variables**
4. **Deploy**

### Option 4: Docker

1. **Create Dockerfile**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

2. **Create docker-compose.yml**
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/letscon
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=letscon
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

3. **Deploy**
```bash
docker-compose up -d
```

## 🔒 Security Hardening

### 1. Enable HTTPS
```bash
# Using Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 2. Add Rate Limiting
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    # ... existing code
```

### 3. Add CORS Protection
```python
from flask_cors import CORS

CORS(app, resources={
    r"/api/*": {
        "origins": ["https://your-domain.com"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})
```

### 4. Input Validation
```python
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect(app)
```

## 📊 Monitoring & Logging

### 1. Setup Logging
```python
import logging
from logging.handlers import RotatingFileHandler

if not app.debug:
    file_handler = RotatingFileHandler('letscon.log', maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('LeTsCoN startup')
```

### 2. Error Tracking (Sentry)
```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0
)
```

## 🗄️ Database Migration

### From SQLite to PostgreSQL

1. **Export SQLite Data**
```bash
sqlite3 letscon.db .dump > dump.sql
```

2. **Import to PostgreSQL**
```bash
psql -U postgres -d letscon -f dump.sql
```

3. **Update Connection String**
```python
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    return psycopg2.connect(
        os.getenv('DATABASE_URL'),
        cursor_factory=RealDictCursor
    )
```

## 📱 SMS Integration

### Twilio Setup
```python
from twilio.rest import Client

def send_otp_sms(mobile, otp):
    client = Client(
        os.getenv('TWILIO_ACCOUNT_SID'),
        os.getenv('TWILIO_AUTH_TOKEN')
    )
    
    message = client.messages.create(
        body=f'Your LeTsCoN verification code is: {otp}',
        from_=os.getenv('TWILIO_PHONE_NUMBER'),
        to=mobile
    )
    
    return message.sid
```

## 🎯 Performance Optimization

### 1. Enable Caching
```python
from flask_caching import Cache

cache = Cache(app, config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_URL': os.getenv('REDIS_URL')
})

@app.route('/api/posts')
@cache.cached(timeout=300)
def get_posts():
    # ... existing code
```

### 2. Database Connection Pooling
```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20
)
```

### 3. Compress Responses
```python
from flask_compress import Compress

Compress(app)
```

## 🔄 Backup Strategy

### Automated Database Backups
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="letscon"

pg_dump $DB_NAME > $BACKUP_DIR/letscon_$DATE.sql
gzip $BACKUP_DIR/letscon_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "letscon_*.sql.gz" -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx, AWS ELB)
- Session storage in Redis
- File storage in S3
- Database read replicas

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Add database indexes
- Enable query caching

## ✅ Post-Deployment Checklist

- [ ] SSL certificate installed
- [ ] Environment variables set
- [ ] Database migrated
- [ ] SMS service configured
- [ ] Backups automated
- [ ] Monitoring enabled
- [ ] Error tracking setup
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] Logs configured
- [ ] Domain DNS configured
- [ ] Firewall rules set
- [ ] Health check endpoint working
- [ ] Load testing completed

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL format
   - Verify database credentials
   - Ensure database is running

2. **SMS Not Sending**
   - Verify Twilio credentials
   - Check phone number format
   - Review Twilio logs

3. **Session Issues**
   - Check SECRET_KEY is set
   - Verify cookie settings
   - Clear browser cookies

4. **Performance Issues**
   - Enable caching
   - Add database indexes
   - Optimize queries
   - Scale resources

## 📞 Support

For deployment issues, check:
- Application logs: `/var/log/letscon.log`
- Nginx logs: `/var/log/nginx/error.log`
- System logs: `journalctl -u letscon`

---

**Ready for Production!** 🎉
