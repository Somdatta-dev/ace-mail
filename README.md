# Ace Mail v2 📧

A modern, professional email client built with React, TypeScript, Python Flask, and PostgreSQL. Features a Gmail-inspired interface with full email management capabilities.

![Ace Mail Interface](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Ace+Mail+v2)

## ✨ Features

### 📧 **Core Email Functionality**
- **Multi-provider support** - Gmail, Outlook, Zoho, and custom IMAP/SMTP
- **Full email sync** with IMAP integration
- **Send emails** with SMTP support
- **File attachments** - Send and receive files
- **HTML & Plain text** email composition
- **Auto-sync** - Real-time email updates every 30 seconds

### 💬 **Email Actions**
- **Compose** - Create new emails with rich editor
- **Reply** - Quick reply to emails
- **Reply All** - Reply to all recipients
- **Forward** - Forward emails with original content
- **Search** - Real-time search across all email content
- **Star/Unstar** - Mark important emails
- **Read/Unread** status management

### 🎨 **Modern Interface**
- **Gmail-inspired design** - Professional and familiar
- **Dark/Light mode** - Automatic theme switching
- **Responsive layout** - Works on all devices
- **Smooth animations** - Framer Motion powered
- **Sidebar navigation** - Easy folder switching
- **Email preview** - Quick content preview

### 🔒 **Security & Privacy**
- **Encrypted passwords** - Fernet encryption for stored credentials
- **JWT authentication** - Secure session management
- **HTTPS support** - Secure communication
- **Local data storage** - Your data stays with you

## 🚀 Quick Start

### Prerequisites
- **Docker** and **Docker Compose**
- **Git**
- **Node.js 19+** (for development)
- **Python 3.12+** (for development)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ace-mail-v2.git
cd ace-mail-v2
```

### 2. Setup Environment Variables
Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://acemail_user:secure_password@db:5432/acemail_db
POSTGRES_USER=acemail_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=acemail_db

# Security
JWT_SECRET_KEY=your-super-secret-jwt-key-change-me-in-production
FERNET_KEY=your-32-byte-base64-encoded-fernet-key

# Email Settings (Optional - can be configured per user)
DEFAULT_IMAP_HOST=imap.gmail.com
DEFAULT_SMTP_HOST=smtp.gmail.com
```

### 3. Generate Fernet Key
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Copy the output to your `.env` file as `FERNET_KEY`.

### 4. Start with Docker
```bash
docker-compose up -d
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **Database**: localhost:5432

## 📱 Usage

### First Time Setup
1. **Visit** http://localhost:3000
2. **Login** with your email provider credentials
3. **Select provider** (Gmail, Outlook, Zoho, or Custom)
4. **Sync emails** using the sync button
5. **Start managing** your emails!

### Supported Email Providers

| Provider | IMAP Host | SMTP Host | Port | Authentication |
|----------|-----------|-----------|------|----------------|
| **Gmail** | imap.gmail.com | smtp.gmail.com | 587/465 | App Passwords |
| **Outlook** | outlook.office365.com | smtp.office365.com | 587 | OAuth2/Password |
| **Zoho** | imappro.zoho.com | smtppro.zoho.com | 465 | Password |
| **Custom** | Your IMAP server | Your SMTP server | Custom | Password |

### Gmail Setup
For Gmail users, you'll need to:
1. **Enable 2-Factor Authentication**
2. **Generate an App Password** in Google Account settings
3. **Use the App Password** instead of your regular password

## 🛠️ Development

### Local Development Setup
```bash
# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install

# Start development servers
cd ..
docker-compose -f docker-compose.dev.yml up
```

### Project Structure
```
ace-mail-v2/
├── backend/                 # Python Flask API
│   ├── app.py              # Main application
│   ├── requirements.txt    # Python dependencies
│   └── migrations/         # Database migrations
├── frontend/               # React TypeScript app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── lib/           # Utilities
│   └── package.json       # Node dependencies
├── docker-compose.yml     # Production setup
└── README.md
```

### API Endpoints
- `POST /api/login` - User authentication
- `GET /api/profile` - User profile
- `GET /api/emails` - Fetch emails
- `POST /api/emails/sync` - Full email sync
- `POST /api/emails/sync-new` - Incremental sync
- `POST /api/emails/send` - Send email
- `GET /api/emails/search` - Search emails
- `GET /api/folders` - Get IMAP folders

## 🚀 Deployment

### Docker Production Deployment
```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables for Production
```env
# Set strong passwords
POSTGRES_PASSWORD=your-strong-database-password
JWT_SECRET_KEY=your-256-bit-secret-key
FERNET_KEY=your-fernet-encryption-key

# Database URL
DATABASE_URL=postgresql://acemail_user:your-strong-password@db:5432/acemail_db
```

### Cloud Deployment (AWS/Digital Ocean/etc.)
1. **Push to GitHub**
2. **Clone on server**
3. **Set environment variables**
4. **Run docker-compose up -d**
5. **Configure reverse proxy** (Nginx/Apache)
6. **Setup SSL certificates** (Let's Encrypt)

## 🔧 Configuration

### Email Provider Settings
The application auto-configures common providers, but you can customize:

```python
# Custom IMAP/SMTP settings
CUSTOM_IMAP_HOST=mail.yourcompany.com
CUSTOM_IMAP_PORT=993
CUSTOM_SMTP_HOST=mail.yourcompany.com
CUSTOM_SMTP_PORT=587
```

### Feature Toggles
```env
# Auto-sync interval (milliseconds)
AUTO_SYNC_INTERVAL=30000

# Email fetch limit
EMAIL_FETCH_LIMIT=100

# Attachment size limit (bytes)
MAX_ATTACHMENT_SIZE=25000000
```

## 🐛 Troubleshooting

### Common Issues

**1. Cannot connect to email provider**
- Check your email credentials
- For Gmail, use App Passwords
- Verify IMAP/SMTP settings

**2. Database connection failed**
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify database credentials

**3. Frontend won't load**
- Check if backend is running on port 5001
- Verify CORS settings
- Check browser console for errors

**4. Emails not syncing**
- Check email provider settings
- Verify IMAP connection
- Look at backend logs for errors

### Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

### Development Guidelines
- **Follow** TypeScript/Python best practices
- **Write** tests for new features
- **Update** documentation
- **Use** conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React** and **TypeScript** for the frontend
- **Flask** and **Python** for the backend
- **PostgreSQL** for data storage
- **Docker** for containerization
- **Tailwind CSS** for styling
- **Framer Motion** for animations


---

**Built with ❤️ for modern email management** 