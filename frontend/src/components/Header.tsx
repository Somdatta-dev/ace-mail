import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  userEmail: string;
  onLogout: () => void;
  selectedEmailsCount: number;
  onSyncEmails: () => void;
  isSyncing: boolean;
  isAutoSyncing?: boolean;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: () => void;
  currentFolder?: string;
}

const Header: React.FC<HeaderProps> = ({ 
  userEmail, 
  onLogout, 
  selectedEmailsCount, 
  onSyncEmails, 
  isSyncing,
  isAutoSyncing = false,
  autoSyncEnabled = true,
  onToggleAutoSync,
  currentFolder = 'inbox'
}) => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gmail-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - App Logo and Title */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-gmail-red to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <h1 className="text-xl font-normal text-gmail-gray-700 dark:text-gray-300">AceMail</h1>
          </div>
          
          {selectedEmailsCount > 0 && (
            <div className="text-sm text-gmail-gray-600 dark:text-gray-400">
              {selectedEmailsCount} selected
            </div>
          )}
        </div>

        {/* Right side - Actions and User */}
        <div className="flex items-center space-x-4">
          {/* Auto-sync Toggle */}
          {onToggleAutoSync && (
            <button
              onClick={onToggleAutoSync}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                autoSyncEnabled
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
              }`}
              title={`${autoSyncEnabled ? 'Disable' : 'Enable'} automatic email syncing`}
            >
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  autoSyncEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
                <span>Auto-sync {autoSyncEnabled ? 'ON' : 'OFF'}</span>
              </div>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gmail-gray-600 dark:text-gray-300 hover:text-gmail-gray-800 dark:hover:text-white transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={onSyncEmails}
            disabled={isSyncing || isAutoSyncing}
            className="px-4 py-2 text-sm font-medium text-gmail-blue dark:text-blue-400 border border-gmail-blue dark:border-blue-400 rounded hover:bg-gmail-blue hover:text-white dark:hover:bg-blue-400 dark:hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Manually sync emails for ${currentFolder} folder`}
          >
            {isSyncing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span>Syncing {currentFolder}...</span>
              </div>
            ) : isAutoSyncing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span>Auto-syncing...</span>
              </div>
            ) : (
              `Sync ${currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1)}`
            )}
          </button>

          {/* User Info */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gmail-gray-700 dark:text-gray-300">{userEmail}</div>
            </div>
            
            {/* Avatar */}
            <div className="w-8 h-8 bg-gmail-blue dark:bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="text-sm text-gmail-gray-600 dark:text-gray-400 hover:text-gmail-gray-800 dark:hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 