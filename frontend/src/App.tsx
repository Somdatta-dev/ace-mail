import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage/LoginPage';
import InboxPage from './pages/InboxPage/InboxPage';
import { apiClient } from './services/api'; // Import the apiClient
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css'; // Keep App.css for potential global styles or remove if not needed

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // To manage initial auth check

  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('aceMailAccessToken');
      if (token) {
        try {
          // apiClient.getProfile() already includes Authorization header if token exists
          // and handles base URL. It also throws an error on non-ok responses.
          const profileData = await apiClient.getProfile();
          if (profileData && profileData.user) { // Check if response is valid
            // console.log("Token validated, user data:", profileData.user);
            setIsLoggedIn(true);
          } else {
            // This case might occur if getProfile returns null for some reason (e.g. non-json response)
            // or if the structure of profileData is not as expected.
            // apiClient's request function would throw for non-ok HTTP status,
            // so this 'else' might be for unexpected successful responses with bad data.
            console.log('Token validation successful, but profile data is unexpected.');
            localStorage.removeItem('aceMailAccessToken');
            setIsLoggedIn(false);
          }
        } catch (error) {
          // apiClient.getProfile would have thrown an error for non-ok responses or network issues
          console.error("Error validating token via apiClient:", error);
          localStorage.removeItem('aceMailAccessToken');
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false); // No token found
      }
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('aceMailAccessToken');
    setIsLoggedIn(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">AceMail</h2>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          </div>
          <p className="text-gray-400 text-sm mt-3">Loading your email client...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="App">
        {isLoggedIn ? (
          <InboxPage onLogout={handleLogout} />
        ) : (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
