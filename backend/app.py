import os
import imaplib
import smtplib
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import create_access_token, JWTManager, jwt_required, get_jwt_identity
from cryptography.fernet import Fernet
from pgvector.sqlalchemy import VECTOR
from sqlalchemy import Index # For GIN/GiST indexes on VECTOR
import datetime # For received_date
# import email as email_parser # No longer using the standard email library directly for parsing full messages
# from email.header import decode_header # mailparser handles this
# from email.utils import parsedate_to_datetime # mailparser handles this
import mailparser # Import the new mail-parser library
from email_analyzer import analyze_email_content
from ai_service import AIService

# Initialize AI service
ai_service = AIService()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database Configuration
# Use DATABASE_URL from environment if available (set by Docker Compose)
# Fallback to a local SQLite DB for local CLI commands like `flask db init` if DATABASE_URL is not set.
# This avoids errors when running `flask db init` locally without the full Docker environment.
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # Default to a local SQLite file if DATABASE_URL is not set (e.g., for local `flask db init`)
    # This file won't actually be used by the Dockerized app.
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'local_dev.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# JWT Configuration
# IMPORTANT: Change this in production to a strong, random secret and store it securely (e.g., env variable)
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-jwt-key-change-me')
jwt = JWTManager(app)

# --- JWT Error Handlers ---
@jwt.unauthorized_loader
def unauthorized_callback(error_string):
    app.logger.error(f"JWT Unauthorized: {error_string}")
    return jsonify(msg="Missing Authorization Header or invalid token."), 401

@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    app.logger.error(f"JWT Invalid Token: {error_string}")
    return jsonify(msg="Signature verification failed or token is invalid."), 422 # Or 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    app.logger.info(f"JWT Expired Token. Header: {jwt_header}, Payload: {jwt_payload}")
    return jsonify(msg="Token has expired."), 401

@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_payload):
    app.logger.warn(f"JWT Revoked Token. Header: {jwt_header}, Payload: {jwt_payload}")
    return jsonify(msg="Token has been revoked."), 401

@jwt.needs_fresh_token_loader
def needs_fresh_token_callback(jwt_header, jwt_payload):
    app.logger.info(f"JWT Needs Fresh Token. Header: {jwt_header}, Payload: {jwt_payload}")
    return jsonify(msg="Fresh token required."), 401

db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Fernet Encryption Setup
# The FERNET_KEY must be set as an environment variable
FERNET_KEY = os.environ.get('FERNET_KEY')
if not FERNET_KEY:
    # In a real app, you might want to raise an error or log a critical warning
    # For this exercise, we'll print a warning. The app will likely fail if encryption is attempted.
    print("WARNING: FERNET_KEY environment variable not set. Encryption/decryption will fail.")
    # For local dev where it might not be set, and we are not immediately using encryption,
    # we can let it pass for now, but any operation requiring Fernet will fail.
    # Consider raising an ImproperlyConfigured error for production.
    fernet = None
else:
    print(f"DEBUG: Using FERNET_KEY: {FERNET_KEY[:10]}... (length: {len(FERNET_KEY)})")
    fernet = Fernet(FERNET_KEY) # FERNET_KEY is already a base64-encoded string

# --- Database Models ---
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    # Store the encrypted email provider password.
    # Using LargeBinary to store bytes, or Text to store base64 encoded string.
    # Let's use Text for easier debugging/viewing if needed, and store base64 encoded.
    encrypted_email_password = db.Column(db.Text, nullable=True)
    
    # Store provider details
    email_provider_type = db.Column(db.String(50), nullable=True) # e.g., 'gmail', 'custom_imap'
    imap_host = db.Column(db.String(255), nullable=True)
    imap_port = db.Column(db.Integer, nullable=True)
    smtp_host = db.Column(db.String(255), nullable=True)
    smtp_port = db.Column(db.Integer, nullable=True)
    # Consider adding fields for SSL/TLS for IMAP/SMTP as well if needed

    # Relationship to emails
    emails = db.relationship('Email', backref='user', lazy=True)

    def __repr__(self):
        return f'<User {self.email}>'

    def set_email_password(self, password_to_encrypt):
        if fernet and password_to_encrypt:
            self.encrypted_email_password = fernet.encrypt(password_to_encrypt.encode()).decode() # Store as string
        elif not fernet:
            print("ERROR: Fernet key not configured. Cannot encrypt password.")
            # Handle this error appropriately - perhaps raise an exception or prevent saving

    def get_decrypted_email_password(self):
        if fernet and self.encrypted_email_password:
            try:
                return fernet.decrypt(self.encrypted_email_password.encode()).decode()
            except Exception as e:
                print(f"Error decrypting password for user {self.email}: {e}")
                return None
        elif not fernet:
            print("ERROR: Fernet key not configured. Cannot decrypt password.")
        return None


class Email(db.Model):
    __tablename__ = 'emails'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message_id_header = db.Column(db.String(255), nullable=True, index=True) # From 'Message-ID' header - removed unique=True
    subject = db.Column(db.Text, nullable=True)
    sender = db.Column(db.String(255), nullable=True)
    recipient = db.Column(db.Text, nullable=True) # Could be 'To', 'Cc', 'Bcc'
    body_preview = db.Column(db.Text, nullable=True) # Short preview of email content
    body_full = db.Column(db.Text, nullable=True) # Full email content
    body_html = db.Column(db.Text, nullable=True) # HTML content if available
    body_text = db.Column(db.Text, nullable=True) # Plain text content if available
    folder = db.Column(db.String(50), nullable=True, default='inbox') # inbox, sent, drafts, etc.
    received_date = db.Column(db.DateTime, nullable=True, index=True, default=datetime.datetime.utcnow)
    imap_uid = db.Column(db.Integer, nullable=True, index=True) # UID from IMAP server for a specific mailbox
    # Email analysis fields
    email_type = db.Column(db.String(50), nullable=True, default='unknown') # Type: plain_text, simple_html, rich_html, designed, newsletter
    should_preserve_layout = db.Column(db.Boolean, nullable=True, default=False) # Whether to preserve original layout
    should_force_left_align = db.Column(db.Boolean, nullable=True, default=True) # Whether to force left alignment
    cleaned_html = db.Column(db.Text, nullable=True) # Cleaned HTML for simple emails
    # For vector embeddings (e.g., 384 dimensions for sentence-transformers/all-MiniLM-L6-v2)
    # The number of dimensions depends on the embedding model you choose.
    embedding = db.Column(VECTOR(384), nullable=True)

    def __repr__(self):
        return f'<Email {self.id} Subject: {self.subject}>'

# Example of creating a GiST index for the vector column if you plan to use KNN searches
# This needs to be done after the table is created, often in a migration or manually.
# Index('idx_emails_embedding', Email.embedding, postgresql_using='gist')


# --- Routes ---
@app.route('/')
def hello_world():
    return 'Hello from Flask Backend!'

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()

    email = data.get('email')
    password = data.get('password')
    provider = data.get('provider') # e.g., 'gmail', 'zoho_custom', 'custom_imap'
    
    # For providers like 'custom_imap' or 'zoho_custom', these will be provided by the frontend
    # For predefined ones, we'll set defaults.
    req_imap_host = data.get('imap_server')
    req_imap_port = data.get('imap_port')
    req_smtp_host = data.get('smtp_server') # Not used yet, but good to get if provided
    req_smtp_port = data.get('smtp_port')   # Not used yet

    if not email or not password:
        return jsonify({'status': 'error', 'message': 'Email and password are required'}), 400

    # Determine IMAP/SMTP settings based on provider
    # These will be stored on the User model
    user_imap_host = None
    user_imap_port = 993 # Default IMAPS
    user_smtp_host = None
    user_smtp_port = 465 # Default SMTPS / 587 for TLS

    if provider == 'gmail':
        user_imap_host = 'imap.gmail.com'
        user_smtp_host = 'smtp.gmail.com' # Standard Gmail SMTP
        user_smtp_port = 587 # TLS
    elif provider == 'outlook':
        user_imap_host = 'outlook.office365.com'
        user_smtp_host = 'smtp.office365.com'
        user_smtp_port = 587 # TLS
    elif provider == 'zoho_personal':
        user_imap_host = 'imappro.zoho.com'
        user_smtp_host = 'smtppro.zoho.com'
        user_smtp_port = 465 # SSL
    elif provider == 'zoho_custom' or provider == 'custom_imap':
        user_imap_host = req_imap_host
        if req_imap_port: user_imap_port = int(req_imap_port)
        user_smtp_host = req_smtp_host
        if req_smtp_port: user_smtp_port = int(req_smtp_port)
        if not user_imap_host: # Crucial for custom setups
             return jsonify({'status': 'error', 'message': 'IMAP server details are required for this provider'}), 400
    else:
        return jsonify({'status': 'error', 'message': f'Unknown provider: {provider}'}), 400
        
    if not user_imap_host: # Should be set by now if provider was valid
         return jsonify({'status': 'error', 'message': 'IMAP server configuration failed for provider.'}), 400

    # Simplified IMAP connection test with determined settings
    try:
        mail = imaplib.IMAP4_SSL(user_imap_host, int(user_imap_port))
        mail.login(email, password)
        mail.logout() # Logout after successful login test

        # IMAP login successful, now find or create user in DB
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                email_provider_type=provider,
                imap_host=user_imap_host,
                imap_port=user_imap_port,
                smtp_host=user_smtp_host,
                smtp_port=user_smtp_port
            )
            user.set_email_password(password)
            db.session.add(user)
            message = 'Login successful. New user created and credentials stored.'
        else:
            # User exists, update their details and encrypted password
            user.email_provider_type = provider
            user.imap_host = user_imap_host
            user.imap_port = user_imap_port
            user.smtp_host = user_smtp_host
            user.smtp_port = user_smtp_port
            user.set_email_password(password)
            message = 'Login successful. Welcome back! Credentials and settings updated.'
        
        db.session.commit()
        
        # Create an access token for the user
        # Using user.email as identity for debugging JWT issues
        access_token = create_access_token(identity=user.email)
        app.logger.debug(f"Generated access token for identity: {user.email}")
        return jsonify({'status': 'success', 'message': message, 'access_token': access_token})

    except imaplib.IMAP4.error as e:
        return jsonify({'status': 'error', 'message': f'IMAP login failed: {str(e)}'}), 401
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}), 500

