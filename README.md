<<<<<<< HEAD
# LeTsCoN - Local Connection Platform

A location-based social networking platform built with Flask that connects people in their local area.

## Features

### 🔐 Authentication
- Mobile number registration with OTP verification
- Secure password hashing
- Session management
- User profile with location access

### 👥 Social Networking
- Discover nearby users based on GPS location
- Send/receive connection requests
- Real-time chat with connections
- User profiles with statistics

### 📝 Task Management
- Create and manage personal tasks
- Mark tasks as complete
- Track completed tasks

### 🛒 Marketplace
- Post services you offer
- Request help from community
- Announce local events
- Show interest in posts
- View interested users
- Filter by category (Services, Help, Events, Other)
- Distance-based sorting

### 🔔 Notifications
- Connection request notifications
- Connection acceptance alerts
- Post interest notifications
- Real-time notification badge

### 🔍 Search
- Global search for users and posts
- Real-time search results
- Quick navigation to results

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: SQLite
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Features**: Geolocation API, Session Management, RESTful API

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open your browser:
```
http://localhost:5000
```

## Database Schema

- **users**: User accounts with location data
- **tasks**: Personal task management
- **connections**: User connections and requests
- **messages**: Direct messaging between connections
- **posts**: Marketplace posts
- **post_interests**: Track user interest in posts
- **notifications**: System notifications

## Usage

1. **Register**: Enter mobile number → Verify OTP → Complete profile with location
2. **Discover**: Find nearby users within specified radius
3. **Connect**: Send connection requests and chat with accepted connections
4. **Post**: Create marketplace posts for services, help requests, or events
5. **Tasks**: Manage your personal to-do list
6. **Search**: Find users or posts quickly

## Security Features

- Password hashing with Werkzeug
- Session-based authentication
- OTP verification for registration
- User authorization checks on all endpoints

## Development Notes

- OTP is displayed in console for development (integrate SMS service for production)
- Uses Haversine formula for accurate distance calculation
- Responsive design for mobile and desktop
- Real-time notification polling every 30 seconds

## Future Enhancements

- Real-time chat with WebSockets
- Push notifications
- Image uploads for posts and profiles
- Rating and review system
- Advanced filtering and sorting
- Group chats
- Event calendar integration

## License

MIT License
=======
# letscon
>>>>>>> c6d4f79be8fde2444898788c259a45d64fe0ea06
