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

## 🏗️ Architecture

Ace Mail v2 uses a **reverse proxy architecture** for production deployment:

```
Internet → Nginx (Reverse Proxy) → Frontend (React) + Backend (Flask API)
                                → Database (PostgreSQL)
```

**Key Components:**
- **Nginx**: Main entry point, routes `/api/*` to backend, everything else to frontend
- **Frontend**: React TypeScript application (served by nginx)
- **Backend**: Flask API with PostgreSQL database
- **Database**: PostgreSQL with pgvector extension

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
Create a `.env.local` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://ace_user:ace_password@db:5432/ace_mail_db
POSTGRES_USER=ace_user
POSTGRES_PASSWORD=ace_password
POSTGRES_DB=ace_mail_db

# Security Keys
JWT_SECRET_KEY=ac000a815d43044ba18cf2efe0e7c3d0d7ced61feb2e5ae8a6426aba3c7c6336
FERNET_KEY=5845VP4K1x_SRgKUjDT4j6zbQPTg0D6AofQGwNV38Ss=

# Flask Configuration
FLASK_APP=app.py
FLASK_ENV=development
```

### 3. Generate Your Own Security Keys
```bash
# Generate JWT Secret (recommended)
python -c "import secrets; print(secrets.token_hex(32))"

# Generate Fernet Key (required)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Replace the keys in your `.env.local` file with the generated values.

### 4. Start with Docker (Local Development)
```bash
docker-compose up -d
```

### 5. Access the Application
- **Main Application**: http://localhost:9247 (via nginx)
- **Direct Frontend**: http://localhost:3000 (development)
- **Direct Backend API**: http://localhost:5001 (development)

## 📱 Usage

### First Time Setup
1. **Visit** http://localhost:9247
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
docker-compose up
```

### Project Structure
```
ace-mail-v2/
├── backend/                 # Python Flask API
│   ├── app.py              # Main application
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Backend container
│   └── migrations/         # Database migrations
├── frontend/               # React TypeScript app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── lib/           # Utilities
│   ├── Dockerfile          # Frontend container
│   └── package.json       # Node dependencies
├── nginx.conf              # Nginx reverse proxy config
├── nginx.Dockerfile        # Nginx container
├── docker-compose.yml      # Production setup
├── .env.local             # Environment variables
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

## 🚀 Production Deployment

### 🐳 Docker Compose Deployment

For basic production deployment:

```bash
# Clone repository
git clone https://github.com/yourusername/ace-mail-v2.git
cd ace-mail-v2

# Create production environment file
cp .env.local .env

# Update environment variables for production
nano .env

# Deploy
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

**Access your application at**: `http://your-server:9247`

### ☁️ Coolify Deployment (Recommended)

Coolify provides automated deployments with SSL, domain management, and monitoring.

#### **Step 1: Prepare Your Repository**

1. **Push your code** to GitHub/GitLab
2. **Ensure your `.env.local`** file has production values:

```env
# Strong production passwords
DATABASE_URL=postgresql://ace_user:STRONG_PASSWORD_HERE@db:5432/ace_mail_db
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
JWT_SECRET_KEY=YOUR_GENERATED_JWT_SECRET_HERE
FERNET_KEY=YOUR_GENERATED_FERNET_KEY_HERE

# Flask settings
FLASK_APP=app.py
FLASK_ENV=production
```

#### **Step 2: Create Application in Coolify**

1. **Go to Coolify Dashboard** → Projects → Your Project
2. **Click "New Resource"** → Application
3. **Select "Docker Compose"** as build pack
4. **Connect your Git repository**
5. **Set the following configuration**:
   - **Name**: `ace-mail-app`
   - **Build Pack**: `Docker Compose`
   - **Docker Compose Location**: `/docker-compose.yml`
   - **Base Directory**: `/` (root)

#### **Step 3: Configure Domains**

**🚨 CRITICAL: Use Nginx as Your Main Entry Point**

In Coolify, you should configure domains as follows:

1. **Nginx Service**: 
   - Domain: `https://acemail.yourdomain.com` (your main app URL)
   - Port: `9247`
   - This is your **primary application domain**

2. **Frontend Service**: 
   - **No domain needed** (accessed through nginx)
   - Or use for development: `https://acemail-frontend.yourdomain.com`

