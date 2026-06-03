# LetsCon Setup Guide

## Fixed Issues

✅ **Resolved Git merge conflict** in README.md
✅ **Fixed security vulnerability** - Secret key now uses environment variable
✅ **Created .env file** with development configuration
✅ **Verified all files** are complete and working

## Quick Start

### 1. Activate Virtual Environment

Windows:
```bash
.venv\Scripts\activate
```

Linux/Mac:
```bash
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Edit `.env` file and update:
- `SECRET_KEY` - Generate a random secret key for production

### 4. Run the Application

```bash
python app.py
```

### 5. Access the Application

Open your browser and navigate to:
```
http://localhost:5000
```

## Test Accounts

Two test accounts are automatically created:

**Account 1:**
- Email: `naruto@leafvillage.com`
- Password: `Hinata`
- Role: Hokage at Leaf Village

**Account 2:**
- Email: `sasuke@leafvillage.com`
- Password: `Sakura`
- Role: ANBU Captain at Leaf Village

## Features Available

✅ User registration and authentication
✅ Professional networking (connections)
✅ Problem-solution feed with posts
✅ Comment system with nested replies
✅ Reaction system (like, love, wow, super, clap)
✅ Direct messaging
✅ Group chats
✅ Stories (24-hour posts)
✅ Referral requests
✅ Company reviews
✅ Search functionality
✅ Notifications
✅ User profiles (Professional & Student accounts)

## Database

- **Development**: SQLite (`refnet.db` - auto-created)
- **Production**: PostgreSQL (set `DATABASE_URL` in .env)

## Project Structure

```
letscon/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── .env               # Environment variables (created)
├── .env.example       # Environment template
├── templates/
│   └── index.html     # Main HTML template
├── static/
│   ├── app.js         # Main JavaScript
│   ├── auth.js        # Authentication logic
│   ├── style.css      # Styles
│   └── logo.svg       # Logo
├── README.md          # Documentation (fixed)
├── DEPLOYMENT.md      # Deployment guide
└── SETUP.md          # This file
```

## Next Steps

1. **Customize branding**: Update logo and colors in `style.css`
2. **Configure email/SMS**: Set up Twilio or AWS SNS for notifications
3. **Database**: For production, configure PostgreSQL
4. **Security**: Generate a strong SECRET_KEY for production
5. **Deployment**: See DEPLOYMENT.md for hosting options

## Troubleshooting

### Port Already in Use
If port 5000 is busy, edit `app.py` line 1799:
```python
app.run(debug=True, host='0.0.0.0', port=5001)  # Change port
```

### Database Locked
Stop all running instances of the app before restarting.

### Module Not Found
Ensure virtual environment is activated and dependencies are installed:
```bash
pip install -r requirements.txt
```

## Security Notes

⚠️ **Important for Production:**
1. Set a strong `SECRET_KEY` in .env
2. Set `FLASK_ENV=production`
3. Set `DEBUG=False`
4. Use PostgreSQL instead of SQLite
5. Enable HTTPS
6. Set `SESSION_COOKIE_SECURE=True`

## Support

For issues or questions, check:
- README.md for features
- DEPLOYMENT.md for hosting
- GitHub issues (if applicable)
