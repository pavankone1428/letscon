from flask import Flask, render_template, jsonify, request, session
import sqlite3
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import random
import json

import os
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.secret_key = 'refnet-dev-secret-key-2024'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

DATABASE_URL = os.environ.get('DATABASE_URL')
USE_PG = bool(DATABASE_URL)

if USE_PG:
    import psycopg2
    import psycopg2.extras
    print(f"[DB] Using PostgreSQL: {DATABASE_URL[:30]}...")
else:
    print("[DB] Using SQLite (no DATABASE_URL found)")

otp_store = {}

class PgConnectionWrapper:
    """Wraps psycopg2 connection to behave like sqlite3 with Row factory."""
    def __init__(self, conn):
        self._conn = conn
    def execute(self, sql, params=None):
        sql = sql.replace('?', '%s')
        sql = sql.replace("datetime('now', '-24 hours')", "(NOW() - INTERVAL '24 hours')")
        sql = sql.replace("datetime('now','+24 hours')", "(NOW() + INTERVAL '24 hours')")
        sql = sql.replace('datetime("now","+24 hours")', "(NOW() + INTERVAL '24 hours')")
        sql = sql.replace("datetime('now')", "NOW()")
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            cur.execute(sql, params or ())
        except Exception as e:
            self._conn.rollback()
            err = str(e).lower()
            if 'duplicate' in err or 'already exists' in err or 'unique' in err:
                return cur
            raise
        return cur
    def commit(self):
        self._conn.commit()
    def close(self):
        self._conn.close()

def row_val(row, key_or_index):
    """Get value from a row that might be a dict (PG) or sqlite3.Row."""
    if row is None:
        return None
    if isinstance(row, dict):
        return row.get(key_or_index) if isinstance(key_or_index, str) else list(row.values())[key_or_index]
    return row[key_or_index]

def get_last_id(conn, table=''):
    """Get last inserted ID, works for both SQLite and PostgreSQL."""
    if USE_PG:
        r = conn.execute(f"SELECT currval(pg_get_serial_sequence('{table}', 'id'))").fetchone()
        return row_val(r, 'currval')
    else:
        return conn.execute('SELECT last_insert_rowid()').fetchone()[0]

