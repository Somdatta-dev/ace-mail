import React, { useState } from 'react';
import styles from './LoginPage.module.css';
import { apiClient } from '../../services/api'; // Import apiClient

const emailProviders = [
  { id: 'gmail', name: 'Gmail' },
  { id: 'outlook', name: 'Outlook/Hotmail' },
  { id: 'zoho_personal', name: 'Zoho Mail (Personal)' },
  { id: 'zoho_custom', name: 'Zoho Mail (Custom Domain)' },
  { id: 'proton', name: 'Proton Mail' },
  { id: 'custom_imap', name: 'Custom IMAP/SMTP' },
];

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [selectedProvider, setSelectedProvider] = useState<string>(emailProviders[0].id);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value;
    setSelectedProvider(newProvider);
    if (newProvider === 'zoho_custom') {
      setCredentials({
        imap_server: 'imappro.zoho.com',
        imap_port: '993',
        smtp_server: 'smtppro.zoho.com',
        smtp_port: '465',
        // email and password will still be empty for user input
      });
    } else {
      setCredentials({}); // Reset credentials for other providers
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    // Explicitly define the payload structure for clarity and type safety
    const apiPayload: {
      provider: string;
      email?: string;
      password?: string;
      imap_server?: string;
      imap_port?: number;
      smtp_server?: string;
      smtp_port?: number;
    } = {
      provider: selectedProvider,
      email: credentials.email,
      password: credentials.password,
    };

    if (selectedProvider === 'custom_imap' || selectedProvider === 'zoho_custom') {
      apiPayload.imap_server = credentials.imap_server;
      if (credentials.imap_port) {
        apiPayload.imap_port = parseInt(credentials.imap_port, 10);
      }
      apiPayload.smtp_server = credentials.smtp_server;
      if (credentials.smtp_port) {
        apiPayload.smtp_port = parseInt(credentials.smtp_port, 10);
      }
    }

    try {
      // Use apiClient for the POST request.
      // The apiClient handles base URL, headers, and stringifying the body.
      // It also throws an error for non-ok HTTP responses, simplifying error handling here.
      const result = await apiClient.post<{ access_token?: string; status: string; message: string; }>('/login', apiPayload);

      if (result && result.status === 'success' && result.access_token) {
        localStorage.setItem('aceMailAccessToken', result.access_token);
        console.log('Login successful, token stored:', result.access_token);
        onLoginSuccess(); // Call the callback to update App state
      } else if (result && result.status === 'success' && !result.access_token) {
        // This case should ideally not happen if backend always sends token on success
        setErrorMessage(result.message || 'Login successful, but no session token received.');
        console.error('Login successful but no token:', result);
      } else {
        // If apiClient threw an error, it will be caught by the catch block.
        // This 'else' handles cases where the request was successful (e.g., 200 OK)
        // but the application-level status is not 'success' or token is missing.
        setErrorMessage(result?.message || 'Login failed. Please check your credentials and server settings.');
        console.error('Login failed with application error:', result);
      }
    } catch (error) {
      // Error already logged by apiClient, just set the message for the user.
      // The error object from apiClient should have a .message property.
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred. Please check your network connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCredentialFields = () => {
    switch (selectedProvider) {
      case 'gmail':
      case 'outlook':
      case 'zoho_personal':
      case 'proton':
        return (
          <>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={credentials.email || ''}
                onChange={handleInputChange}
                required
                placeholder="your.email@example.com"
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={credentials.password || ''}
                  onChange={handleInputChange}
                  required
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.showHideButton}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </>
        );
      case 'custom_imap':
      case 'zoho_custom': // Add Zoho Custom here to share the same fields
        return (
          <>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={credentials.email || ''}
                onChange={handleInputChange}
                required
                placeholder="your.email@example.com"
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
               <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={credentials.password || ''}
                  onChange={handleInputChange}
                  required
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.showHideButton}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="imap_server">IMAP Server</label>
              <input
                type="text"
                id="imap_server"
                name="imap_server"
                value={credentials.imap_server || ''}
                onChange={handleInputChange}
                required
                placeholder="imap.example.com"
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="imap_port">IMAP Port</label>
              <input
                type="number"
                id="imap_port"
                name="imap_port"
                value={credentials.imap_port || ''}
                onChange={handleInputChange}
                required
                placeholder="993"
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="smtp_server">SMTP Server</label>
              <input
                type="text"
                id="smtp_server"
                name="smtp_server"
                value={credentials.smtp_server || ''}
                onChange={handleInputChange}
                required
                placeholder="smtp.example.com"
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="smtp_port">SMTP Port</label>
              <input
                type="number"
                id="smtp_port"
                name="smtp_port"
                value={credentials.smtp_port || ''}
                onChange={handleInputChange}
                required
                placeholder="465 or 587"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        <h1 className={styles.title}>AceMail</h1>
        <p className={styles.subtitle}>Connect your email account</p>
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <label htmlFor="provider">Email Provider</label>
            <select
              id="provider"
              name="provider"
              value={selectedProvider}
              onChange={handleProviderChange}
              className={styles.selectProvider}
            >
              {emailProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {renderCredentialFields()}

          {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

          <button type="submit" className={styles.loginButton} disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className={styles.footerText}>
          AceMail is an email client. We do not store your credentials.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;