@app.route('/api/profile', methods=['GET'])
@jwt_required()
def profile():
    current_user_email = get_jwt_identity() # Expecting email as identity now
    app.logger.debug(f"/api/profile: JWT identity (email): {current_user_email}, Type: {type(current_user_email)}")
    
    user = User.query.filter_by(email=current_user_email).first()
    if not user:
        app.logger.warn(f"/api/profile: User not found for email {current_user_email}")
        return jsonify({"msg": "User not found"}), 404
    
    user_data = {'id': user.id, 'email': user.email}
    app.logger.debug(f"/api/profile: Returning user data: {user_data}")
    
    try:
        response = jsonify({'status': 'success', 'user': user_data})
        app.logger.debug(f"/api/profile: jsonify successful, response: {response.get_data(as_text=True)}")
        return response, 200
    except Exception as e:
        app.logger.error(f"/api/profile: Error during jsonify: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'Error creating profile response'}), 500


# decode_email_header might not be needed if mailparser handles it well,
# but can be kept if specific header decoding is still required outside mailparser's scope.
# For now, let's assume mailparser's .subject, .from_, .to attributes are sufficiently decoded.
# def decode_email_header(header_string):
#     if not header_string:
#         return ""
#     decoded_parts = decode_header(header_string)
#     header_text_parts = []
#     for part, charset in decoded_parts:
#         if isinstance(part, bytes):
#             try:
#                 header_text_parts.append(part.decode(charset or 'utf-8', 'ignore'))
#             except LookupError: # charset not found
#                 header_text_parts.append(part.decode('utf-8', 'ignore')) # fallback
#         else:
#             header_text_parts.append(part)
#     return "".join(header_text_parts)

@app.route('/api/emails/sync', methods=['POST'])
@jwt_required()
def sync_emails():
    current_user_email = get_jwt_identity() # Expecting email
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    decrypted_password = user.get_decrypted_email_password()
    if not decrypted_password:
        return jsonify({"status": "error", "message": "Could not retrieve email password. Fernet key issue or no password stored."}), 500
    
    if not user.imap_host or not user.imap_port:
        return jsonify({"status": "error", "message": "User IMAP configuration is missing."}), 500

    # Get folder parameter from request (default to 'inbox')
    folder = request.json.get('folder', 'inbox') if request.json else 'inbox'
    limit = request.json.get('limit', 100) if request.json else 100

    try:
        mail = imaplib.IMAP4_SSL(user.imap_host, user.imap_port)
        mail.login(user.email, decrypted_password)
        
        # Map folder names to IMAP folder names
        folder_mapping = {
            'inbox': 'INBOX',
            'sent': 'Sent',  # Gmail uses '[Gmail]/Sent Mail', others might use 'Sent'
            'drafts': 'Drafts',
            'trash': 'Trash',
            'spam': 'Spam'
        }
        
        imap_folder = folder_mapping.get(folder, 'INBOX')
        
        # Try different common folder names for sent items
        if folder == 'sent':
            possible_sent_folders = ['[Gmail]/Sent Mail', 'Sent', 'Sent Items', 'INBOX.Sent', '[Gmail]/Sent', 'Sent Messages']
            folder_found = False
            
            # First, let's list all available folders for debugging
            try:
                status, folders = mail.list()
                if status == 'OK':
                    app.logger.info(f"Available IMAP folders: {[f.decode() for f in folders]}")
            except Exception as e:
                app.logger.error(f"Failed to list IMAP folders: {e}")
            
            for sent_folder in possible_sent_folders:
                try:
                    status, data = mail.select(sent_folder, readonly=True)
                    if status == 'OK':
                        imap_folder = sent_folder
                        folder_found = True
                        app.logger.info(f"Successfully selected sent folder: {sent_folder}")
                        break
                except Exception as e:
                    app.logger.debug(f"Failed to select folder {sent_folder}: {e}")
                    continue
            
            if not folder_found:
                app.logger.warning(f"No sent folder found, falling back to INBOX")
                mail.select('INBOX', readonly=True)  # Fallback to inbox
                # Return early with a message about no sent folder
                mail.logout()
                return jsonify({'status': 'warning', 'message': 'No sent folder found. Please check your email provider settings.'})
        else:
            try:
                status, data = mail.select(imap_folder, readonly=True)
                if status == 'OK':
                    app.logger.info(f"Successfully selected folder: {imap_folder}")
                else:
                    app.logger.warning(f"Failed to select folder {imap_folder}, falling back to INBOX")
                    mail.select('INBOX', readonly=True)
            except Exception as e:
                app.logger.error(f"Error selecting folder {imap_folder}: {e}, falling back to INBOX")
                mail.select('INBOX', readonly=True)

        # Fetch UIDs of, for example, the last 10 emails
        status, messages = mail.uid('search', None, 'ALL')
        if status != 'OK':
            mail.logout()
            return jsonify({"status": "error", "message": "Failed to search emails."}), 500
        
        email_uids_bytes = messages[0].split()
        fetched_count = 0
        new_emails_count = 0
        
        # Fetch all UIDs (or limit based on request parameters)
        for uid_bytes in reversed(email_uids_bytes[-limit:]): # Get UIDs based on limit
            uid_str = uid_bytes.decode()
            # Check if email with this UID already exists for this user in ANY folder
            # This prevents re-adding emails that have been moved to trash/archive
            existing_email_by_uid = Email.query.filter_by(user_id=user.id, imap_uid=int(uid_str)).first()
            if existing_email_by_uid:
                # If the email exists but in a different folder (e.g., moved to trash),
                # only re-add it if it's been permanently deleted and we're syncing a different folder
                if existing_email_by_uid.folder != folder:
                    # Check if the existing email is in trash/archive and we're syncing inbox
                    if existing_email_by_uid.folder in ['trash', 'archive'] and folder == 'inbox':
                        app.logger.debug(f"Skipping UID {uid_str}, email exists in {existing_email_by_uid.folder} folder")
                        continue
                    # Check if existing email is in inbox and we're syncing trash (shouldn't happen normally)
                    elif existing_email_by_uid.folder == 'inbox' and folder in ['trash', 'archive']:
                        app.logger.debug(f"Skipping UID {uid_str}, email exists in inbox folder")
                        continue
                app.logger.debug(f"Skipping UID {uid_str} in folder {folder}, already exists in {existing_email_by_uid.folder}.")
                continue

            # Fetch email envelope (headers) and body structure
            # Fetch the full RFC822 message for mail-parser
            status, msg_data = mail.uid('fetch', uid_bytes, '(RFC822)')
            if status != 'OK' or not msg_data or msg_data[0] is None:
                app.logger.error(f"Failed to fetch full email for UID {uid_str}")
                continue

            # msg_data[0] is a tuple where the second element is the raw email bytes
            if isinstance(msg_data[0], tuple):
                raw_email_bytes = msg_data[0][1]
                try:
                    parsed_mail = mailparser.parse_from_bytes(raw_email_bytes)
                except Exception as e_parse:
                    app.logger.error(f"Mail parsing failed for UID {uid_str}: {e_parse}")
                    continue
                
                app.logger.debug(f"Parsed mail object for UID {uid_str}: Subject type {type(parsed_mail.subject)}, From type {type(parsed_mail.from_)}, To type {type(parsed_mail.to)}")

                try:
                    subject = str(parsed_mail.subject) if parsed_mail.subject is not None else "[No Subject]"
                except Exception as e_subj:
                    app.logger.error(f"Error processing subject for UID {uid_str}: {e_subj}")
                    subject = "[Error Processing Subject]"
                app.logger.debug(f"UID {uid_str} - Subject: '{subject}' (Type: {type(subject)})")

                sender_info = parsed_mail.from_[0] if parsed_mail.from_ and isinstance(parsed_mail.from_, list) and len(parsed_mail.from_) > 0 else None
                sender = str(sender_info[1]) if sender_info and len(sender_info) > 1 and sender_info[1] else "Unknown Sender"
                app.logger.debug(f"UID {uid_str} - Sender: '{sender}' (Type: {type(sender)})")
                
                recipient_list_tuples = parsed_mail.to if parsed_mail.to and isinstance(parsed_mail.to, list) else []
                recipient_emails = [str(r[1]) for r in recipient_list_tuples if r and len(r) > 1 and r[1]]
                recipient = ", ".join(recipient_emails) if recipient_emails else "Unknown Recipient"
                app.logger.debug(f"UID {uid_str} - Recipient: '{recipient}' (Type: {type(recipient)})")
                
                message_id_val = parsed_mail.message_id
                message_id_header = str(message_id_val.strip('<>')) if message_id_val else None
                app.logger.debug(f"UID {uid_str} - Message-ID: '{message_id_header}' (Type: {type(message_id_header)})")

                received_dt = parsed_mail.date
                if not isinstance(received_dt, datetime.datetime):
                    app.logger.warn(f"Parsed date is not a datetime object for UID {uid_str}: {received_dt} (Type: {type(received_dt)})")
                    received_dt = datetime.datetime.now(datetime.timezone.utc)
                app.logger.debug(f"UID {uid_str} - Received Date: {received_dt} (Type: {type(received_dt)})")

                # Extract email body content
                body_preview = "Could not load preview."
                body_full = ""
                body_text = ""
                body_html = ""
                
                if parsed_mail.text_plain and parsed_mail.text_plain[0]:
                    body_text = parsed_mail.text_plain[0]
                    body_full = body_text
                    body_preview = body_full[:300] # Take first plain text part, limit length for preview
                
                if parsed_mail.text_html and parsed_mail.text_html[0]:
                    body_html = parsed_mail.text_html[0]
                    if not body_full:  # If no plain text, use HTML as full content
                        body_full = body_html
                        body_preview = body_html[:300]
                        app.logger.info(f"Using HTML content for UID {uid_str} as no plain text found.")
                
                if not body_full:
                    body_full = "Could not load email content."
                    body_preview = body_full
                
                # Analyze email content for intelligent display
                analysis = analyze_email_content(body_html, body_text)
                
                # Avoid duplicates by Message-ID across all folders
                if message_id_header:
                    existing_email_by_msg_id = Email.query.filter_by(user_id=user.id, message_id_header=message_id_header).first()
                    if existing_email_by_msg_id:
                        # If the email exists but in a different folder (e.g., moved to trash),
                        # only re-add it if it's been permanently deleted and we're syncing a different folder
                        if existing_email_by_msg_id.folder != folder:
                            if existing_email_by_msg_id.folder in ['trash', 'archive'] and folder == 'inbox':
                                app.logger.debug(f"Skipping Message-ID {message_id_header}, email exists in {existing_email_by_msg_id.folder} folder")
                                continue
                            elif existing_email_by_msg_id.folder == 'inbox' and folder in ['trash', 'archive']:
                                app.logger.debug(f"Skipping Message-ID {message_id_header}, email exists in inbox folder")
                                continue
                        app.logger.debug(f"Skipping Message-ID {message_id_header} in folder {folder}, already exists in {existing_email_by_msg_id.folder}.")
                        continue
                    
                try:
                    new_email = Email(
                        user_id=user.id,
                        message_id_header=message_id_header,
                        subject=subject,
                        sender=sender,
                        recipient=recipient,
                        body_preview=body_preview,
                        body_full=body_full,
                        body_text=body_text,
                        body_html=body_html,
                        folder=folder,
                        received_date=received_dt,
                        imap_uid=int(uid_str),
                        # Email analysis results
                        email_type=analysis.get('email_type', 'unknown'),
                        should_preserve_layout=analysis.get('should_preserve_layout', False),
                        should_force_left_align=analysis.get('should_force_left_align', True),
                        cleaned_html=analysis.get('cleaned_html')
                        # embedding will be set later
                    )
                    db.session.add(new_email)
                    # Commit each email individually to handle potential conflicts
                    db.session.commit()
                    new_emails_count += 1
                    app.logger.debug(f"Successfully added email with UID {uid_str} to database")
                except Exception as db_error:
                    app.logger.error(f"Database error for UID {uid_str}: {db_error}")
                    db.session.rollback()
                    # Continue with the next email instead of failing completely
                    continue
                    
            fetched_count +=1
            if fetched_count >= limit: # Limit based on request parameter or default
                break
        
        mail.logout()
        return jsonify({'status': 'success', 'message': f'Synced emails. {new_emails_count} new emails stored.'})

    except imaplib.IMAP4.error as e:
        return jsonify({'status': 'error', 'message': f'IMAP operation failed: {str(e)}'}), 500
    except Exception as e:
        # Log the full error for debugging
        app.logger.error(f"Unexpected error during email sync for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'An unexpected error occurred during email sync: {str(e)}'}), 500


@app.route('/api/emails/sync-new', methods=['POST'])
@jwt_required()
def sync_new_emails():
    """Incremental sync - only fetch emails newer than the latest we have"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    decrypted_password = user.get_decrypted_email_password()
    if not decrypted_password:
        return jsonify({"status": "error", "message": "Could not retrieve email password."}), 500
    
    if not user.imap_host or not user.imap_port:
        return jsonify({"status": "error", "message": "User IMAP configuration is missing."}), 500

    folder = request.json.get('folder', 'inbox') if request.json else 'inbox'
    
    try:
        # Get the highest UID we already have for this folder
        latest_email = Email.query.filter_by(user_id=user.id, folder=folder).order_by(Email.imap_uid.desc()).first()
        last_uid = latest_email.imap_uid if latest_email else 0
        
        mail = imaplib.IMAP4_SSL(user.imap_host, user.imap_port)
        mail.login(user.email, decrypted_password)
        
        # Same folder selection logic as main sync
        folder_mapping = {
            'inbox': 'INBOX',
            'sent': 'Sent',
            'drafts': 'Drafts', 
            'trash': 'Trash',
            'spam': 'Spam'
        }
        
        imap_folder = folder_mapping.get(folder, 'INBOX')
        
        if folder == 'sent':
            possible_sent_folders = ['[Gmail]/Sent Mail', 'Sent', 'Sent Items', 'INBOX.Sent', '[Gmail]/Sent', 'Sent Messages']
            folder_found = False
            
            for sent_folder in possible_sent_folders:
                try:
                    status, data = mail.select(sent_folder, readonly=True)
                    if status == 'OK':
                        imap_folder = sent_folder
                        folder_found = True
                        break
                except Exception:
                    continue
            
            if not folder_found:
                mail.logout()
                return jsonify({'status': 'warning', 'message': 'No sent folder found.'})
        else:
            try:
                status, data = mail.select(imap_folder, readonly=True)
                if status != 'OK':
                    mail.select('INBOX', readonly=True)
            except Exception:
                mail.select('INBOX', readonly=True)

        # Search for emails with UID greater than our last known UID
        search_query = f'UID {last_uid + 1}:*' if last_uid > 0 else 'ALL'
        status, messages = mail.uid('search', None, search_query)
        
        if status != 'OK':
            mail.logout()
            return jsonify({"status": "error", "message": "Failed to search for new emails."}), 500
        
        email_uids_bytes = messages[0].split() if messages[0] else []
        new_emails = []
        new_emails_count = 0
        
        # Process only new emails (limit to 20 to avoid overwhelming)
        for uid_bytes in reversed(email_uids_bytes[-20:]):
            uid_str = uid_bytes.decode()
            uid_int = int(uid_str)
            
            # Skip if we already have this UID
            if uid_int <= last_uid:
                continue
                
            # Check if email already exists in any folder
            # This prevents re-adding emails that have been moved to trash/archive
            existing_email = Email.query.filter_by(user_id=user.id, imap_uid=uid_int).first()
            if existing_email:
                # If the email exists but in a different folder (e.g., moved to trash),
                # don't re-add it during incremental sync
                if existing_email.folder != folder:
                    if existing_email.folder in ['trash', 'archive'] and folder == 'inbox':
                        continue
                    elif existing_email.folder == 'inbox' and folder in ['trash', 'archive']:
                        continue
                continue

            # Fetch and process the email (similar to main sync)
            status, msg_data = mail.uid('fetch', uid_bytes, '(RFC822)')
            if status != 'OK' or not msg_data or msg_data[0] is None:
                continue

            if isinstance(msg_data[0], tuple):
                raw_email_bytes = msg_data[0][1]
                try:
                    import mailparser
                    parsed_mail = mailparser.parse_from_bytes(raw_email_bytes)
                except Exception:
                    continue
                
                # Process email data (same as main sync)
                subject = str(parsed_mail.subject) if parsed_mail.subject is not None else "[No Subject]"
                sender_info = parsed_mail.from_[0] if parsed_mail.from_ and isinstance(parsed_mail.from_, list) and len(parsed_mail.from_) > 0 else None
                sender = str(sender_info[1]) if sender_info and len(sender_info) > 1 and sender_info[1] else "Unknown Sender"
                
                recipient_list_tuples = parsed_mail.to if parsed_mail.to and isinstance(parsed_mail.to, list) else []
                recipient_emails = [str(r[1]) for r in recipient_list_tuples if r and len(r) > 1 and r[1]]
                recipient = ", ".join(recipient_emails) if recipient_emails else "Unknown Recipient"
                
                message_id_val = parsed_mail.message_id
                message_id_header = str(message_id_val.strip('<>')) if message_id_val else None
                
                received_dt = parsed_mail.date
                if not isinstance(received_dt, datetime.datetime):
                    received_dt = datetime.datetime.now(datetime.timezone.utc)

                # Extract body content
                body_preview = "Could not load preview."
                body_full = ""
                body_text = ""
                body_html = ""
                
                if parsed_mail.text_plain and parsed_mail.text_plain[0]:
                    body_text = parsed_mail.text_plain[0]
                    body_full = body_text
                    body_preview = body_full[:300]
                
                if parsed_mail.text_html and parsed_mail.text_html[0]:
                    body_html = parsed_mail.text_html[0]
                    if not body_full:
                        body_full = body_html
                        body_preview = body_html[:300]
                
                if not body_full:
                    body_full = "Could not load email content."
                    body_preview = body_full
                
                # Analyze email content for intelligent display
                analysis = analyze_email_content(body_html, body_text)
                
                # Check for duplicates by Message-ID across all folders
                if message_id_header:
                    existing_by_msg_id = Email.query.filter_by(user_id=user.id, message_id_header=message_id_header).first()
                    if existing_by_msg_id:
                        # If the email exists but in a different folder (e.g., moved to trash),
                        # don't re-add it during incremental sync
                        if existing_by_msg_id.folder != folder:
                            if existing_by_msg_id.folder in ['trash', 'archive'] and folder == 'inbox':
                                continue
                            elif existing_by_msg_id.folder == 'inbox' and folder in ['trash', 'archive']:
                                continue
                        continue
                
                try:
                    new_email = Email(
                        user_id=user.id,
                        message_id_header=message_id_header,
                        subject=subject,
                        sender=sender,
                        recipient=recipient,
                        body_preview=body_preview,
                        body_full=body_full,
                        body_text=body_text,
                        body_html=body_html,
                        folder=folder,
                        received_date=received_dt,
                        imap_uid=uid_int,
                        # Email analysis results
                        email_type=analysis.get('email_type', 'unknown'),
                        should_preserve_layout=analysis.get('should_preserve_layout', False),
                        should_force_left_align=analysis.get('should_force_left_align', True),
                        cleaned_html=analysis.get('cleaned_html')
                    )
                    db.session.add(new_email)
                    db.session.commit()
                    
                    # Format email data for frontend
                    email_data = {
                        'id': new_email.id,
                        'subject': subject,
                        'sender': sender,
                        'recipient': recipient,
                        'body_preview': body_preview,
                        'body_full': body_full,
                        'body_text': body_text,
                        'body_html': body_html,
                        'folder': folder,
                        'received_date': received_dt.isoformat(),
                        'message_id_header': message_id_header,
                        'imap_uid': uid_int,
                        'email_type': analysis.get('email_type', 'unknown'),
                        'should_preserve_layout': analysis.get('should_preserve_layout', False),
                        'should_force_left_align': analysis.get('should_force_left_align', True),
                        'cleaned_html': analysis.get('cleaned_html')
                    }
                    new_emails.append(email_data)
                    new_emails_count += 1
                    
                except Exception as db_error:
                    app.logger.error(f"Database error for UID {uid_str}: {db_error}")
                    db.session.rollback()
                    continue
        
        mail.logout()
        
        return jsonify({
            'status': 'success',
            'new_emails': new_emails,
            'count': new_emails_count,
            'message': f'Found {new_emails_count} new emails'
        })

    except Exception as e:
        app.logger.error(f"Error in incremental sync for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Incremental sync failed: {str(e)}'}), 500


@app.route('/api/emails/send', methods=['POST'])
@jwt_required()
def send_email():
    """Send an email via SMTP"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    decrypted_password = user.get_decrypted_email_password()
    if not decrypted_password:
        return jsonify({"status": "error", "message": "Could not retrieve email password."}), 500
    
    if not user.smtp_host or not user.smtp_port:
        return jsonify({"status": "error", "message": "User SMTP configuration is missing."}), 500

    try:
        data = request.get_json()
        to_email = data.get('to')
        cc_email = data.get('cc', '')
        bcc_email = data.get('bcc', '')
        subject = data.get('subject', '')
        body = data.get('body', '')
        is_html = data.get('is_html', False)

        if not to_email:
            return jsonify({"status": "error", "message": "Recipient email is required"}), 400

        # Create email message
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.base import MIMEBase
        from email import encoders
        import os

        msg = MIMEMultipart('mixed')  # Changed to 'mixed' to support attachments
        msg['From'] = user.email
        msg['To'] = to_email
        if cc_email:
            msg['Cc'] = cc_email
        if bcc_email:
            msg['Bcc'] = bcc_email
        msg['Subject'] = subject

        # Create message body container
        body_msg = MIMEMultipart('alternative')
        
        # Create the body
        if is_html:
            body_msg.attach(MIMEText(body, 'html'))
        else:
            body_msg.attach(MIMEText(body, 'plain'))
        
        # Attach the body to main message
        msg.attach(body_msg)

        # Handle file attachments
        files = request.files.getlist('attachments') if 'attachments' in request.files else []
        for file in files:
            if file and file.filename:
                # Create attachment
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(file.read())
                encoders.encode_base64(part)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {file.filename}'
                )
                msg.attach(part)

        # Connect to SMTP server and send
        if user.smtp_port == 465:
            # SSL connection
            server = smtplib.SMTP_SSL(user.smtp_host, user.smtp_port)
        else:
            # TLS connection (port 587)
            server = smtplib.SMTP(user.smtp_host, user.smtp_port)
            server.starttls()

        server.login(user.email, decrypted_password)
        
        # Prepare recipient list
        recipients = [to_email]
        if cc_email:
            recipients.extend([addr.strip() for addr in cc_email.split(',')])
        if bcc_email:
            recipients.extend([addr.strip() for addr in bcc_email.split(',')])

        server.send_message(msg, to_addrs=recipients)
        server.quit()

        # Optionally save to sent folder in database
        try:
            sent_email = Email(
                user_id=user.id,
                message_id_header=msg['Message-ID'],
                subject=subject,
                sender=user.email,
                recipient=to_email + (f", {cc_email}" if cc_email else ""),
                body_preview=body[:300],
                body_full=body,
                body_text=body if not is_html else "",
                body_html=body if is_html else "",
                folder='sent',
                received_date=datetime.datetime.now(datetime.timezone.utc),
                imap_uid=None  # Will be set when synced from IMAP
            )
            db.session.add(sent_email)
            db.session.commit()
        except Exception as db_error:
            app.logger.error(f"Failed to save sent email to database: {db_error}")
            # Don't fail the whole operation if database save fails

        return jsonify({
            'status': 'success',
            'message': 'Email sent successfully'
        })

    except Exception as e:
        app.logger.error(f"Error sending email for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to send email: {str(e)}'}), 500


@app.route('/api/emails/search', methods=['GET'])
@jwt_required()
def search_emails():
    """Search emails by query"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    query = request.args.get('q', '').strip()
    folder = request.args.get('folder', 'inbox')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    if not query:
        return jsonify({"status": "error", "message": "Search query is required"}), 400

    try:
        # Search in subject, sender, recipient, and body content
        search_filter = db.or_(
            Email.subject.ilike(f'%{query}%'),
            Email.sender.ilike(f'%{query}%'),
            Email.recipient.ilike(f'%{query}%'),
            Email.body_preview.ilike(f'%{query}%'),
            Email.body_full.ilike(f'%{query}%')
        )

        emails_pagination = Email.query.filter(
            Email.user_id == user.id,
            Email.folder == folder,
            search_filter
        ).order_by(Email.received_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        emails_data = []
        for email_obj in emails_pagination.items:
            emails_data.append({
                'id': email_obj.id,
                'subject': str(email_obj.subject) if email_obj.subject else "[No Subject]",
                'sender': str(email_obj.sender) if email_obj.sender else "",
                'recipient': str(email_obj.recipient) if email_obj.recipient else "",
                'body_preview': str(email_obj.body_preview) if email_obj.body_preview else "",
                'body_full': str(email_obj.body_full) if email_obj.body_full else "",
                'body_text': str(email_obj.body_text) if email_obj.body_text else "",
                'body_html': str(email_obj.body_html) if email_obj.body_html else "",
                'folder': str(email_obj.folder) if email_obj.folder else "inbox",
                'received_date': email_obj.received_date.isoformat() if email_obj.received_date else None,
                'message_id_header': str(email_obj.message_id_header) if email_obj.message_id_header else "",
                'imap_uid': email_obj.imap_uid,
                'email_type': str(email_obj.email_type) if email_obj.email_type else 'unknown',
                'should_preserve_layout': email_obj.should_preserve_layout if email_obj.should_preserve_layout is not None else False,
                'should_force_left_align': email_obj.should_force_left_align if email_obj.should_force_left_align is not None else True,
                'cleaned_html': str(email_obj.cleaned_html) if email_obj.cleaned_html else None
            })

        return jsonify({
            'status': 'success',
            'emails': emails_data,
            'total_emails': emails_pagination.total,
            'current_page': emails_pagination.page,
            'total_pages': emails_pagination.pages,
            'query': query
        })

    except Exception as e:
        app.logger.error(f"Error searching emails for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Search failed: {str(e)}'}), 500


@app.route('/api/folders', methods=['GET'])
@jwt_required()
def get_folders():
    """Get available IMAP folders for the user"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    decrypted_password = user.get_decrypted_email_password()
    if not decrypted_password:
        return jsonify({"status": "error", "message": "Could not retrieve email password."}), 500
    
    if not user.imap_host or not user.imap_port:
        return jsonify({"status": "error", "message": "User IMAP configuration is missing."}), 500

    try:
        mail = imaplib.IMAP4_SSL(user.imap_host, user.imap_port)
        mail.login(user.email, decrypted_password)
        
        status, folders = mail.list()
        mail.logout()
        
        if status == 'OK':
            folder_list = [f.decode().split('"')[-2] if '"' in f.decode() else f.decode() for f in folders]
            return jsonify({
                'status': 'success', 
                'folders': folder_list
            })
        else:
            return jsonify({"status": "error", "message": "Failed to list folders"}), 500
            
    except Exception as e:
        app.logger.error(f"Error getting folders for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to get folders: {str(e)}'}), 500


@app.route('/api/emails', methods=['GET'])
@jwt_required()
def get_emails():
    current_user_email = get_jwt_identity() # Expecting email
    user = User.query.filter_by(email=current_user_email).first() # Query by email
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Simple pagination example
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    folder = request.args.get('folder', 'inbox')
    
    # Need user.id for filtering emails
    emails_pagination = Email.query.filter_by(user_id=user.id, folder=folder).order_by(Email.received_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    emails_data = []
    for email_obj in emails_pagination.items:
        app.logger.debug(f"Serializing email ID {email_obj.id}: Subject '{email_obj.subject}' (Type: {type(email_obj.subject)})")
        emails_data.append({
            'id': email_obj.id,
            'subject': str(email_obj.subject) if email_obj.subject is not None else "[No Subject]",
            'sender': str(email_obj.sender) if email_obj.sender is not None else "",
            'recipient': str(email_obj.recipient) if email_obj.recipient is not None else "",
            'body_preview': str(email_obj.body_preview) if email_obj.body_preview is not None else "",
            'body_full': str(email_obj.body_full) if email_obj.body_full is not None else "",
            'body_text': str(email_obj.body_text) if email_obj.body_text is not None else "",
            'body_html': str(email_obj.body_html) if email_obj.body_html is not None else "",
            'folder': str(email_obj.folder) if email_obj.folder is not None else "inbox",
            'received_date': email_obj.received_date.isoformat() if email_obj.received_date else None,
            'message_id_header': str(email_obj.message_id_header) if email_obj.message_id_header is not None else "",
            'imap_uid': email_obj.imap_uid,
            'email_type': str(email_obj.email_type) if email_obj.email_type else 'unknown',
            'should_preserve_layout': email_obj.should_preserve_layout if email_obj.should_preserve_layout is not None else False,
            'should_force_left_align': email_obj.should_force_left_align if email_obj.should_force_left_align is not None else True,
            'cleaned_html': str(email_obj.cleaned_html) if email_obj.cleaned_html else None
        })
    # The loop was: } for email_obj in emails_pagination.items] - this is now corrected to a proper loop with append.

    return jsonify({
        'status': 'success',
        'emails': emails_data,
        'total_emails': emails_pagination.total,
        'current_page': emails_pagination.page,
        'total_pages': emails_pagination.pages
    })


@app.route('/api/debug/email-counts', methods=['GET'])
@jwt_required()
def debug_email_counts():
    """Debug endpoint to show email counts per folder"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()
    
    if not user:
        return jsonify({"msg": "User not found"}), 404
    
    # Count emails by folder
    from sqlalchemy import func
    counts = db.session.query(Email.folder, func.count(Email.id)).filter_by(user_id=user.id).group_by(Email.folder).all()
    
    folder_counts = {folder: count for folder, count in counts}
    
    return jsonify({
        'status': 'success',
        'folder_counts': folder_counts,
        'total_emails': sum(folder_counts.values())
    })


@app.route('/api/drafts', methods=['POST'])
@jwt_required()
def save_draft():
    """Save email as draft"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        data = request.get_json()
        to_email = data.get('to', '')
        cc_email = data.get('cc', '')
        bcc_email = data.get('bcc', '')
        subject = data.get('subject', '')
        body = data.get('body', '')
        is_html = data.get('is_html', False)

        # Create draft email
        draft_email = Email(
            user_id=user.id,
            message_id_header=None,  # Drafts don't have message IDs yet
            subject=subject,
            sender=user.email,
            recipient=to_email + (f", {cc_email}" if cc_email else "") + (f", {bcc_email}" if bcc_email else ""),
            body_preview=body[:300] if body else "",
            body_full=body,
            body_text=body if not is_html else "",
            body_html=body if is_html else "",
            folder='drafts',
            received_date=datetime.datetime.now(datetime.timezone.utc),
            imap_uid=None,  # Drafts don't have IMAP UIDs
            email_type='draft'
        )
        
        db.session.add(draft_email)
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Draft saved successfully',
            'draft_id': draft_email.id
        })

    except Exception as e:
        app.logger.error(f"Error saving draft for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to save draft: {str(e)}'}), 500


@app.route('/api/drafts/<int:draft_id>', methods=['PUT'])
@jwt_required()
def update_draft(draft_id):
    """Update an existing draft"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        draft = Email.query.filter_by(id=draft_id, user_id=user.id, folder='drafts').first()
        if not draft:
            return jsonify({'status': 'error', 'message': 'Draft not found'}), 404

        data = request.get_json()
        
        # Update draft fields
        draft.subject = data.get('subject', draft.subject)
        draft.recipient = data.get('to', '') + (f", {data.get('cc', '')}" if data.get('cc') else "") + (f", {data.get('bcc', '')}" if data.get('bcc') else "")
        draft.body_full = data.get('body', draft.body_full)
        draft.body_preview = draft.body_full[:300] if draft.body_full else ""
        
        is_html = data.get('is_html', False)
        if is_html:
            draft.body_html = draft.body_full
            draft.body_text = ""
        else:
            draft.body_text = draft.body_full
            draft.body_html = ""
        
        draft.received_date = datetime.datetime.now(datetime.timezone.utc)  # Update modified time
        
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Draft updated successfully'
        })

    except Exception as e:
        app.logger.error(f"Error updating draft {draft_id} for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to update draft: {str(e)}'}), 500


@app.route('/api/drafts/<int:draft_id>', methods=['DELETE'])
@jwt_required()
def delete_draft(draft_id):
    """Delete a draft"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        draft = Email.query.filter_by(id=draft_id, user_id=user.id, folder='drafts').first()
        if not draft:
            return jsonify({'status': 'error', 'message': 'Draft not found'}), 404

        db.session.delete(draft)
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Draft deleted successfully'
        })

    except Exception as e:
        app.logger.error(f"Error deleting draft {draft_id} for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to delete draft: {str(e)}'}), 500


@app.route('/api/emails/<int:email_id>/delete', methods=['POST'])
@jwt_required()
def delete_email(email_id):
    """Move email to trash or delete permanently on both local DB and IMAP server"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404

        permanent = request.get_json().get('permanent', False) if request.get_json() else False

        # Get user's IMAP credentials for server-side operations
        decrypted_password = user.get_decrypted_email_password()
        if not decrypted_password or not user.imap_host or not user.imap_port:
            # If IMAP not available, fall back to local-only deletion
            app.logger.warning(f"IMAP not configured for user {user.email}, performing local-only deletion")
            if permanent or email.folder == 'trash':
                db.session.delete(email)
                message = 'Email deleted permanently (local only)'
            else:
                email.folder = 'trash'
                message = 'Email moved to trash (local only)'
            db.session.commit()
            return jsonify({'status': 'success', 'message': message})

        # Perform IMAP server-side deletion
        imap_success = False
        imap_message = ""
        
        try:
            import imaplib
            mail = imaplib.IMAP4_SSL(user.imap_host, user.imap_port)
            mail.login(user.email, decrypted_password)
            
            # Map current folder to IMAP folder
            folder_mapping = {
                'inbox': 'INBOX',
                'sent': '[Gmail]/Sent Mail',  # Will try alternatives if this fails
                'drafts': 'Drafts',
                'trash': 'Trash',
                'spam': 'Spam'
            }
            
            current_imap_folder = folder_mapping.get(email.folder, 'INBOX')
            
            # Handle sent folder variations
            if email.folder == 'sent':
                possible_sent_folders = ['[Gmail]/Sent Mail', 'Sent', 'Sent Items', 'INBOX.Sent']
                for sent_folder in possible_sent_folders:
                    try:
                        status, data = mail.select(sent_folder)
                        if status == 'OK':
                            current_imap_folder = sent_folder
                            break
                    except:
                        continue
            else:
                try:
                    status, data = mail.select(current_imap_folder)
                    if status != 'OK':
                        mail.select('INBOX')  # Fallback
                        current_imap_folder = 'INBOX'
                except:
                    mail.select('INBOX')
                    current_imap_folder = 'INBOX'

            if email.imap_uid:
                if permanent or email.folder == 'trash':
                    # Permanently delete from server
                    mail.uid('store', str(email.imap_uid), '+FLAGS', '\\Deleted')
                    mail.expunge()  # Actually remove the email
                    imap_message = "Email permanently deleted from server"
                    
                    # Delete from local database
                    db.session.delete(email)
                    message = 'Email deleted permanently'
                else:
                    # Move to trash on server
                    trash_folders = ['[Gmail]/Trash', 'Trash', 'Deleted Items', 'INBOX.Trash']
                    trash_folder_found = None
                    
                    # Find the correct trash folder
                    for trash_folder in trash_folders:
                        try:
                            status, data = mail.select(trash_folder)
                            if status == 'OK':
                                trash_folder_found = trash_folder
                                break
                        except:
                            continue
                    
                    if trash_folder_found:
                        # Move email to trash folder on server
                        mail.select(current_imap_folder)  # Go back to original folder
                        try:
                            # Copy to trash and mark as deleted in original folder
                            mail.uid('copy', str(email.imap_uid), trash_folder_found)
                            mail.uid('store', str(email.imap_uid), '+FLAGS', '\\Deleted')
                            mail.expunge()
                            imap_message = f"Email moved to {trash_folder_found} on server"
                        except Exception as copy_error:
                            # If copy fails, just mark as deleted
                            mail.uid('store', str(email.imap_uid), '+FLAGS', '\\Deleted')
                            imap_message = "Email marked as deleted on server"
                    else:
                        # No trash folder found, just mark as deleted
                        mail.uid('store', str(email.imap_uid), '+FLAGS', '\\Deleted')
                        imap_message = "Email marked as deleted on server"
                    
                    # Update local database
                    email.folder = 'trash'
                    message = 'Email moved to trash'
                
                imap_success = True
            else:
                imap_message = "No IMAP UID found, performing local-only deletion"
                if permanent or email.folder == 'trash':
                    db.session.delete(email)
                    message = 'Email deleted permanently (local only - no IMAP UID)'
                else:
                    email.folder = 'trash'
                    message = 'Email moved to trash (local only - no IMAP UID)'
            
            mail.logout()
            
        except Exception as imap_error:
            app.logger.error(f"IMAP deletion failed for email {email_id}: {imap_error}")
            imap_message = f"IMAP operation failed: {str(imap_error)}"
            # Fall back to local-only deletion
            if permanent or email.folder == 'trash':
                db.session.delete(email)
                message = 'Email deleted permanently (IMAP failed, local only)'
            else:
                email.folder = 'trash'
                message = 'Email moved to trash (IMAP failed, local only)'
        
        db.session.commit()

        response_message = message
        if imap_message:
            response_message += f" | Server: {imap_message}"

        return jsonify({
            'status': 'success' if imap_success else 'warning',
            'message': response_message,
            'imap_success': imap_success
        })

    except Exception as e:
        app.logger.error(f"Error deleting email {email_id} for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to delete email: {str(e)}'}), 500


@app.route('/api/emails/<int:email_id>/restore', methods=['POST'])
@jwt_required()
def restore_email(email_id):
    """Restore an email from trash back to inbox (or original folder) on both local DB and IMAP server"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404

        if email.folder != 'trash':
            return jsonify({'status': 'error', 'message': 'Email is not in trash folder'}), 400

        # Determine target folder (default to inbox for emails restored from trash)
        target_folder = 'inbox'  # Most emails restored from trash go back to inbox
        
        # Get user's IMAP credentials for server-side operations
        decrypted_password = user.get_decrypted_email_password()
        if not decrypted_password or not user.imap_host or not user.imap_port:
            # If IMAP not available, fall back to local-only restoration
            app.logger.warning(f"IMAP not configured for user {user.email}, performing local-only restoration")
            email.folder = target_folder
            db.session.commit()
            return jsonify({'status': 'success', 'message': f'Email restored to {target_folder} (local only)'})

        # Perform IMAP server-side restoration
        imap_success = False
        imap_message = ""
        
        try:
            import imaplib
            mail = imaplib.IMAP4_SSL(user.imap_host, user.imap_port)
            mail.login(user.email, decrypted_password)
            
            # Map folders to IMAP folders
            folder_mapping = {
                'inbox': 'INBOX',
                'sent': '[Gmail]/Sent Mail',
                'drafts': 'Drafts',
                'trash': 'Trash',
                'spam': 'Spam'
            }
            
            # Find the trash folder on server
            trash_folders = ['[Gmail]/Trash', 'Trash', 'Deleted Items', 'INBOX.Trash']
            trash_folder_found = None
            
            for trash_folder in trash_folders:
                try:
                    status, data = mail.select(trash_folder)
                    if status == 'OK':
                        trash_folder_found = trash_folder
                        break
                except:
                    continue
            
            if not trash_folder_found:
                # Try to select any folder that might contain the email
                mail.select('INBOX')
                trash_folder_found = 'INBOX'
            else:
                mail.select(trash_folder_found)

            if email.imap_uid:
                target_imap_folder = folder_mapping.get(target_folder, 'INBOX')
                
                try:
                    # Copy email from trash back to target folder
                    mail.uid('copy', str(email.imap_uid), target_imap_folder)
                    # Mark as deleted in trash folder
                    mail.uid('store', str(email.imap_uid), '+FLAGS', '\\Deleted')
                    mail.expunge()
                    imap_message = f"Email restored from {trash_folder_found} to {target_imap_folder} on server"
                    imap_success = True
                except Exception as restore_error:
                    app.logger.error(f"Failed to restore email on server: {restore_error}")
                    imap_message = f"Failed to restore on server: {str(restore_error)}"
            else:
                imap_message = "No IMAP UID found, performing local-only restoration"
            
            mail.logout()
            
        except Exception as imap_error:
            app.logger.error(f"IMAP restoration failed for email {email_id}: {imap_error}")
            imap_message = f"IMAP operation failed: {str(imap_error)}"
        
        # Update local database regardless of IMAP success
        email.folder = target_folder
        db.session.commit()

        response_message = f'Email restored to {target_folder}'
        if imap_message:
            response_message += f" | Server: {imap_message}"

        return jsonify({
            'status': 'success' if imap_success else 'warning',
            'message': response_message,
            'imap_success': imap_success,
            'target_folder': target_folder
        })

    except Exception as e:
        app.logger.error(f"Error restoring email {email_id} for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to restore email: {str(e)}'}), 500


@app.route('/api/emails/<int:email_id>/archive', methods=['POST'])
@jwt_required()
def archive_email(email_id):
    """Archive an email on both local DB and IMAP server"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404

        # Get user's IMAP credentials for server-side operations
        decrypted_password = user.get_decrypted_email_password()
        if not decrypted_password or not user.imap_host or not user.imap_port:
            # If IMAP not available, fall back to local-only archiving
            app.logger.warning(f"IMAP not configured for user {user.email}, performing local-only archiving")
            email.folder = 'archive'
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'Email archived (local only)'})

        # Perform IMAP server-side archiving
        imap_success = False
        imap_message = ""
        
        try:
            import imaplib
            mail = imaplib.IMAP4_SSL(user.imap_host, user.imap_port)
            mail.login(user.email, decrypted_password)
            
            # Map current folder to IMAP folder
            folder_mapping = {
                'inbox': 'INBOX',
                'sent': '[Gmail]/Sent Mail',
                'drafts': 'Drafts',
                'trash': 'Trash',
                'spam': 'Spam'
            }
            
            current_imap_folder = folder_mapping.get(email.folder, 'INBOX')
            
            # Handle folder variations
            if email.folder == 'sent':
                possible_sent_folders = ['[Gmail]/Sent Mail', 'Sent', 'Sent Items', 'INBOX.Sent']
                for sent_folder in possible_sent_folders:
                    try:
                        status, data = mail.select(sent_folder)
                        if status == 'OK':
                            current_imap_folder = sent_folder
                            break
                    except:
                        continue
            else:
                try:
                    status, data = mail.select(current_imap_folder)
                    if status != 'OK':
                        mail.select('INBOX')
                        current_imap_folder = 'INBOX'
                except:
                    mail.select('INBOX')
                    current_imap_folder = 'INBOX'

            if email.imap_uid:
                # Try to find archive folder on server
                archive_folders = ['[Gmail]/All Mail', 'Archive', 'INBOX.Archive', 'Archived']
                archive_folder_found = None
                
                for archive_folder in archive_folders:
                    try:
                        status, data = mail.select(archive_folder)
                        if status == 'OK':
                            archive_folder_found = archive_folder
                            break
                    except:
                        continue
                
                if archive_folder_found:
                    # Move email to archive folder on server
                    mail.select(current_imap_folder)  # Go back to original folder
                    try:
                        # Copy to archive and mark as deleted in original folder
                        mail.uid('copy', str(email.imap_uid), archive_folder_found)
                        mail.uid('store', str(email.imap_uid), '+FLAGS', '\\Deleted')
                        mail.expunge()
                        imap_message = f"Email moved to {archive_folder_found} on server"
                        imap_success = True
                    except Exception as copy_error:
                        app.logger.error(f"Failed to copy email to archive: {copy_error}")
                        imap_message = "Failed to move to archive on server, performing local-only archiving"
                else:
                    # For Gmail, we can use the Archive label instead of moving to a folder
                    if 'gmail' in user.imap_host.lower():
                        try:
                            # Remove from INBOX (Gmail's way of archiving)
                            mail.select('INBOX')
                            mail.uid('store', str(email.imap_uid), '+FLAGS', '\\Deleted')
                            mail.expunge()
                            imap_message = "Email archived (removed from INBOX) on Gmail server"
                            imap_success = True
                        except Exception as gmail_error:
                            app.logger.error(f"Failed to archive on Gmail: {gmail_error}")
                            imap_message = "Failed to archive on Gmail server, performing local-only archiving"
                    else:
                        imap_message = "No archive folder found on server, performing local-only archiving"
            else:
                imap_message = "No IMAP UID found, performing local-only archiving"
            
            mail.logout()
            
        except Exception as imap_error:
            app.logger.error(f"IMAP archiving failed for email {email_id}: {imap_error}")
            imap_message = f"IMAP operation failed: {str(imap_error)}"
        
        # Update local database regardless of IMAP success
        email.folder = 'archive'
        db.session.commit()

        response_message = 'Email archived successfully'
        if imap_message:
            response_message += f" | Server: {imap_message}"

        return jsonify({
            'status': 'success' if imap_success else 'warning',
            'message': response_message,
            'imap_success': imap_success
        })

    except Exception as e:
        app.logger.error(f"Error archiving email {email_id} for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Failed to archive email: {str(e)}'}), 500


@app.route('/api/emails/bulk', methods=['POST'])
@jwt_required()
def bulk_email_action():
    """Perform bulk actions on multiple emails"""
    current_user_email = get_jwt_identity()
    user = User.query.filter_by(email=current_user_email).first()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    try:
        data = request.get_json()
        email_ids = data.get('email_ids', [])
        action = data.get('action')  # 'delete', 'archive', 'mark_read', 'mark_unread', 'restore'

        if not email_ids or not action:
            return jsonify({'status': 'error', 'message': 'Email IDs and action are required'}), 400

        emails = Email.query.filter(Email.id.in_(email_ids), Email.user_id == user.id).all()
        
        if not emails:
            return jsonify({'status': 'error', 'message': 'No emails found'}), 404

        updated_count = 0
        
        # Get IMAP credentials for server-side operations
        decrypted_password = user.get_decrypted_email_password()
        imap_available = decrypted_password and user.imap_host and user.imap_port
        
        imap_operations = []
        
        for email in emails:
            if action == 'delete':
                if email.folder == 'trash':
                    db.session.delete(email)
                else:
                    email.folder = 'trash'
                    if imap_available and email.imap_uid:
                        imap_operations.append(('delete', email.imap_uid, email.folder))
                updated_count += 1
            elif action == 'archive':
                old_folder = email.folder
                email.folder = 'archive'
                if imap_available and email.imap_uid:
                    imap_operations.append(('archive', email.imap_uid, old_folder))
                updated_count += 1
            elif action == 'restore':
                if email.folder == 'trash':
                    old_folder = email.folder
                    email.folder = 'inbox'  # Restore to inbox by default
                    if imap_available and email.imap_uid:
                        imap_operations.append(('restore', email.imap_uid, old_folder))
                    updated_count += 1
            # Note: mark_read/mark_unread are handled on frontend with localStorage
        
        # Perform IMAP operations if available
        imap_success_count = 0
        if imap_available and imap_operations:
            try:
                import imaplib
                mail = imaplib.IMAP4_SSL(user.imap_host, user.imap_port)
                mail.login(user.email, decrypted_password)
                
                for operation, uid, source_folder in imap_operations:
                    try:
                        # Map folder to IMAP folder
                        folder_mapping = {
                            'inbox': 'INBOX',
                            'sent': '[Gmail]/Sent Mail',
                            'drafts': 'Drafts',
                            'trash': 'Trash',
                            'spam': 'Spam'
                        }
                        
                        imap_folder = folder_mapping.get(source_folder, 'INBOX')
                        
                        # Select the source folder
                        mail.select(imap_folder)
                        
                        if operation == 'delete':
                            # Move to trash or mark as deleted
                            if source_folder == 'trash':
                                # Permanent delete
                                mail.uid('store', str(uid), '+FLAGS', '\\Deleted')
                                mail.expunge()
                            else:
                                # Move to trash
                                trash_folders = ['[Gmail]/Trash', 'Trash', 'Deleted Items']
                                trash_found = False
                                for trash_folder in trash_folders:
                                    try:
                                        mail.select(trash_folder)
                                        mail.select(imap_folder)  # Go back
                                        mail.uid('copy', str(uid), trash_folder)
                                        mail.uid('store', str(uid), '+FLAGS', '\\Deleted')
                                        mail.expunge()
                                        trash_found = True
                                        break
                                    except:
                                        continue
                                if not trash_found:
                                    mail.uid('store', str(uid), '+FLAGS', '\\Deleted')
                        
                        elif operation == 'archive':
                            # Move to archive
                            archive_folders = ['[Gmail]/All Mail', 'Archive', 'INBOX.Archive']
                            archived = False
                            for archive_folder in archive_folders:
                                try:
                                    mail.select(archive_folder)
                                    mail.select(imap_folder)  # Go back
                                    mail.uid('copy', str(uid), archive_folder)
                                    mail.uid('store', str(uid), '+FLAGS', '\\Deleted')
                                    mail.expunge()
                                    archived = True
                                    break
                                except:
                                    continue
                            if not archived and 'gmail' in user.imap_host.lower():
                                # Gmail-specific archiving (remove from INBOX)
                                mail.select('INBOX')
                                mail.uid('store', str(uid), '+FLAGS', '\\Deleted')
                                mail.expunge()
                                archived = True
                        
                        elif operation == 'restore':
                            # Restore from trash to inbox
                            try:
                                # Copy from trash folder to INBOX
                                mail.uid('copy', str(uid), 'INBOX')
                                # Mark as deleted in trash folder
                                mail.uid('store', str(uid), '+FLAGS', '\\Deleted')
                                mail.expunge()
                            except Exception as restore_error:
                                app.logger.error(f"Failed to restore email UID {uid}: {restore_error}")
                                continue
                        
                        imap_success_count += 1
                        
                    except Exception as op_error:
                        app.logger.error(f"IMAP operation failed for UID {uid}: {op_error}")
                        continue
                
                mail.logout()
                
            except Exception as imap_error:
                app.logger.error(f"IMAP bulk operation failed: {imap_error}")
        
        db.session.commit()

        action_messages = {
            'delete': f'{updated_count} emails moved to trash',
            'archive': f'{updated_count} emails archived',
            'restore': f'{updated_count} emails restored from trash'
        }

        base_message = action_messages.get(action, f'Bulk action completed on {updated_count} emails')
        
        if imap_available and imap_operations:
            imap_message = f" | Server: {imap_success_count}/{len(imap_operations)} operations succeeded"
            response_message = base_message + imap_message
            status = 'success' if imap_success_count == len(imap_operations) else 'warning'
        else:
            response_message = base_message + " (local only)"
            status = 'success'

        return jsonify({
            'status': status,
            'message': response_message,
            'local_success': updated_count,
            'imap_success': imap_success_count if imap_available else None
        })

    except Exception as e:
        app.logger.error(f"Error performing bulk action for user {user.email}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'Bulk action failed: {str(e)}'}), 500


@app.route('/api/ai/status', methods=['GET'])
@jwt_required()
def ai_status():
    """Check if AI features are available"""
    return jsonify({
        'status': 'success',
        'ai_enabled': ai_service.is_enabled()
    })


@app.route('/api/ai/summarize', methods=['POST'])
@jwt_required()
def ai_summarize_email():
    """Summarize an email using AI"""
    if not ai_service.is_enabled():
        return jsonify({'status': 'error', 'message': 'AI features are not enabled'}), 503
    
    try:
        data = request.get_json()
        email_id = data.get('email_id')
        
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({"msg": "User not found"}), 404
        
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404
        
        summary = ai_service.summarize_email(
            subject=email.subject or "",
            body=email.body_text or email.body_full or "",
            sender=email.sender or ""
        )
        
        if summary:
            return jsonify({
                'status': 'success',
                'summary': summary
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to generate summary'}), 500
            
    except Exception as e:
        app.logger.error(f"Error in AI summarize: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'AI service error'}), 500


@app.route('/api/ai/action-items', methods=['POST'])
@jwt_required()
def ai_extract_action_items():
    """Extract action items from an email using AI"""
    if not ai_service.is_enabled():
        return jsonify({'status': 'error', 'message': 'AI features are not enabled'}), 503
    
    try:
        data = request.get_json()
        email_id = data.get('email_id')
        
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({"msg": "User not found"}), 404
        
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404
        
        action_items = ai_service.extract_action_items(
            subject=email.subject or "",
            body=email.body_text or email.body_full or ""
        )
        
        return jsonify({
            'status': 'success',
            'action_items': action_items or []
        })
            
    except Exception as e:
        app.logger.error(f"Error in AI action items: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'AI service error'}), 500


@app.route('/api/ai/compose-reply', methods=['POST'])
@jwt_required()
def ai_compose_reply():
    """Generate a reply to an email using AI"""
    if not ai_service.is_enabled():
        return jsonify({'status': 'error', 'message': 'AI features are not enabled'}), 503
    
    try:
        data = request.get_json()
        email_id = data.get('email_id')
        context = data.get('context', '')
        
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({"msg": "User not found"}), 404
        
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404
        
        reply = ai_service.compose_reply(
            original_subject=email.subject or "",
            original_body=email.body_text or email.body_full or "",
            original_sender=email.sender or "",
            context=context
        )
        
        if reply:
            return jsonify({
                'status': 'success',
                'reply': reply
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to generate reply'}), 500
            
    except Exception as e:
        app.logger.error(f"Error in AI compose reply: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'AI service error'}), 500


@app.route('/api/ai/categorize', methods=['POST'])
@jwt_required()
def ai_categorize_email():
    """Categorize an email using AI"""
    if not ai_service.is_enabled():
        return jsonify({'status': 'error', 'message': 'AI features are not enabled'}), 503
    
    try:
        data = request.get_json()
        email_id = data.get('email_id')
        
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({"msg": "User not found"}), 404
        
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404
        
        category = ai_service.categorize_email(
            subject=email.subject or "",
            body=email.body_text or email.body_full or "",
            sender=email.sender or ""
        )
        
        return jsonify({
            'status': 'success',
            'category': category
        })
            
    except Exception as e:
        app.logger.error(f"Error in AI categorize: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'AI service error'}), 500


@app.route('/api/ai/improve-draft', methods=['POST'])
@jwt_required()
def ai_improve_draft():
    """Improve email draft using AI"""
    if not ai_service.is_enabled():
        return jsonify({'status': 'error', 'message': 'AI features are not enabled'}), 503
    
    try:
        data = request.get_json()
        draft_content = data.get('content', '')
        improvement_type = data.get('type', 'general')  # general, formal, casual, concise, grammar
        
        if not draft_content:
            return jsonify({'status': 'error', 'message': 'Draft content is required'}), 400
        
        improved_content = ai_service.improve_email_draft(draft_content, improvement_type)
        
        if improved_content:
            return jsonify({
                'status': 'success',
                'improved_content': improved_content
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to improve draft'}), 500
            
    except Exception as e:
        app.logger.error(f"Error in AI improve draft: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'AI service error'}), 500


@app.route('/api/ai/generate-content', methods=['POST'])
@jwt_required()
def ai_generate_content():
    """Generate email content using AI with optional context"""
    if not ai_service.is_enabled():
        return jsonify({'status': 'error', 'message': 'AI features are not enabled'}), 503
    
    try:
        data = request.get_json()
        content_type = data.get('content_type', 'professional')  # professional, followup, thankyou, meeting
        email_id = data.get('email_id')  # Optional - for contextual generation when replying
        
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({"msg": "User not found"}), 404
        
        # Get original email context if email_id is provided
        original_email_context = None
        if email_id:
            email = Email.query.filter_by(id=email_id, user_id=user.id).first()
            if email:
                original_email_context = {
                    'subject': email.subject or '',
                    'body': email.body_text or email.body_full or '',
                    'sender': email.sender or ''
                }
        
        generated_content = ai_service.generate_email_content(content_type, original_email_context)
        
        if generated_content:
            return jsonify({
                'status': 'success',
                'generated_content': generated_content
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to generate content'}), 500
            
    except Exception as e:
        app.logger.error(f"Error in AI generate content: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'AI service error'}), 500


@app.route('/api/ai/ask', methods=['POST'])
@jwt_required()
def ai_ask_about_email():
    """Ask a question about an email using AI"""
    if not ai_service.is_enabled():
        return jsonify({'status': 'error', 'message': 'AI features are not enabled'}), 503
    
    try:
        data = request.get_json()
        email_id = data.get('email_id')
        question = data.get('question', '')
        
        if not question:
            return jsonify({'status': 'error', 'message': 'Question is required'}), 400
        
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({"msg": "User not found"}), 404
        
        email = Email.query.filter_by(id=email_id, user_id=user.id).first()
        if not email:
            return jsonify({'status': 'error', 'message': 'Email not found'}), 404
        
        answer = ai_service.answer_question_about_email(
            question=question,
            subject=email.subject or "",
            body=email.body_text or email.body_full or "",
            sender=email.sender or ""
        )
        
        if answer:
            return jsonify({
                'status': 'success',
                'answer': answer
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to answer question'}), 500
            
    except Exception as e:
        app.logger.error(f"Error in AI ask: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'AI service error'}), 500


if __name__ == '__main__':
    app.run(debug=True)