def get_db():
    if USE_PG:
        conn = psycopg2.connect(DATABASE_URL)
        return PgConnectionWrapper(conn)
    else:
        conn = sqlite3.connect('refnet.db', timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

def init_db():
    conn = get_db()
    if USE_PG:
        c = conn
    else:
        c = conn

    def run(sql):
        """Run DDL, converting syntax for PostgreSQL if needed."""
        if USE_PG:
            sql = sql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
            sql = sql.replace('BOOLEAN DEFAULT 0', 'BOOLEAN DEFAULT FALSE')
            sql = sql.replace('BOOLEAN DEFAULT 1', 'BOOLEAN DEFAULT TRUE')
            try:
                conn.execute(sql)
            except:
                pass
        else:
            conn.execute(sql)

    run('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        work_email TEXT,
        work_verified BOOLEAN DEFAULT 0,
        company TEXT,
        role TEXT,
        experience INTEGER DEFAULT 0,
        bio TEXT,
        skills TEXT,
        linkedin TEXT,
        github TEXT,
        resume TEXT,
        profile_photo TEXT,
        available_for_referral BOOLEAN DEFAULT 0,
        is_private BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    run('''CREATE TABLE IF NOT EXISTS referral_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seeker_id INTEGER NOT NULL,
        target_company TEXT NOT NULL,
        target_role TEXT NOT NULL,
        skills_required TEXT,
        description TEXT,
        resume TEXT,
        status TEXT DEFAULT 'open',
        matched_referrer_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seeker_id) REFERENCES users(id),
        FOREIGN KEY (matched_referrer_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT DEFAULT 'problem',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        parent_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS comment_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        vote INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comment_id) REFERENCES comments(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(comment_id, user_id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS post_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        vote INTEGER NOT NULL,
        reaction TEXT DEFAULT 'like',
        UNIQUE(post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        UNIQUE(sender_id, receiver_id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        reply_to_id INTEGER,
        starred BOOLEAN DEFAULT 0,
        read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        FOREIGN KEY (reply_to_id) REFERENCES messages(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS message_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        reaction TEXT NOT NULL,
        UNIQUE(message_id, user_id),
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        bg_color TEXT DEFAULT '#7c3aed',
        media_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS story_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        reaction TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (story_id) REFERENCES stories(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS story_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (story_id) REFERENCES stories(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS story_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (story_id) REFERENCES stories(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(story_id, user_id)
    )''')

    # ─── GROUP CHAT TABLES ───
    run('''CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        creator_id INTEGER NOT NULL,
        avatar_color TEXT DEFAULT '#7c3aed',
        max_members INTEGER DEFAULT 150,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(group_id, user_id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS group_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        reply_to_id INTEGER,
        scheduled_at TIMESTAMP,
        delivered BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS resume_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        owner_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users(id),
        FOREIGN KEY (owner_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        reported_user_id INTEGER,
        reported_post_id INTEGER,
        reported_message_id INTEGER,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        from_user_id INTEGER,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        related_id INTEGER,
        read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    run('''CREATE TABLE IF NOT EXISTS company_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        company TEXT NOT NULL,
        salary_range TEXT,
        work_life_rating INTEGER,
        manager_rating INTEGER,
        work_pressure TEXT,
        review TEXT,
        anonymous BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    conn.commit()

    # Migrate existing DB
    for col, ctype in [('is_private', 'BOOLEAN DEFAULT 0'), ('resume', 'TEXT'), ('profile_photo', 'TEXT'), ('bio', 'TEXT')]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {ctype}")
        except Exception:
            pass
    try:
        conn.execute("ALTER TABLE post_votes ADD COLUMN reaction TEXT DEFAULT 'like'")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE notifications ADD COLUMN related_id INTEGER")
    except Exception:
        pass
    for col, ctype in [('reply_to_id', 'INTEGER'), ('starred', 'BOOLEAN DEFAULT 0')]:
        try:
            conn.execute(f"ALTER TABLE messages ADD COLUMN {col} {ctype}")
        except Exception:
            pass
    try:
        conn.execute("ALTER TABLE stories ADD COLUMN media_url TEXT")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE comments ADD COLUMN parent_id INTEGER")
    except Exception:
        pass
    for col, ctype in [('file_url', 'TEXT'), ('file_name', 'TEXT'), ('scheduled_at', 'TIMESTAMP'), ('delivered', 'BOOLEAN DEFAULT 1')]:
        try:
            conn.execute(f"ALTER TABLE messages ADD COLUMN {col} {ctype}")
        except Exception:
            pass
    # Profile enhancement columns (stored as JSON text)
    for col, ctype in [('headline', 'TEXT'), ('tagline', 'TEXT'), ('location', 'TEXT'),
                        ('work_history', 'TEXT'), ('education', 'TEXT'), ('projects', 'TEXT'),
                        ('certifications', 'TEXT'), ('accomplishments', 'TEXT'),
                        ('career_goals', 'TEXT'), ('personal_info', 'TEXT'),
                        ('account_type', 'TEXT'), ('college', 'TEXT'), ('degree_pursuing', 'TEXT'),
                        ('graduation_year', 'TEXT'), ('cgpa', 'TEXT'), ('internships', 'TEXT'),
                        ('profile_setup_done', 'BOOLEAN DEFAULT 0')]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {ctype}")
        except Exception:
            pass

    # Seed test users if they don't exist
    test_users = [
        ('naruto@leafvillage.com', 'NARUTO', 'Hinata', 'Leaf Village', 'Hokage', 'React, Node.js, Leadership'),
        ('sasuke@leafvillage.com', 'SASUKE', 'Sakura', 'Leaf Village', 'ANBU Captain', 'Python, Security, Strategy'),
    ]
    for email, username, pw, company, role, skills in test_users:
        existing = conn.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()
        if not existing:
            conn.execute('INSERT INTO users (email, username, password, company, role, skills) VALUES (?,?,?,?,?,?)',
                      (email, username, generate_password_hash(pw), company, role, skills))

    conn.commit()

    # Seed static data if DB is fresh (no posts exist)
    has_posts = row_val(conn.execute('SELECT COUNT(*) as cnt FROM posts').fetchone(), 'cnt')
    if has_posts == 0:
        naruto = conn.execute('SELECT id FROM users WHERE email=?', ('naruto@leafvillage.com',)).fetchone()
        sasuke = conn.execute('SELECT id FROM users WHERE email=?', ('sasuke@leafvillage.com',)).fetchone()
        if naruto and sasuke:
            nid, sid = row_val(naruto, 'id'), row_val(sasuke, 'id')

            # Make them connected
            conn.execute('INSERT INTO connections (sender_id, receiver_id, status) VALUES (?,?,?)', (nid, sid, 'accepted'))

            # Seed posts
            seed_posts = [
                (nid, 'achievement', 'Became Hokage!', 'Finally achieved my dream of becoming Hokage. Never give up on your dreams, believe it!', 'leadership,goals,motivation'),
                (sid, 'discussion', 'Best practices for ANBU operations', 'What security frameworks do you use for covert missions? Looking for recommendations on stealth protocols and encrypted communications.', 'security,strategy,operations'),
                (nid, 'problem', 'Shadow Clone Jutsu causing memory leaks', 'When I create too many shadow clones, the system runs out of memory. Anyone faced similar scaling issues?', 'scaling,performance,debugging'),
                (sid, 'solution', 'Sharingan-based code review technique', 'I developed a method to review code 10x faster using pattern recognition. Here is how it works: focus on the data flow first, then check edge cases.', 'code-review,productivity,tips'),
                (nid, 'discussion', 'Team building activities for remote ninjas', 'Our team is distributed across different villages. What activities help build team spirit when everyone is remote?', 'remote-work,team,culture'),
                (sid, 'achievement', 'Completed S-rank security audit', 'Successfully completed a full security audit of the village network. Zero critical vulnerabilities found after our patches.', 'security,audit,milestone'),
            ]
            for uid, ptype, title, content, tags in seed_posts:
                conn.execute('INSERT INTO posts (user_id, type, title, content, tags) VALUES (?,?,?,?,?)',
                          (uid, ptype, title, content, tags))

            # Seed stories
            seed_stories = [
                (nid, 'Ramen break! Best way to recharge after a long coding session 🍜', '#7c3aed'),
                (sid, 'Just deployed a new security patch. Stay safe out there.', '#1a1a1a'),
                (nid, 'Looking for React developers for a new village project. DM me!', '#2563eb'),
                (sid, 'Training session at 6 AM tomorrow. Who is in?', '#dc2626'),
            ]
            for uid, content, color in seed_stories:
                conn.execute('INSERT INTO stories (user_id, content, type, bg_color, expires_at) VALUES (?,?,?,?,datetime("now","+24 hours"))',
                             (uid, content, 'text', color))

            # Seed some comments
            posts = conn.execute('SELECT id, user_id FROM posts').fetchall()
            seed_comments = [
                (row_val(posts[0], 'id'), sid, 'Congratulations Naruto! Well deserved!'),
                (row_val(posts[1], 'id'), nid, 'I recommend using encrypted scroll protocols. Works great for our team.'),
                (row_val(posts[2], 'id'), sid, 'Try limiting clone count to 1000. Use a queue system for the rest.'),
                (row_val(posts[3], 'id'), nid, 'This is amazing! Will try this in our next sprint review.'),
            ]
            for post_id, uid, content in seed_comments:
                conn.execute('INSERT INTO comments (post_id, user_id, content) VALUES (?,?,?)', (post_id, uid, content))

            # Seed a company review
            conn.execute('INSERT INTO company_reviews (user_id, company, salary_range, work_life_rating, manager_rating, work_pressure, review, anonymous) VALUES (?,?,?,?,?,?,?,?)',
                      (nid, 'Leaf Village', '80-120K', 4, 5, 'medium', 'Great place to work. The Hokage really cares about work-life balance. Free ramen on Fridays!', 1))
            conn.execute('INSERT INTO company_reviews (user_id, company, salary_range, work_life_rating, manager_rating, work_pressure, review, anonymous) VALUES (?,?,?,?,?,?,?,?)',
                      (sid, 'Leaf Village', '90-130K', 3, 4, 'high', 'Challenging missions but great learning opportunities. ANBU division has intense work pressure though.', 1))

            conn.commit()
    conn.close()

init_db()

def create_notification(user_id, from_user_id, ntype, message, conn=None, related_id=None):
    own_conn = False
    if conn is None:
        conn = get_db()
        own_conn = True
    conn.execute('INSERT INTO notifications (user_id, from_user_id, type, message, related_id) VALUES (?,?,?,?,?)',
                 (user_id, from_user_id, ntype, message, related_id))
    if own_conn:
        conn.commit()
        conn.close()

import re
def process_mentions(text, sender_id, sender_name, context, conn, related_id=None):
    """Find @username mentions in text and send notifications."""
    mentions = re.findall(r'@(\w+)', text)
    for uname in set(mentions):
        user = conn.execute('SELECT id FROM users WHERE LOWER(username)=LOWER(?)', (uname,)).fetchone()
        if user and user['id'] != sender_id:
            create_notification(user['id'], sender_id, 'mention',
                               f'{sender_name} mentioned you in {context}', conn, related_id=related_id)

# ─── ROUTES ───

@app.route('/')
def home():
    return render_template('index.html',
                           username=session.get('username'),
                           logged_in='user_id' in session)

# ─── AUTH ───

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    company = data.get('company', '').strip()
    role = data.get('role', '').strip()
    account_type = data.get('account_type', 'professional')
    college = data.get('college', '').strip()
    degree_pursuing = data.get('degree_pursuing', '').strip()
    graduation_year = data.get('graduation_year', '').strip()

    if not email or not username or not password:
        return jsonify({'error': 'Email, name and password required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    conn = get_db()
    try:
        hashed = generate_password_hash(password)
        conn.execute('''INSERT INTO users (email, username, password, company, role, account_type, college, degree_pursuing, graduation_year)
                        VALUES (?,?,?,?,?,?,?,?,?)''', (email, username, hashed, company, role, account_type, college, degree_pursuing, graduation_year))
        conn.commit()
        user_id = get_last_id(conn, 'users')
        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'message': 'Registration successful'})
    except Exception:
        return jsonify({'error': 'Email already registered'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    identifier = data.get('email', '').strip()
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'error': 'Email and password required'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE LOWER(email)=LOWER(?) OR LOWER(username)=LOWER(?)',
                        (identifier, identifier)).fetchone()
    conn.close()

    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'message': 'Login successful'})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@app.route('/api/quick-switch', methods=['POST'])
def quick_switch():
    data = request.json
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    conn = get_db()
    user = conn.execute('SELECT id, username FROM users WHERE id=?', (user_id,)).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'message': 'Switched', 'username': user['username']})

@app.route('/api/all-users', methods=['GET'])
def all_users_list():
    """Return all users for the account switcher"""
    conn = get_db()
    users = conn.execute('SELECT id, username, company, role, profile_photo FROM users ORDER BY username').fetchall()
    conn.close()
    current_id = session.get('user_id')
    return jsonify({'users': [dict(u) for u in users], 'current_id': current_id})

# ─── PROFILE ───

