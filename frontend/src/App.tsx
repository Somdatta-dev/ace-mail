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
    return <div>Loading application...</div>; // Or a proper spinner component
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