3. **Backend Service**: 
   - **No domain needed** (accessed through nginx)
   - Or use for API testing: `https://acemail-api.yourdomain.com`

#### **Step 4: Configure Environment Variables**

In Coolify → Your Application → Environment Variables:

```env
DATABASE_URL=postgresql://ace_user:your_strong_password@db:5432/ace_mail_db
POSTGRES_USER=ace_user
POSTGRES_PASSWORD=your_strong_password
POSTGRES_DB=ace_mail_db
JWT_SECRET_KEY=your_generated_jwt_secret
FERNET_KEY=your_generated_fernet_key
FLASK_APP=app.py
FLASK_ENV=production
```

#### **Step 5: Deploy**

1. **Click "Deploy"** in Coolify
2. **Monitor the build process** in the Logs tab
3. **Wait for all services to start**:
   - ✅ Database (PostgreSQL)
   - ✅ Backend (Flask API)
   - ✅ Frontend (React App)
   - ✅ Nginx (Reverse Proxy)

#### **Step 6: Access Your Application**

Visit your nginx domain: `https://acemail.yourdomain.com`

**How it works:**
```
https://acemail.yourdomain.com/          → Nginx → React Frontend
https://acemail.yourdomain.com/api/*     → Nginx → Flask Backend
```

### 🔧 Advanced Coolify Configuration

#### **Custom Start Command**

If needed, you can set a custom start command in Coolify:
```bash
docker compose up -d
```

#### **Health Checks**

Configure health checks for each service:
- **Backend**: `http://backend:5000/`
- **Frontend**: `http://frontend:3000/`
- **Nginx**: `http://nginx:80/health`

#### **Resource Limits**

Set appropriate resource limits in Coolify:
```yaml
# Example resource allocation
Database: 1GB RAM, 0.5 CPU
Backend: 512MB RAM, 0.3 CPU
Frontend: 256MB RAM, 0.2 CPU
Nginx: 128MB RAM, 0.1 CPU
```

### 🐛 Troubleshooting Deployment

#### **Common Issues**

**1. Port Conflicts**
```
Error: Bind for 0.0.0.0:80 failed: port is already allocated
```
**Solution**: The nginx service uses port 9247 to avoid conflicts.

**2. API Connection Failed**
```
Login failed. Please check your credentials and server settings.
```
**Solution**: Ensure you're using the **nginx domain** as your main URL, not the frontend domain directly.

**3. Database Connection Failed**
```
FATAL: database "ace_mail_db" does not exist
```
**Solution**: Check environment variables and ensure DATABASE_URL is correct.

**4. Nginx Configuration Issues**
```
nginx: [emerg] host not found in upstream "backend"
```
**Solution**: Ensure all services are in the same Docker network and use service names.

#### **Debug Commands**

```bash
# View all service logs
docker-compose logs

# View specific service logs
docker-compose logs nginx
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db

# Check service status
docker-compose ps

# Restart specific service
docker-compose restart nginx

# Check nginx configuration
docker-compose exec nginx nginx -t
```

#### **Coolify Specific Debugging**

1. **Check Application Logs** in Coolify Dashboard
2. **Verify Domain Configuration** - ensure nginx has the main domain
3. **Check Resource Usage** - ensure sufficient memory/CPU
4. **Review Environment Variables** - verify all required variables are set
5. **Test Each Service** individually using their direct domains (if configured)

### 🔒 Security Considerations

#### **Production Environment Variables**
- **Never commit** `.env` files to version control
- **Use strong passwords** for database and JWT secrets
- **Rotate secrets** regularly
- **Use HTTPS** in production (Coolify handles this automatically)

#### **Firewall Configuration**
If deploying on your own server:
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP (redirects to HTTPS)
ufw allow 443   # HTTPS
ufw allow 9247  # Application port (if not behind reverse proxy)
```

#### **SSL/TLS**
Coolify automatically provides SSL certificates via Let's Encrypt. For manual deployments, consider:
- **Certbot** for Let's Encrypt certificates
- **Cloudflare** for additional security and caching
- **Load balancer** with SSL termination

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
- **Nginx** for reverse proxy
- **Tailwind CSS** for styling
- **Framer Motion** for animations

---

**Built with ❤️ for modern email management** 