@app.route('/api/profile', methods=['GET'])
def get_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    user = conn.execute('''SELECT id, email, username, company, role, experience, bio, skills,
                           linkedin, github, available_for_referral, profile_photo, resume, is_private, created_at,
                           headline, tagline, location, work_history, education, projects,
                           certifications, accomplishments, career_goals, personal_info,
                           account_type, college, degree_pursuing, graduation_year, cgpa, internships, profile_setup_done
                           FROM users WHERE id=?''', (session['user_id'],)).fetchone()
    u = dict(user)
    u['connections_count'] = conn.execute(
        '''SELECT COUNT(*) as c FROM connections WHERE (sender_id=? OR receiver_id=?) AND status='accepted' ''',
        (session['user_id'], session['user_id'])).fetchone()['c']
    u['posts_count'] = conn.execute('SELECT COUNT(*) as c FROM posts WHERE user_id=?', (session['user_id'],)).fetchone()['c']
    conn.close()
    # Parse JSON fields
    for f in ['work_history', 'education', 'projects', 'certifications', 'accomplishments', 'personal_info', 'internships']:
        try:
            u[f] = json.loads(u[f]) if u[f] else None
        except:
            u[f] = None
    return jsonify(u)

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data = request.json
        conn = get_db()
        # Serialize JSON fields
        for f in ['work_history', 'education', 'projects', 'certifications', 'accomplishments', 'personal_info', 'internships']:
            if f in data and isinstance(data[f], (list, dict)):
                data[f] = json.dumps(data[f])
        conn.execute('''UPDATE users SET username=?, company=?, role=?, experience=?,
                        bio=?, skills=?, linkedin=?, github=?, available_for_referral=?, is_private=?,
                        headline=?, tagline=?, location=?, work_history=?, education=?, projects=?,
                        certifications=?, accomplishments=?, career_goals=?, personal_info=?,
                        account_type=?, college=?, degree_pursuing=?, graduation_year=?, cgpa=?,
                        internships=?, profile_setup_done=?
                        WHERE id=?''',
                     (data.get('username'), data.get('company'), data.get('role'),
                      data.get('experience', 0), data.get('bio'), data.get('skills'),
                      data.get('linkedin'), data.get('github'),
                      1 if data.get('available_for_referral') else 0,
                      1 if data.get('is_private') else 0,
                      data.get('headline'), data.get('tagline'), data.get('location'),
                      data.get('work_history'), data.get('education'), data.get('projects'),
                      data.get('certifications'), data.get('accomplishments'),
                      data.get('career_goals'), data.get('personal_info'),
                      data.get('account_type'), data.get('college'), data.get('degree_pursuing'),
                      data.get('graduation_year'), data.get('cgpa'),
                      data.get('internships'), 1 if data.get('profile_setup_done') else 0,
                      session['user_id']))
        conn.commit()
        conn.close()
        session['username'] = data.get('username')
        return jsonify({'message': 'Profile updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile/photo', methods=['POST'])
def upload_photo():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    conn = get_db()
    conn.execute('UPDATE users SET profile_photo=? WHERE id=?', (data.get('photo'), session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Photo updated'})

@app.route('/api/profile/resume', methods=['POST'])
def upload_resume():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('resume'):
        return jsonify({'error': 'No resume data'}), 400
    conn = get_db()
    conn.execute('UPDATE users SET resume=? WHERE id=?', (data['resume'], session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Resume uploaded'})

@app.route('/api/resume/request/<int:owner_id>', methods=['POST'])
def request_resume(owner_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    existing = conn.execute('SELECT id FROM resume_requests WHERE requester_id=? AND owner_id=?',
                            (session['user_id'], owner_id)).fetchone()
    if existing:
        conn.close()
        return jsonify({'message': 'Already requested'}), 200
    conn.execute('INSERT INTO resume_requests (requester_id, owner_id) VALUES (?,?)',
                 (session['user_id'], owner_id))
    create_notification(owner_id, session['user_id'], 'resume_request',
                       f'{session["username"]} requested access to your resume', conn)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Request sent'})

@app.route('/api/resume/respond/<int:request_id>', methods=['POST'])
def respond_resume_request(request_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    action = data.get('action', 'approve')
    conn = get_db()
    req = conn.execute('SELECT * FROM resume_requests WHERE id=? AND owner_id=?',
                       (request_id, session['user_id'])).fetchone()
    if not req:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    new_status = 'approved' if action == 'approve' else 'denied'
    conn.execute('UPDATE resume_requests SET status=? WHERE id=?', (new_status, request_id))
    if action == 'approve':
        create_notification(req['requester_id'], session['user_id'], 'resume_approved',
                           f'{session["username"]} approved your resume request', conn)
    conn.commit()
    conn.close()
    return jsonify({'message': f'Request {new_status}'})

@app.route('/api/resume/requests', methods=['GET'])
def get_resume_requests():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    reqs = conn.execute('''SELECT rr.*, u.username FROM resume_requests rr
                           JOIN users u ON rr.requester_id=u.id
                           WHERE rr.owner_id=? ORDER BY rr.created_at DESC''',
                        (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in reqs])

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    user = conn.execute('''SELECT id, username, company, role, experience, bio, skills,
                           linkedin, github, available_for_referral, profile_photo, resume, is_private,
                           headline, tagline, location, work_history, education, projects,
                           certifications, accomplishments, career_goals, account_type, college,
                           degree_pursuing, graduation_year, cgpa, internships
                           FROM users WHERE id=?''', (user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    u = dict(user)
    is_connected = conn.execute(
        '''SELECT id FROM connections WHERE ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) AND status='accepted' ''',
        (session['user_id'], user_id, user_id, session['user_id'])).fetchone()
    u['is_connected'] = bool(is_connected)
    conn_row = conn.execute(
        '''SELECT status, sender_id FROM connections WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)''',
        (session['user_id'], user_id, user_id, session['user_id'])).fetchone()
    u['connection_status'] = conn_row['status'] if conn_row else None
    u['is_sender'] = conn_row['sender_id'] == session['user_id'] if conn_row else False
    u['connections_count'] = conn.execute(
        '''SELECT COUNT(*) as c FROM connections WHERE (sender_id=? OR receiver_id=?) AND status='accepted' ''',
        (user_id, user_id)).fetchone()['c']
    u['posts_count'] = conn.execute('SELECT COUNT(*) as c FROM posts WHERE user_id=?', (user_id,)).fetchone()['c']

    # Resume access check
    resume_req = conn.execute('SELECT status FROM resume_requests WHERE requester_id=? AND owner_id=?',
                              (session['user_id'], user_id)).fetchone()
    u['resume_access'] = resume_req['status'] if resume_req else None
    u['has_resume'] = bool(user['resume'])
    # Don't send actual resume data unless approved
    if not (resume_req and resume_req['status'] == 'approved'):
        u['resume'] = None

    is_self = user_id == session['user_id']
    if user['is_private'] and not is_connected and not is_self:
        u['bio'] = None; u['skills'] = None; u['linkedin'] = None; u['github'] = None
        u['resume'] = None; u['experience'] = None; u['work_history'] = None
        u['education'] = None; u['projects'] = None; u['certifications'] = None
        u['accomplishments'] = None; u['internships'] = None
        u['is_restricted'] = True
    else:
        u['is_restricted'] = False
        for f in ['work_history', 'education', 'projects', 'certifications', 'accomplishments', 'internships']:
            try:
                u[f] = json.loads(u[f]) if u[f] else []
            except:
                u[f] = []

    conn.close()
    return jsonify(u)

@app.route('/api/users/<int:user_id>/posts', methods=['GET'])
def get_user_posts(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    posts = conn.execute('''SELECT p.*, u.username, u.company, u.role
                            FROM posts p JOIN users u ON p.user_id=u.id
                            WHERE p.user_id=? ORDER BY p.created_at DESC''', (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(p) for p in posts])

@app.route('/api/users/<int:user_id>/connections', methods=['GET'])
def get_user_connections(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    conns = conn.execute('''SELECT u.id, u.username, u.company, u.role
                            FROM connections c
                            JOIN users u ON (CASE WHEN c.sender_id=? THEN c.receiver_id ELSE c.sender_id END)=u.id
                            WHERE (c.sender_id=? OR c.receiver_id=?) AND c.status='accepted' ''',
                         (user_id, user_id, user_id)).fetchall()
    conn.close()
    return jsonify([dict(c) for c in conns])

# ─── CONNECTIONS ───

@app.route('/api/people', methods=['GET'])
def get_people():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    users = conn.execute('''SELECT id, username, company, role, skills, available_for_referral, profile_photo
                            FROM users WHERE id!=? ORDER BY username''', (session['user_id'],)).fetchall()
    result = []
    for u in users:
        ud = dict(u)
        c = conn.execute('''SELECT status, sender_id FROM connections
                            WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)''',
                         (session['user_id'], u['id'], u['id'], session['user_id'])).fetchone()
        if c:
            ud['connection_status'] = c['status']
            ud['is_sender'] = c['sender_id'] == session['user_id']
        else:
            ud['connection_status'] = None
            ud['is_sender'] = False
        result.append(ud)
    conn.close()
    return jsonify(result)

@app.route('/api/connections/send', methods=['POST'])
def send_connection():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    receiver_id = data.get('receiver_id')
    if not receiver_id:
        return jsonify({'error': 'Receiver required'}), 400
    conn = get_db()
    existing = conn.execute('''SELECT id FROM connections
                               WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)''',
                            (session['user_id'], receiver_id, receiver_id, session['user_id'])).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Request already exists'}), 400
    conn.execute('INSERT INTO connections (sender_id, receiver_id) VALUES (?,?)',
                 (session['user_id'], receiver_id))
    conn.commit()
    conn.close()
    create_notification(receiver_id, session['user_id'], 'connection_request',
                       f'{session["username"]} sent you a connection request')
    return jsonify({'message': 'Connection request sent'})

@app.route('/api/connections/respond', methods=['POST'])
def respond_connection():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    connection_id = data.get('connection_id')
    sender_id = data.get('sender_id')
    action = data.get('action')
    conn = get_db()

    if connection_id:
        c = conn.execute('SELECT * FROM connections WHERE id=? AND receiver_id=?',
                         (connection_id, session['user_id'])).fetchone()
    elif sender_id:
        c = conn.execute('SELECT * FROM connections WHERE sender_id=? AND receiver_id=? AND status=?',
                         (sender_id, session['user_id'], 'pending')).fetchone()
    else:
        conn.close()
        return jsonify({'error': 'Missing connection_id or sender_id'}), 400

    if not c:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    if action == 'accept':
        conn.execute('UPDATE connections SET status=? WHERE id=?', ('accepted', c['id']))
        create_notification(c['sender_id'], session['user_id'], 'connection_accepted',
                           f'{session["username"]} accepted your connection request', conn)
    else:
        conn.execute('UPDATE connections SET status=? WHERE id=?', ('rejected', c['id']))
    conn.commit()
    conn.close()
    return jsonify({'message': f'Connection {action}ed'})

@app.route('/api/connections/pending', methods=['GET'])
def pending_connections():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    reqs = conn.execute('''SELECT c.id, c.sender_id, u.username, u.company, u.role, c.created_at
                           FROM connections c JOIN users u ON c.sender_id=u.id
                           WHERE c.receiver_id=? AND c.status='pending'
                           ORDER BY c.created_at DESC''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in reqs])

@app.route('/api/connections', methods=['GET'])
def get_connections():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    conns = conn.execute('''SELECT u.id, u.username, u.company, u.role, u.profile_photo
                            FROM connections c
                            JOIN users u ON (CASE WHEN c.sender_id=? THEN c.receiver_id ELSE c.sender_id END)=u.id
                            WHERE (c.sender_id=? OR c.receiver_id=?) AND c.status='accepted'
                            ORDER BY u.username''',
                         (session['user_id'], session['user_id'], session['user_id'])).fetchall()
    conn.close()
    return jsonify([dict(c) for c in conns])

# ─── REFERRAL ENGINE ───

@app.route('/api/referral-requests', methods=['GET'])
def get_referral_requests():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    requests_list = conn.execute('''SELECT r.*, u.username, u.company as seeker_company, u.role as seeker_role, u.skills as seeker_skills
                                    FROM referral_requests r
                                    JOIN users u ON r.seeker_id = u.id
                                    WHERE r.status = 'open'
                                    ORDER BY r.created_at DESC''').fetchall()
    conn.close()
    return jsonify([dict(r) for r in requests_list])

@app.route('/api/referral-requests', methods=['POST'])
def create_referral_request():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('target_company') or not data.get('target_role'):
        return jsonify({'error': 'Company and role required'}), 400

    conn = get_db()
    conn.execute('''INSERT INTO referral_requests (seeker_id, target_company, target_role, skills_required, description)
                    VALUES (?,?,?,?,?)''',
                 (session['user_id'], data['target_company'], data['target_role'],
                  data.get('skills_required', ''), data.get('description', '')))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Referral request posted'}), 201

@app.route('/api/referral-requests/<int:req_id>/accept', methods=['POST'])
def accept_referral(req_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    req = conn.execute('SELECT * FROM referral_requests WHERE id=?', (req_id,)).fetchone()
    if not req:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    conn.execute('UPDATE referral_requests SET status=?, matched_referrer_id=? WHERE id=?',
                 ('accepted', session['user_id'], req_id))
    create_notification(req['seeker_id'], session['user_id'], 'referral_accepted',
                       f'{session["username"]} accepted your referral request for {req["target_company"]}', conn)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Referral accepted'})

@app.route('/api/referral-requests/<int:req_id>/reject', methods=['POST'])
def reject_referral(req_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    conn.execute('UPDATE referral_requests SET status=? WHERE id=? AND matched_referrer_id=?',
                 ('open', req_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Referral released'})

@app.route('/api/my-referral-requests', methods=['GET'])
def my_referral_requests():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    reqs = conn.execute('''SELECT r.*, u.username as referrer_name
                           FROM referral_requests r
                           LEFT JOIN users u ON r.matched_referrer_id = u.id
                           WHERE r.seeker_id=?
                           ORDER BY r.created_at DESC''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in reqs])

@app.route('/api/referral-matches/<int:req_id>', methods=['GET'])
def get_matches(req_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    req = conn.execute('SELECT * FROM referral_requests WHERE id=?', (req_id,)).fetchone()
    if not req:
        conn.close()
        return jsonify([])

    users = conn.execute('''SELECT id, username, company, role, experience, skills, available_for_referral
                            FROM users WHERE available_for_referral=1 AND id!=?''',
                         (session['user_id'],)).fetchall()
    conn.close()

    req_skills = set((req['skills_required'] or '').lower().split(','))
    req_company = (req['target_company'] or '').lower()
    matches = []
    for u in users:
        score = 0
        u_skills = set((u['skills'] or '').lower().split(','))
        skill_overlap = req_skills & u_skills
        score += len(skill_overlap) * 50
        if (u['company'] or '').lower() == req_company:
            score += 30
        if score > 0:
            m = dict(u)
            m['match_score'] = score
            matches.append(m)
    matches.sort(key=lambda x: x['match_score'], reverse=True)
    return jsonify(matches[:20])

# ─── POSTS (PROBLEM-SOLUTION FEED) ───

@app.route('/api/posts/public', methods=['GET'])
def get_public_posts():
    conn = get_db()
    posts = conn.execute('''SELECT p.*, u.username, u.company, u.role,
               (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count
               FROM posts p JOIN users u ON p.user_id=u.id
               ORDER BY p.created_at DESC LIMIT 10''').fetchall()
    result = []
    for p in posts:
        pd = dict(p)
        pd['reactions'] = {}
        result.append(pd)
    conn.close()
    return jsonify(result)

@app.route('/api/posts', methods=['GET'])
def get_posts():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    sort = request.args.get('sort', 'latest')
    tag = request.args.get('tag', '')
    conn = get_db()

    query = '''SELECT p.*, u.username, u.company, u.role, u.profile_photo,
               (SELECT vote FROM post_votes WHERE post_id=p.id AND user_id=?) as user_vote,
               (SELECT reaction FROM post_votes WHERE post_id=p.id AND user_id=?) as user_reaction,
               (SELECT COUNT(*) FROM bookmarks WHERE post_id=p.id AND user_id=?) as user_bookmarked,
               (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count
               FROM posts p JOIN users u ON p.user_id=u.id'''
    params = [session['user_id'], session['user_id'], session['user_id']]

    if tag:
        query += " WHERE p.tags LIKE ?"
        params.append(f'%{tag}%')

    if sort == 'trending':
        query += " ORDER BY (p.upvotes - p.downvotes) DESC, p.created_at DESC"
    elif sort == 'useful':
        query += " ORDER BY p.upvotes DESC"
    else:
        query += " ORDER BY p.created_at DESC"

    posts = conn.execute(query, params).fetchall()
    result = []
    for p in posts:
        pd = dict(p)
        pd['is_own'] = bool(p['user_id'] == session['user_id'])
        reactions = conn.execute('SELECT reaction, COUNT(*) as cnt FROM post_votes WHERE post_id=? AND vote=1 GROUP BY reaction', (p['id'],)).fetchall()
        pd['reactions'] = {r['reaction']: r['cnt'] for r in reactions}
        result.append(pd)
    conn.close()
    return jsonify(result)

@app.route('/api/posts', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('title') or not data.get('content'):
        return jsonify({'error': 'Title and content required'}), 400

    conn = get_db()
    conn.execute('INSERT INTO posts (user_id, type, title, content, tags) VALUES (?,?,?,?,?)',
                 (session['user_id'], data.get('type', 'problem'), data['title'],
                  data['content'], data.get('tags', '')))
    post_id = get_last_id(conn, 'posts')
    # Notify all connections about the new post
    friends = conn.execute(
        '''SELECT CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END as friend_id
           FROM connections WHERE (sender_id=? OR receiver_id=?) AND status='accepted' ''',
        (session['user_id'], session['user_id'], session['user_id'])).fetchall()
    for f in friends:
        create_notification(f['friend_id'], session['user_id'], 'new_post',
                           f'Your friend {session["username"]} shared a new post, react to it!',
                           conn, related_id=post_id)
    process_mentions(data['content'], session['user_id'], session['username'], 'a post', conn, related_id=post_id)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Post created', 'post_id': post_id}), 201

@app.route('/api/posts/<int:post_id>', methods=['GET'])
def get_single_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    post = conn.execute('''SELECT p.*, u.username, u.company, u.role, u.profile_photo,
               (SELECT vote FROM post_votes WHERE post_id=p.id AND user_id=?) as user_vote,
               (SELECT reaction FROM post_votes WHERE post_id=p.id AND user_id=?) as user_reaction,
               (SELECT COUNT(*) FROM bookmarks WHERE post_id=p.id AND user_id=?) as user_bookmarked,
               (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count
               FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=?''',
               (session['user_id'], session['user_id'], session['user_id'], post_id)).fetchone()
    if not post:
        conn.close()
        return jsonify({'error': 'Post not found'}), 404
    pd = dict(post)
    reactions = conn.execute('SELECT reaction, COUNT(*) as cnt FROM post_votes WHERE post_id=? AND vote=1 GROUP BY reaction', (post_id,)).fetchall()
    pd['reactions'] = {r['reaction']: r['cnt'] for r in reactions}
    conn.close()
    return jsonify(pd)

@app.route('/api/posts/<int:post_id>/vote', methods=['POST'])
def vote_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    vote = data.get('vote', 0)  # 1 or -1
    reaction = data.get('reaction', 'like')  # like, love, wow, super, clap
    conn = get_db()

    existing = conn.execute('SELECT vote, reaction FROM post_votes WHERE post_id=? AND user_id=?',
                            (post_id, session['user_id'])).fetchone()
    if existing:
        if existing['vote'] == vote and (vote == -1 or existing['reaction'] == reaction):
            conn.execute('DELETE FROM post_votes WHERE post_id=? AND user_id=?', (post_id, session['user_id']))
            if vote == 1:
                conn.execute('UPDATE posts SET upvotes = upvotes - 1 WHERE id=?', (post_id,))
            else:
                conn.execute('UPDATE posts SET downvotes = downvotes - 1 WHERE id=?', (post_id,))
        else:
            old_vote = existing['vote']
            conn.execute('UPDATE post_votes SET vote=?, reaction=? WHERE post_id=? AND user_id=?', (vote, reaction if vote == 1 else 'dislike', post_id, session['user_id']))
            if old_vote != vote:
                if vote == 1:
                    conn.execute('UPDATE posts SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id=?', (post_id,))
                else:
                    conn.execute('UPDATE posts SET downvotes = downvotes + 1, upvotes = upvotes - 1 WHERE id=?', (post_id,))
    else:
        conn.execute('INSERT INTO post_votes (post_id, user_id, vote, reaction) VALUES (?,?,?,?)', (post_id, session['user_id'], vote, reaction if vote == 1 else 'dislike'))
        if vote == 1:
            conn.execute('UPDATE posts SET upvotes = upvotes + 1 WHERE id=?', (post_id,))
        else:
            conn.execute('UPDATE posts SET downvotes = downvotes + 1 WHERE id=?', (post_id,))

    conn.commit()
    post = conn.execute('SELECT upvotes, downvotes FROM posts WHERE id=?', (post_id,)).fetchone()
    # Get reaction counts
    reactions = conn.execute('SELECT reaction, COUNT(*) as cnt FROM post_votes WHERE post_id=? AND vote=1 GROUP BY reaction', (post_id,)).fetchall()
    conn.close()
    return jsonify({'upvotes': post['upvotes'], 'downvotes': post['downvotes'], 'reactions': {r['reaction']: r['cnt'] for r in reactions}})

@app.route('/api/posts/<int:post_id>/bookmark', methods=['POST'])
def toggle_bookmark(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    existing = conn.execute('SELECT id FROM bookmarks WHERE post_id=? AND user_id=?',
                            (post_id, session['user_id'])).fetchone()
    if existing:
        conn.execute('DELETE FROM bookmarks WHERE post_id=? AND user_id=?', (post_id, session['user_id']))
        msg = 'Bookmark removed'
    else:
        conn.execute('INSERT INTO bookmarks (post_id, user_id) VALUES (?,?)', (post_id, session['user_id']))
        msg = 'Bookmarked'
    conn.commit()
    conn.close()
    return jsonify({'message': msg})

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    post = conn.execute('SELECT * FROM posts WHERE id=? AND user_id=?', (post_id, session['user_id'])).fetchone()
    if not post:
        conn.close()
        return jsonify({'error': 'Post not found or not yours'}), 404
    conn.execute('DELETE FROM comments WHERE post_id=?', (post_id,))
    conn.execute('DELETE FROM post_votes WHERE post_id=?', (post_id,))
    conn.execute('DELETE FROM bookmarks WHERE post_id=?', (post_id,))
    conn.execute('DELETE FROM posts WHERE id=?', (post_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Post deleted'})

@app.route('/api/posts/<int:post_id>/comments', methods=['GET'])
def get_comments(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    comments = conn.execute('''SELECT c.*, u.username, u.company
                               FROM comments c JOIN users u ON c.user_id=u.id
                               WHERE c.post_id=? ORDER BY c.created_at ASC''', (post_id,)).fetchall()
    result = []
    for c in comments:
        cd = dict(c)
        cd['is_own'] = bool(c['user_id'] == session['user_id'])
        likes = conn.execute('SELECT COUNT(*) as cnt FROM comment_votes WHERE comment_id=? AND vote=1', (c['id'],)).fetchone()['cnt']
        dislikes = conn.execute('SELECT COUNT(*) as cnt FROM comment_votes WHERE comment_id=? AND vote=-1', (c['id'],)).fetchone()['cnt']
        user_vote = conn.execute('SELECT vote FROM comment_votes WHERE comment_id=? AND user_id=?', (c['id'], session['user_id'])).fetchone()
        cd['likes'] = likes
        cd['dislikes'] = dislikes
        cd['user_vote'] = user_vote['vote'] if user_vote else 0
        # Get reply info
        if c['parent_id']:
            parent = conn.execute('SELECT u.username FROM comments cm JOIN users u ON cm.user_id=u.id WHERE cm.id=?', (c['parent_id'],)).fetchone()
            cd['reply_to_username'] = parent['username'] if parent else None
        result.append(cd)
    conn.close()
    return jsonify(result)

@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
def add_comment(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('content'):
        return jsonify({'error': 'Comment cannot be empty'}), 400
    conn = get_db()
    conn.execute('INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?,?,?,?)',
                 (post_id, session['user_id'], data['content'], data.get('parent_id')))
    conn.commit()
    post = conn.execute('SELECT user_id, title FROM posts WHERE id=?', (post_id,)).fetchone()
    if post and post['user_id'] != session['user_id']:
        create_notification(post['user_id'], session['user_id'], 'comment',
                           f'{session["username"]} commented on your post: {post["title"][:40]}', conn, related_id=post_id)
    process_mentions(data['content'], session['user_id'], session['username'], 'a comment', conn, related_id=post_id)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Comment added'}), 201

@app.route('/api/comments/<int:comment_id>/vote', methods=['POST'])
def vote_comment(comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    vote = data.get('vote', 1)
    conn = get_db()
    existing = conn.execute('SELECT id, vote FROM comment_votes WHERE comment_id=? AND user_id=?',
                            (comment_id, session['user_id'])).fetchone()
    if existing:
        if existing['vote'] == vote:
            conn.execute('DELETE FROM comment_votes WHERE id=?', (existing['id'],))
        else:
            conn.execute('UPDATE comment_votes SET vote=? WHERE id=?', (vote, existing['id']))
    else:
        conn.execute('INSERT INTO comment_votes (comment_id, user_id, vote) VALUES (?,?,?)',
                     (comment_id, session['user_id'], vote))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Voted'})

@app.route('/api/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    comment = conn.execute('SELECT * FROM comments WHERE id=? AND user_id=?', (comment_id, session['user_id'])).fetchone()
    if not comment:
        conn.close()
        return jsonify({'error': 'Comment not found or not yours'}), 404
    conn.execute('DELETE FROM comment_votes WHERE comment_id=?', (comment_id,))
    conn.execute('DELETE FROM comments WHERE parent_id=?', (comment_id,))
    conn.execute('DELETE FROM comments WHERE id=?', (comment_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Comment deleted'})

# ─── MESSAGES ───

@app.route('/api/messages/<int:user_id>', methods=['GET'])
def get_messages(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    msgs = conn.execute('''SELECT m.*, u.username as sender_name, u.profile_photo as sender_photo
                           FROM messages m JOIN users u ON m.sender_id=u.id
                           WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
                           ORDER BY m.created_at ASC''',
                        (session['user_id'], user_id, user_id, session['user_id'])).fetchall()
    result = []
    for m in msgs:
        md = dict(m)
        # Get reactions for this message
        reactions = conn.execute('SELECT reaction, COUNT(*) as cnt FROM message_reactions WHERE message_id=? GROUP BY reaction', (m['id'],)).fetchall()
        md['reactions'] = {r['reaction']: r['cnt'] for r in reactions}
        my_reaction = conn.execute('SELECT reaction FROM message_reactions WHERE message_id=? AND user_id=?', (m['id'], session['user_id'])).fetchone()
        md['my_reaction'] = my_reaction['reaction'] if my_reaction else None
        # Get reply-to message preview
        if m['reply_to_id']:
            reply = conn.execute('SELECT id, message, sender_id FROM messages WHERE id=?', (m['reply_to_id'],)).fetchone()
            if reply:
                reply_user = conn.execute('SELECT username FROM users WHERE id=?', (reply['sender_id'],)).fetchone()
                md['reply_to'] = {'id': reply['id'], 'message': reply['message'][:80], 'username': reply_user['username'] if reply_user else ''}
        result.append(md)
    conn.execute('UPDATE messages SET read=1 WHERE sender_id=? AND receiver_id=?',
                 (user_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify(result)

@app.route('/api/messages', methods=['POST'])
def send_message():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('receiver_id') or not data.get('message'):
        return jsonify({'error': 'Receiver and message required'}), 400
    conn = get_db()
    conn.execute('INSERT INTO messages (sender_id, receiver_id, message, reply_to_id) VALUES (?,?,?,?)',
                 (session['user_id'], data['receiver_id'], data['message'], data.get('reply_to_id')))
    conn.commit()
    conn.close()
    create_notification(data['receiver_id'], session['user_id'], 'message',
                       f'New message from {session["username"]}')
    return jsonify({'message': 'Sent'})

@app.route('/api/messages/<int:msg_id>/react', methods=['POST'])
def react_message(msg_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    reaction = data.get('reaction', '')
    conn = get_db()
    if not reaction:
        conn.execute('DELETE FROM message_reactions WHERE message_id=? AND user_id=?', (msg_id, session['user_id']))
    else:
        existing = conn.execute('SELECT id FROM message_reactions WHERE message_id=? AND user_id=?', (msg_id, session['user_id'])).fetchone()
        if existing:
            conn.execute('UPDATE message_reactions SET reaction=? WHERE message_id=? AND user_id=?', (reaction, msg_id, session['user_id']))
        else:
            conn.execute('INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?,?,?)', (msg_id, session['user_id'], reaction))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Reacted'})

@app.route('/api/messages/<int:msg_id>/star', methods=['POST'])
def star_message(msg_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    msg = conn.execute('SELECT starred FROM messages WHERE id=?', (msg_id,)).fetchone()
    if msg:
        new_val = 0 if msg['starred'] else 1
        conn.execute('UPDATE messages SET starred=? WHERE id=?', (new_val, msg_id))
        conn.commit()
    conn.close()
    return jsonify({'starred': bool(new_val) if msg else False})

# ─── STORIES ───

@app.route('/api/stories', methods=['GET'])
def get_stories():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    stories = conn.execute('''SELECT s.*, u.username, u.profile_photo
                              FROM stories s JOIN users u ON s.user_id=u.id
                              WHERE s.created_at >= datetime('now', '-24 hours')
                              ORDER BY s.created_at DESC''').fetchall()
    # Group by user
    grouped = {}
    for s in stories:
        uid = s['user_id']
        if uid not in grouped:
            grouped[uid] = {'user_id': uid, 'username': s['username'], 'profile_photo': s['profile_photo'], 'is_own': bool(uid == session['user_id']), 'stories': []}
        sd = dict(s)
        sd['is_own'] = bool(uid == session['user_id'])
        reactions = conn.execute('SELECT reaction, COUNT(*) as cnt FROM story_reactions WHERE story_id=? GROUP BY reaction', (s['id'],)).fetchall()
        sd['reactions'] = {r['reaction']: r['cnt'] for r in reactions}
        user_reaction = conn.execute('SELECT reaction FROM story_reactions WHERE story_id=? AND user_id=?', (s['id'], session['user_id'])).fetchone()
        sd['user_reaction'] = user_reaction['reaction'] if user_reaction else None
        view_count = conn.execute('SELECT COUNT(*) as cnt FROM story_views WHERE story_id=?', (s['id'],)).fetchone()['cnt']
        sd['view_count'] = view_count
        if uid == session['user_id']:
            viewers = conn.execute('''SELECT sv.user_id, u.username, sv.created_at
                                      FROM story_views sv JOIN users u ON sv.user_id=u.id
                                      WHERE sv.story_id=? ORDER BY sv.created_at DESC''', (s['id'],)).fetchall()
            sd['viewers'] = [dict(v) for v in viewers]
            reactors = conn.execute('''SELECT sr.user_id, u.username, sr.reaction
                                       FROM story_reactions sr JOIN users u ON sr.user_id=u.id
                                       WHERE sr.story_id=?''', (s['id'],)).fetchall()
            sd['reactors'] = [dict(r) for r in reactors]
        else:
            sd['viewers'] = []
            sd['reactors'] = []
        grouped[uid]['stories'].append(sd)
    conn.close()
    return jsonify(list(grouped.values()))

@app.route('/api/stories', methods=['POST'])
def create_story():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('content') and not data.get('media_url'):
        return jsonify({'error': 'Content or media required'}), 400
    story_type = 'media' if data.get('media_url') else 'text'
    conn = get_db()
    conn.execute('INSERT INTO stories (user_id, content, type, bg_color, media_url, expires_at) VALUES (?,?,?,?,?,datetime("now","+24 hours"))',
                 (session['user_id'], data.get('content', ''), story_type, data.get('bg_color', '#7c3aed'), data.get('media_url')))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Story posted'}), 201

@app.route('/api/stories/<int:story_id>', methods=['DELETE'])
def delete_story(story_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    story = conn.execute('SELECT * FROM stories WHERE id=? AND user_id=?', (story_id, session['user_id'])).fetchone()
    if not story:
        conn.close()
        return jsonify({'error': 'Story not found or not yours'}), 404
    conn.execute('DELETE FROM stories WHERE id=?', (story_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Story deleted'})

@app.route('/api/stories/<int:story_id>/react', methods=['POST'])
def react_to_story(story_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    reaction = data.get('reaction', '❤️')
    conn = get_db()
    story = conn.execute('SELECT user_id FROM stories WHERE id=?', (story_id,)).fetchone()
    existing = conn.execute('SELECT id, reaction FROM story_reactions WHERE story_id=? AND user_id=?',
                            (story_id, session['user_id'])).fetchone()
    is_new = False
    if existing:
        if existing['reaction'] == reaction:
            conn.execute('DELETE FROM story_reactions WHERE id=?', (existing['id'],))
        else:
            conn.execute('UPDATE story_reactions SET reaction=? WHERE id=?', (reaction, existing['id']))
            is_new = True
    else:
        conn.execute('INSERT INTO story_reactions (story_id, user_id, reaction) VALUES (?,?,?)',
                     (story_id, session['user_id'], reaction))
        is_new = True
    # Send reaction as chat message and notification
    if is_new and story and story['user_id'] != session['user_id']:
        conn.execute('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?,?,?)',
                     (session['user_id'], story['user_id'], f'Reacted {reaction} to your story'))
        create_notification(story['user_id'], session['user_id'], 'story_reaction',
                           f'{session["username"]} reacted {reaction} to your story', conn)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Reacted'})

@app.route('/api/stories/<int:story_id>/reply', methods=['POST'])
def reply_to_story(story_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    message = data.get('message', '').strip()
    if not message:
        return jsonify({'error': 'Message required'}), 400
    conn = get_db()
    story = conn.execute('SELECT user_id FROM stories WHERE id=?', (story_id,)).fetchone()
    if not story:
        conn.close()
        return jsonify({'error': 'Story not found'}), 404
    conn.execute('INSERT INTO story_replies (story_id, user_id, message) VALUES (?,?,?)',
                 (story_id, session['user_id'], message))
    # Send reply as chat message
    if story['user_id'] != session['user_id']:
        conn.execute('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?,?,?)',
                     (session['user_id'], story['user_id'], f'📖 Story reply: {message}'))
        create_notification(story['user_id'], session['user_id'], 'story_reply',
                           f'{session["username"]} replied to your story: {message[:50]}', conn)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Reply sent'})

@app.route('/api/stories/<int:story_id>/view', methods=['POST'])
def view_story(story_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        if USE_PG:
            conn.execute('INSERT INTO story_views (story_id, user_id) VALUES (?,?) ON CONFLICT DO NOTHING',
                         (story_id, session['user_id']))
        else:
            conn.execute('INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?,?)',
                         (story_id, session['user_id']))
        conn.commit()
    except:
        pass
    conn.close()
    return jsonify({'message': 'Viewed'})

# ─── REPORTS ───

@app.route('/api/reports', methods=['POST'])
def submit_report():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('reason'):
        return jsonify({'error': 'Reason required'}), 400
    conn = get_db()
    conn.execute('''INSERT INTO reports (reporter_id, reported_user_id, reported_post_id, reported_message_id, reason, details)
                    VALUES (?,?,?,?,?,?)''',
                 (session['user_id'], data.get('reported_user_id'), data.get('reported_post_id'),
                  data.get('reported_message_id'), data['reason'], data.get('details', '')))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Report submitted. We will review it shortly.'}), 201

@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    convos = conn.execute('''SELECT DISTINCT
                             CASE WHEN sender_id=? THEN receiver_id ELSE sender_id END as other_id
                             FROM messages WHERE sender_id=? OR receiver_id=?''',
                          (session['user_id'], session['user_id'], session['user_id'])).fetchall()
    result = []
    for c in convos:
        user = conn.execute('SELECT id, username, company, role, profile_photo FROM users WHERE id=?',
                            (c['other_id'],)).fetchone()
        if user:
            last_msg = conn.execute('''SELECT message, created_at, read, sender_id FROM messages
                                       WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
                                       ORDER BY created_at DESC LIMIT 1''',
                                    (session['user_id'], c['other_id'], c['other_id'], session['user_id'])).fetchone()
            unread = conn.execute('SELECT COUNT(*) as cnt FROM messages WHERE sender_id=? AND receiver_id=? AND read=0',
                                  (c['other_id'], session['user_id'])).fetchone()['cnt']
            u = dict(user)
            u['last_message'] = last_msg['message'] if last_msg else ''
            u['last_time'] = last_msg['created_at'] if last_msg else ''
            u['unread'] = unread
            result.append(u)
    conn.close()
    result.sort(key=lambda x: x['last_time'], reverse=True)
    return jsonify(result)

# ─── NOTIFICATIONS ───

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    notifs = conn.execute('''SELECT n.*, u.username,
                             (SELECT status FROM connections WHERE sender_id=n.from_user_id AND receiver_id=n.user_id) as conn_status
                             FROM notifications n
                             LEFT JOIN users u ON n.from_user_id=u.id
                             WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50''',
                          (session['user_id'],)).fetchall()
    result = []
    for n in notifs:
        nd = dict(n)
        # For message notifications, related_id is the sender
        if n['type'] == 'message' and not nd.get('related_id'):
            nd['related_id'] = n['from_user_id']
        result.append(nd)
    conn.execute('UPDATE notifications SET read=1 WHERE user_id=?', (session['user_id'],))
    conn.commit()
    conn.close()
    return jsonify(result)

@app.route('/api/notifications/unread-count', methods=['GET'])
def unread_count():
    if 'user_id' not in session:
        return jsonify({'count': 0})
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND read=0',
                         (session['user_id'],)).fetchone()['c']
    conn.close()
    return jsonify({'count': count})

# ─── SEARCH ───

@app.route('/api/search', methods=['GET'])
def search():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    q = request.args.get('q', '').lower()
    if len(q) < 2:
        return jsonify({'users': [], 'posts': []})
    conn = get_db()
    users = conn.execute('''SELECT id, username, company, role, skills, available_for_referral
                            FROM users WHERE id!=? AND (LOWER(username) LIKE ? OR LOWER(company) LIKE ?
                            OR LOWER(skills) LIKE ? OR LOWER(role) LIKE ?) LIMIT 15''',
                         (session['user_id'], f'%{q}%', f'%{q}%', f'%{q}%', f'%{q}%')).fetchall()
    posts = conn.execute('''SELECT p.id, p.title, p.tags, u.username FROM posts p
                            JOIN users u ON p.user_id=u.id
                            WHERE LOWER(p.title) LIKE ? OR LOWER(p.tags) LIKE ? LIMIT 15''',
                         (f'%{q}%', f'%{q}%')).fetchall()
    conn.close()
    return jsonify({'users': [dict(u) for u in users], 'posts': [dict(p) for p in posts]})

# ─── COMPANY REVIEWS ───

@app.route('/api/company-reviews', methods=['GET'])
def get_reviews():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    company = request.args.get('company', '')
    conn = get_db()
    if company:
        reviews = conn.execute('''SELECT * FROM company_reviews WHERE LOWER(company)=LOWER(?)
                                  ORDER BY created_at DESC''', (company,)).fetchall()
    else:
        reviews = conn.execute('SELECT * FROM company_reviews ORDER BY created_at DESC LIMIT 50').fetchall()
    conn.close()
    return jsonify([dict(r) for r in reviews])

@app.route('/api/company-reviews', methods=['POST'])
def add_review():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('company'):
        return jsonify({'error': 'Company name required'}), 400
    conn = get_db()
    conn.execute('''INSERT INTO company_reviews (user_id, company, salary_range, work_life_rating,
                    manager_rating, work_pressure, review, anonymous)
                    VALUES (?,?,?,?,?,?,?,?)''',
                 (session['user_id'], data['company'], data.get('salary_range'),
                  data.get('work_life_rating'), data.get('manager_rating'),
                  data.get('work_pressure'), data.get('review'), 1 if data.get('anonymous', True) else 0))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Review submitted'}), 201

# ─── GROUP CHAT ───

@app.route('/api/groups', methods=['GET'])
def get_groups():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    groups = conn.execute('''SELECT g.*, gm.role,
               (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
               FROM groups g JOIN group_members gm ON g.id=gm.group_id
               WHERE gm.user_id=? ORDER BY g.created_at DESC''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(g) for g in groups])

@app.route('/api/groups', methods=['POST'])
def create_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if not data.get('name'):
        return jsonify({'error': 'Group name required'}), 400
    conn = get_db()
    conn.execute('INSERT INTO groups (name, description, creator_id, avatar_color) VALUES (?,?,?,?)',
                 (data['name'], data.get('description', ''), session['user_id'], data.get('avatar_color', '#7c3aed')))
    gid = get_last_id(conn, 'groups')
    conn.execute('INSERT INTO group_members (group_id, user_id, role) VALUES (?,?,?)', (gid, session['user_id'], 'admin'))
    # Add initial members
    for uid in data.get('member_ids', []):
        try:
            conn.execute('INSERT INTO group_members (group_id, user_id) VALUES (?,?)', (gid, uid))
        except:
            pass
    conn.commit()
    conn.close()
    return jsonify({'message': 'Group created', 'group_id': gid}), 201

@app.route('/api/groups/<int:group_id>', methods=['GET'])
def get_group_detail(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    group = conn.execute('SELECT * FROM groups WHERE id=?', (group_id,)).fetchone()
    if not group:
        conn.close()
        return jsonify({'error': 'Group not found'}), 404
    members = conn.execute('''SELECT gm.*, u.username, u.company, u.role as user_role
                              FROM group_members gm JOIN users u ON gm.user_id=u.id
                              WHERE gm.group_id=?''', (group_id,)).fetchall()
    conn.close()
    gd = dict(group)
    gd['members'] = [dict(m) for m in members]
    return jsonify(gd)

@app.route('/api/groups/<int:group_id>/messages', methods=['GET'])
def get_group_messages(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    msgs = conn.execute('''SELECT gm.*, u.username
                           FROM group_messages gm JOIN users u ON gm.sender_id=u.id
                           WHERE gm.group_id=? AND (gm.scheduled_at IS NULL OR gm.scheduled_at <= datetime('now'))
                           ORDER BY gm.created_at ASC''', (group_id,)).fetchall()
    conn.close()
    return jsonify([dict(m) for m in msgs])

@app.route('/api/groups/<int:group_id>/messages', methods=['POST'])
def send_group_message(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    msg = data.get('message', '').strip()
    if not msg and not data.get('file_url'):
        return jsonify({'error': 'Message required'}), 400
    conn = get_db()
    conn.execute('INSERT INTO group_messages (group_id, sender_id, message, file_url, file_name, reply_to_id, scheduled_at) VALUES (?,?,?,?,?,?,?)',
                 (group_id, session['user_id'], msg, data.get('file_url'), data.get('file_name'),
                  data.get('reply_to_id'), data.get('scheduled_at')))
    if msg:
        process_mentions(msg, session['user_id'], session['username'], 'a group chat', conn)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Sent'}), 201

@app.route('/api/groups/<int:group_id>/members', methods=['POST'])
def add_group_member(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    conn = get_db()
    # Check if admin
    role = conn.execute('SELECT role FROM group_members WHERE group_id=? AND user_id=?', (group_id, session['user_id'])).fetchone()
    if not role or role['role'] != 'admin':
        conn.close()
        return jsonify({'error': 'Only admins can add members'}), 403
    count = conn.execute('SELECT COUNT(*) as cnt FROM group_members WHERE group_id=?', (group_id,)).fetchone()['cnt']
    if count >= 150:
        conn.close()
        return jsonify({'error': 'Group is full (max 150)'}), 400
    try:
        conn.execute('INSERT INTO group_members (group_id, user_id) VALUES (?,?)', (group_id, data['user_id']))
        conn.commit()
    except:
        conn.close()
        return jsonify({'error': 'Already a member'}), 400
    conn.close()
    return jsonify({'message': 'Member added'})

@app.route('/api/groups/<int:group_id>/leave', methods=['POST'])
def leave_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    conn.execute('DELETE FROM group_members WHERE group_id=? AND user_id=?', (group_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Left group'})

@app.route('/api/groups/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
def remove_group_member(group_id, user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    role = conn.execute('SELECT role FROM group_members WHERE group_id=? AND user_id=?', (group_id, session['user_id'])).fetchone()
    if not role or role['role'] != 'admin':
        conn.close()
        return jsonify({'error': 'Only admins can remove members'}), 403
    conn.execute('DELETE FROM group_members WHERE group_id=? AND user_id=?', (group_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Member removed'})

# ─── CHAT FILE UPLOAD & SCHEDULED MESSAGES ───

@app.route('/api/messages/send', methods=['POST'])
def send_message_enhanced():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    msg = data.get('message', '').strip()
    if not msg and not data.get('file_url'):
        return jsonify({'error': 'Message or file required'}), 400
    conn = get_db()
    conn.execute('INSERT INTO messages (sender_id, receiver_id, message, reply_to_id, file_url, file_name, scheduled_at) VALUES (?,?,?,?,?,?,?)',
                 (session['user_id'], data['receiver_id'], msg, data.get('reply_to_id'),
                  data.get('file_url'), data.get('file_name'), data.get('scheduled_at')))
    if msg:
        process_mentions(msg, session['user_id'], session['username'], 'a chat', conn)
    conn.commit()
    conn.close()
    if not data.get('scheduled_at'):
        create_notification(data['receiver_id'], session['user_id'], 'message',
                           f'New message from {session["username"]}')
    return jsonify({'message': 'Sent'}), 201

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
