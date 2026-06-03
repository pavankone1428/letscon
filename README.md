# LetsCon - Professional Networking & Referral Platform

A comprehensive career networking platform built with Flask that connects professionals, facilitates referrals, and enables meaningful career growth.

## Features

### 🔐 Authentication
- Email/username registration with secure password hashing
- Session management with secure cookies
- User profile with professional details
- Support for both Professional and Student accounts

### 👥 Social Networking
- Discover and connect with professionals
- Send/receive connection requests
- Real-time chat with connections
- User profiles with comprehensive information
- Stories feature for quick updates
- @mentions in posts and messages

### 💼 Referral System
- Request referrals for target companies/roles
- Browse and respond to referral requests
- Match seekers with referrers
- Track referral request status

### 📝 Problem-Solution Feed
- Share problems, solutions, discussions, and achievements
- Comment system with nested replies
- Reaction system (like, love, wow, super, clap)
- Vote on posts and comments
- Bookmark posts
- Tag-based organization

### 💬 Messaging
- Direct messaging with connections
- Group chats (up to 150 members)
- Message reactions and replies
- File attachments support
- Scheduled messages
- Message starring
- Emoji picker

### 📖 Stories
- 24-hour ephemeral stories
- Text and media stories
- Story reactions and replies
- View tracking

### 🏢 Company Insights
- Anonymous company reviews
- Salary range information
- Work-life balance ratings
- Manager ratings
- Work pressure insights

### 🔔 Notifications
- Connection request notifications
- Message notifications
- Post interaction alerts
- Real-time notification badge

### 🔍 Search
- Global search for users, posts, and companies
- Real-time search results
- Skill-based filtering

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: SQLite (development) / PostgreSQL (production)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Features**: Session Management, RESTful API, Responsive Design

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/letscon.git
cd letscon
```

2. Create a virtual environment:
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
# Copy the example file
copy .env.example .env
# Edit .env with your configuration
```

5. Run the application:
```bash
python app.py
```

6. Open your browser:
```
http://localhost:5000
```

## Database Schema

- **users**: User accounts with professional details
- **connections**: User connections and requests
- **messages**: Direct messaging
- **groups**: Group chat information
- **group_members**: Group membership
- **group_messages**: Group chat messages
- **posts**: Problem-solution feed posts
- **comments**: Post comments with nested replies
- **post_votes**: Post voting/reactions
- **comment_votes**: Comment voting
- **bookmarks**: Saved posts
- **stories**: 24-hour stories
- **story_reactions**: Story reactions
- **story_replies**: Story replies
- **story_views**: Story view tracking
- **referral_requests**: Referral requests
- **company_reviews**: Anonymous company reviews
- **notifications**: System notifications
- **reports**: User reports
- **resume_requests**: Resume access requests
- **message_reactions**: Message reactions

## Development Features

- Automatic database initialization with seed data
- Test users (Naruto/Sasuke) for quick testing
- Support for both SQLite and PostgreSQL
- Database migration support
- Responsive design for mobile and desktop
- Real-time notification polling

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for:
- Heroku
- AWS
- DigitalOcean
- Custom VPS

## Security Features

- Password hashing with Werkzeug
- Session-based authentication
- CSRF protection
- Secure cookie configuration
- SQL injection prevention
- User authorization checks on all endpoints

## Environment Variables

See `.env.example` for all available configuration options including:
- `SECRET_KEY`: Flask secret key (required)
- `DATABASE_URL`: PostgreSQL connection string (production)
- `FLASK_ENV`: Environment (development/production)
- Database configuration
- Third-party service credentials

## Quick Account Switcher

Development feature to quickly switch between test accounts:
- **Naruto**: naruto@leafvillage.com / Hinata
- **Sasuke**: sasuke@leafvillage.com / Sakura

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License
