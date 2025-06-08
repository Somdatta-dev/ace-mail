import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/api';
import { cn, formatEmailDate, formatEmailDateDetailed, truncateText, getInitials } from '../../lib/utils';
import { Icons } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../contexts/ThemeContext';
import ComposeModal from '../../components/ComposeModal';
import { AIAssistant } from '../../components/ui/AIAssistant';
import { AIDraftImprover } from '../../components/ui/AIDraftImprover';

interface EmailData {
  id: number;
  sender: string;
  subject: string;
  body_preview: string;
  body_full?: string;
  body_text?: string;
  body_html?: string;
  received_date: string;
  message_id_header?: string;
  recipient?: string;
  folder?: string;
  imap_uid?: number;
  isRead?: boolean;
  isStarred?: boolean;
  // Email analysis fields
  email_type?: string;
  should_preserve_layout?: boolean;
  should_force_left_align?: boolean;
  cleaned_html?: string;
}

interface InboxPageProps {
  onLogout: () => void;
}

const InboxPage: React.FC<InboxPageProps> = ({ onLogout }) => {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedEmails, setSelectedEmails] = useState<number[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeData, setComposeData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiDraftImproverOpen, setAiDraftImproverOpen] = useState(false);
  const [currentDraftContent, setCurrentDraftContent] = useState('');
  const [currentImprovementCallback, setCurrentImprovementCallback] = useState<((content: string) => void) | null>(null);
  
  // Persistent state for email read/starred status
  const [emailStates, setEmailStates] = useState<{[key: string]: {isRead: boolean, isStarred: boolean}}>({});

  // Refs for cleanup
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  // Auto-sync settings
  const AUTO_SYNC_INTERVAL = 30000; // 30 seconds
  const MIN_SYNC_INTERVAL = 10000; // Minimum 10 seconds between syncs

  const { theme, toggleTheme } = useTheme();

  // Sidebar folders configuration
  const folders = [
    { id: 'inbox', label: 'Inbox', icon: Icons.inbox, count: emails.filter(e => !e.isRead && selectedFolder === 'inbox').length },
    { id: 'starred', label: 'Starred', icon: Icons.star, count: emails.filter(e => e.isStarred).length },
    { id: 'sent', label: 'Sent', icon: Icons.sent },
    { id: 'drafts', label: 'Drafts', icon: Icons.drafts },
    { id: 'archive', label: 'Archive', icon: Icons.archive },
    { id: 'spam', label: 'Spam', icon: Icons.spam },
    { id: 'trash', label: 'Trash', icon: Icons.trash },
  ];

  // Load email states from localStorage on component mount
  useEffect(() => {
    const savedStates = localStorage.getItem('acemail_email_states');
    if (savedStates) {
      try {
        setEmailStates(JSON.parse(savedStates));
      } catch (err) {
        console.error('Failed to parse saved email states:', err);
      }
    }

    // Load auto-sync preference
    const savedAutoSync = localStorage.getItem('acemail_auto_sync_enabled');
    if (savedAutoSync !== null) {
      setAutoSyncEnabled(JSON.parse(savedAutoSync));
    }
  }, []);

  // Save email states to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(emailStates).length > 0) {
      localStorage.setItem('acemail_email_states', JSON.stringify(emailStates));
    }
  }, [emailStates]);

  // Save auto-sync preference
  useEffect(() => {
    localStorage.setItem('acemail_auto_sync_enabled', JSON.stringify(autoSyncEnabled));
  }, [autoSyncEnabled]);

  // Get user profile
  useEffect(() => {
    const getUserProfile = async () => {
      try {
        const profile = await apiClient.getProfile();
        if (profile?.user?.email) {
          setUserEmail(profile.user.email);
        }
      } catch (err) {
        console.error('Failed to get user profile:', err);
      }
    };
    getUserProfile();
  }, []);

  const fetchEmails = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getEmails(page, 50, selectedFolder);
      if (response && response.emails) {
        // Transform emails to include persistent read/starred status
        const transformedEmails = response.emails.map((email: any) => {
          const emailKey = `${email.id}_${email.message_id_header || email.imap_uid}`;
          const savedState = emailStates[emailKey] || { 
            isRead: selectedFolder === 'sent', // Sent emails are typically read by default
            isStarred: false 
          };
          
          return {
            ...email,
            isRead: savedState.isRead,
            isStarred: savedState.isStarred,
          };
        });
        setEmails(transformedEmails);
      } else {
        setEmails([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails.');
      setEmails([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFolder, emailStates]);

  const syncEmails = useCallback(async (isManual = false) => {
    // Prevent too frequent syncing
    const now = Date.now();
    if (!isManual && now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL) {
      return;
    }

    // Don't start auto-sync if manual sync is running
    if (!isManual && isSyncing) {
      return;
    }

    // Set appropriate loading state
    if (isManual) {
      setIsSyncing(true);
    } else {
      setIsAutoSyncing(true);
    }
    
    setError(null);
    lastSyncTimeRef.current = now;

    try {
      if (isManual) {
        // Manual sync: Full sync and refresh
        await apiClient.syncEmails(200, selectedFolder);
        await fetchEmails();
      } else {
        // Auto-sync: Incremental sync (no flickering)
        const response = await apiClient.syncNewEmails(selectedFolder);
        
        if (response.new_emails && response.new_emails.length > 0) {
          const newEmails = response.new_emails.map((email: any) => ({
            ...email,
            isRead: selectedFolder === 'sent', // Sent emails default to read
            isStarred: false // New emails default to not starred
          }));
          
          // Prepend new emails to existing list without flickering
          setEmails(prevEmails => {
            const existingIds = new Set(prevEmails.map(e => e.id));
            const filteredNewEmails = newEmails.filter((email: any) => !existingIds.has(email.id));
            return [...filteredNewEmails, ...prevEmails];
          });
          
          // Update email states for new emails
          newEmails.forEach((email: any) => {
            updateEmailState(email, { 
              isRead: selectedFolder === 'sent', 
              isStarred: false 
            });
          });
          
          console.log(`Auto-sync: Added ${newEmails.length} new emails`);
        }
      }
    } catch (err) {
      // Only show error for manual sync to avoid annoying auto-sync error popups
      if (isManual) {
        setError(err instanceof Error ? err.message : 'Failed to sync emails.');
      } else {
        console.error('Auto-sync failed:', err);
      }
    } finally {
      if (isManual) {
        setIsSyncing(false);
      } else {
        setIsAutoSyncing(false);
      }
    }
  }, [selectedFolder, fetchEmails, isSyncing]);

  // Set up auto-sync
  useEffect(() => {
    if (autoSyncEnabled) {
      autoSyncIntervalRef.current = setInterval(() => {
        syncEmails(false); // Auto-sync
      }, AUTO_SYNC_INTERVAL);
    } else {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    };
  }, [autoSyncEnabled, syncEmails]);

  // Initial fetch
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleManualSync = async () => {
    await syncEmails(true); // Manual sync
  };

  const handleFolderSelect = (folder: string) => {
    setSelectedFolder(folder);
    setSelectedEmail(null);
    setSelectedEmails([]);
  };

  const handleEmailSelect = (emailId: number) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const updateEmailState = (email: EmailData, updates: {isRead?: boolean, isStarred?: boolean}) => {
    const emailKey = `${email.id}_${email.message_id_header || email.imap_uid}`;
    
    setEmailStates(prev => ({
      ...prev,
      [emailKey]: {
        ...prev[emailKey],
        isRead: updates.isRead !== undefined ? updates.isRead : prev[emailKey]?.isRead || false,
        isStarred: updates.isStarred !== undefined ? updates.isStarred : prev[emailKey]?.isStarred || false,
      }
    }));

    setEmails(prev => 
      prev.map(e => 
        e.id === email.id 
          ? { ...e, ...updates }
          : e
      )
    );
  };

  const handleEmailToggleStar = (emailId: number) => {
    const email = emails.find(e => e.id === emailId);
    if (email) {
      updateEmailState(email, { isStarred: !email.isStarred });
    }
  };

  const handleEmailClick = (email: EmailData) => {
    setSelectedEmail(email);
    // Mark as read when clicked
    if (!email.isRead) {
      updateEmailState(email, { isRead: true });
    }
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
  };

  const toggleAutoSync = () => {
    setAutoSyncEnabled(prev => !prev);
  };

  // Compose handlers
  const handleCompose = () => {
    setComposeData({ type: 'compose' });
    setComposeModalOpen(true);
  };

  const handleEditDraft = (email: EmailData) => {
    setComposeData({
      type: 'draft',
      to: email.recipient?.split(',')[0]?.trim() || '',
      cc: email.recipient?.split(',').slice(1).join(',').trim() || '',
      subject: email.subject,
      body: email.body_text || email.body_full,
      draftId: email.id
    });
    setComposeModalOpen(true);
  };

  const handleReply = (email: EmailData) => {
    setComposeData({
      type: 'reply',
      to: email.sender,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.sender}\nSubject: ${email.subject}\nDate: ${email.received_date}\n\n${email.body_text || email.body_full}`,
      originalEmail: email
    });
    setComposeModalOpen(true);
  };

  const handleReplyAll = (email: EmailData) => {
    setComposeData({
      type: 'reply-all',
      to: email.sender,
      cc: email.recipient,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.sender}\nTo: ${email.recipient}\nSubject: ${email.subject}\nDate: ${email.received_date}\n\n${email.body_text || email.body_full}`,
      originalEmail: email
    });
    setComposeModalOpen(true);
  };

  const handleForward = (email: EmailData) => {
    setComposeData({
      type: 'forward',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${email.sender}\nTo: ${email.recipient}\nSubject: ${email.subject}\nDate: ${email.received_date}\n\n${email.body_text || email.body_full}`,
      originalEmail: email
    });
    setComposeModalOpen(true);
  };

  const handleDeleteEmail = async (emailId: number, permanent = false) => {
    try {
      const response = await apiClient.deleteEmail(emailId, permanent);
      
      // Remove email from current list immediately
      setEmails(prev => prev.filter(e => e.id !== emailId));
      // Also remove from search results if any
      if (searchResults.length > 0) {
        setSearchResults(prev => prev.filter(e => e.id !== emailId));
      }
      // Close the email view if the deleted email was currently being viewed
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmail(null);
      }
      
      // Show warning if IMAP operation failed
      if (response.status === 'warning') {
        console.warn('Email deleted locally but server operation had issues:', response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete email');
    }
  };

  const handleArchiveEmail = async (emailId: number) => {
    try {
      const response = await apiClient.archiveEmail(emailId);
      
      // Remove email from current list immediately
      setEmails(prev => prev.filter(e => e.id !== emailId));
      // Also remove from search results if any
      if (searchResults.length > 0) {
        setSearchResults(prev => prev.filter(e => e.id !== emailId));
      }
      // Close the email view if the archived email was currently being viewed
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmail(null);
      }
      
      // Show warning if IMAP operation failed
      if (response.status === 'warning') {
        console.warn('Email archived locally but server operation had issues:', response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive email');
    }
  };

  const handleRestoreEmail = async (emailId: number) => {
    try {
      const response = await apiClient.restoreEmail(emailId);
      
      // Remove email from current trash list immediately
      setEmails(prev => prev.filter(e => e.id !== emailId));
      // Also remove from search results if any
      if (searchResults.length > 0) {
        setSearchResults(prev => prev.filter(e => e.id !== emailId));
      }
      // Close the email view if the restored email was currently being viewed
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmail(null);
      }
      
      // Show warning if IMAP operation failed
      if (response.status === 'warning') {
        console.warn('Email restored locally but server operation had issues:', response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore email');
    }
  };

  const handleBulkAction = async (action: 'delete' | 'archive' | 'mark_read' | 'mark_unread' | 'restore') => {
    if (selectedEmails.length === 0) return;

    try {
      if (action === 'mark_read' || action === 'mark_unread') {
        // Handle read/unread locally with localStorage
        selectedEmails.forEach(emailId => {
          const email = emails.find(e => e.id === emailId);
          if (email) {
            updateEmailState(email, { isRead: action === 'mark_read' });
          }
        });
      } else {
        // Handle delete/archive on server
        const response = await apiClient.bulkEmailAction(selectedEmails, action);
        
        // Remove emails from current list immediately
        setEmails(prev => prev.filter(e => !selectedEmails.includes(e.id)));
        
        // Also remove from search results if any
        if (searchResults.length > 0) {
          setSearchResults(prev => prev.filter(e => !selectedEmails.includes(e.id)));
        }
        
        // Close the email view if the currently viewed email was deleted/archived
        if (selectedEmail && selectedEmails.includes(selectedEmail.id)) {
          setSelectedEmail(null);
        }
        
        // Show warning if some IMAP operations failed
        if (response.status === 'warning') {
          console.warn(`Bulk ${action} completed locally but some server operations had issues:`, response.message);
        }
      }
      
      // Clear selection
      setSelectedEmails([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} emails`);
    }
  };

  // Search functionality
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchQuery('');
      return;
    }

    setSearchQuery(query);
    setIsSearching(true);
    
    try {
      const response = await apiClient.searchEmails(query, selectedFolder);
      if (response?.emails) {
        const transformedResults = response.emails.map((email: any) => {
          const emailKey = `${email.id}_${email.message_id_header || email.imap_uid}`;
          const savedState = emailStates[emailKey] || { 
            isRead: selectedFolder === 'sent',
            isStarred: false 
          };
          
          return {
            ...email,
            isRead: savedState.isRead,
            isStarred: savedState.isStarred,
          };
        });
        setSearchResults(transformedResults);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAIReplyWithContent = (content: string) => {
    if (!selectedEmail) return;
    
    const replySubject = selectedEmail.subject?.startsWith('Re:') 
      ? selectedEmail.subject 
      : `Re: ${selectedEmail.subject || 'No Subject'}`;
    
    setComposeData({
      to: selectedEmail.sender,
      subject: replySubject,
      body: content,
      type: 'reply',
      originalEmail: selectedEmail
    });
    setComposeModalOpen(true);
    setAiAssistantOpen(false);
  };

  const handleOpenAIDraftImprover = (currentBody: string, onImproved: (improvedContent: string) => void) => {
    setCurrentDraftContent(currentBody);
    setAiDraftImproverOpen(true);
    
    // Store the callback for when improvement is completed
    setCurrentImprovementCallback(() => onImproved);
  };

  const handleAIDraftImprovement = (content: string) => {
    // Call the improvement callback to update the compose modal
    if (currentImprovementCallback) {
      currentImprovementCallback(content);
    }
    
    // Also update composeData for consistency
    if (composeData) {
      setComposeData({
        ...composeData,
        body: content
      });
    }
    
    setAiDraftImproverOpen(false);
    setCurrentImprovementCallback(null);
  };

  // Calculate unread counts for sidebar
  const unreadCount = emails.filter(email => !email.isRead && selectedFolder === 'inbox').length;
  const starredCount = emails.filter(email => email.isStarred).length;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Icons.menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Icons.mail className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AceMail</h1>
          </div>

          {selectedEmails.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center bg-gray-800 dark:bg-gray-700 px-3 py-2 rounded-full"
            >
              <Icons.check className="w-4 h-4 text-white mr-2" />
              <span className="text-sm font-medium text-white">
                {selectedEmails.length} email{selectedEmails.length !== 1 ? 's' : ''} selected
              </span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Search */}
          <div className="relative">
            <Icons.search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search mail"
              className="pl-10 pr-4 py-2 w-80 text-sm border border-gray-300 rounded-full bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <Icons.close className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Auto-sync toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAutoSync}
            className={cn(
              "text-xs font-medium px-3 py-2 rounded-full border transition-all",
              autoSyncEnabled 
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50" 
                : "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            <div className={cn(
              "w-2 h-2 rounded-full mr-2",
              autoSyncEnabled ? "bg-green-500 animate-pulse" : "bg-gray-400 dark:bg-gray-500"
            )} />
            Auto-sync {autoSyncEnabled ? 'ON' : 'OFF'}
          </Button>

          {/* Sync button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing || isAutoSyncing}
            className="border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 dark:hover:border-blue-500 disabled:opacity-50"
          >
            <Icons.refresh className={cn("h-4 w-4 mr-2", (isSyncing || isAutoSyncing) && "animate-spin")} />
            {isSyncing ? 'Syncing...' : isAutoSyncing ? 'Auto-syncing...' : 'Sync'}
          </Button>

          {/* Theme toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-all"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Icons.moon className="h-5 w-5" />
            ) : (
              <Icons.sun className="h-5 w-5" />
            )}
          </Button>

          {/* AI Assistant toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
            className={cn(
              "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-700 transition-all",
              aiAssistantOpen && "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
            )}
            title="AI Assistant"
          >
            <Icons.ai className="h-5 w-5" />
          </Button>

          {/* User menu */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{userEmail}</div>
            </div>
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {getInitials(userEmail)}
              </span>
            </div>
            <Button 
              variant="ghost" 
              onClick={onLogout}
              className="text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-700 font-medium transition-all"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.aside
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col"
            >
              {/* Compose button */}
              <div className="p-4">
                <Button className="w-full" size="lg" onClick={handleCompose}>
                  <Icons.plus className="h-5 w-5 mr-2" />
                  Compose
                </Button>
              </div>

              {/* Folders */}
              <nav className="flex-1 px-2 space-y-1">
                {folders.map((folder) => {
                  const Icon = folder.icon;
                  const isSelected = selectedFolder === folder.id;
                  const count = folder.count || (folder.id === 'inbox' ? unreadCount : folder.id === 'starred' ? starredCount : 0);

                  return (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderSelect(folder.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
                        isSelected
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{folder.label}</span>
                      </div>
                      {count > 0 && (
                        <span className="bg-gray-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {selectedEmail ? (
            /* Email view */
            <EmailView 
              email={selectedEmail} 
              onBack={handleBackToList}
              onToggleStar={() => handleEmailToggleStar(selectedEmail.id)}
              onReply={() => handleReply(selectedEmail)}
              onReplyAll={() => handleReplyAll(selectedEmail)}
              onForward={() => handleForward(selectedEmail)}
              onEdit={selectedEmail.folder === 'drafts' ? () => handleEditDraft(selectedEmail) : undefined}
              onDelete={() => handleDeleteEmail(selectedEmail.id, selectedEmail.folder === 'trash')}
              onArchive={() => handleArchiveEmail(selectedEmail.id)}
              onRestore={selectedEmail.folder === 'trash' ? () => handleRestoreEmail(selectedEmail.id) : undefined}
            />
          ) : (
            /* Email list */
                    <EmailList 
          emails={searchQuery ? searchResults : emails} 
          selectedEmails={selectedEmails} 
          onEmailSelect={handleEmailSelect} 
          onEmailToggleStar={handleEmailToggleStar} 
          onEmailClick={handleEmailClick}
          onBulkAction={handleBulkAction}
          onEditDraft={handleEditDraft}
          isLoading={isLoading || isSearching}
          selectedFolder={selectedFolder}
          error={error}
          isAutoSyncing={isAutoSyncing}
        />
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeModal 
        isOpen={composeModalOpen}
        onClose={() => {
          setComposeModalOpen(false);
          setComposeData(null);
        }}
        initialData={composeData}
        onOpenAIDraftImprover={handleOpenAIDraftImprover}
      />

      {/* AI Assistant */}
      <AIAssistant
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        selectedEmail={selectedEmail}
        onReplyWithContent={handleAIReplyWithContent}
      />

      {/* AI Draft Improver */}
      <AIDraftImprover
        isOpen={aiDraftImproverOpen}
        onClose={() => setAiDraftImproverOpen(false)}
        draftContent={currentDraftContent}
        onContentImproved={handleAIDraftImprovement}
      />
    </div>
  );
};

// Email List Component
const EmailList: React.FC<{
  emails: EmailData[];
  selectedEmails: number[];
  onEmailSelect: (emailId: number) => void;
  onEmailToggleStar: (emailId: number) => void;
  onEmailClick: (email: EmailData) => void;
  onBulkAction: (action: 'delete' | 'archive' | 'mark_read' | 'mark_unread' | 'restore') => void;
  onEditDraft: (email: EmailData) => void;
  isLoading: boolean;
  selectedFolder: string;
  error: string | null;
  isAutoSyncing: boolean;
}> = ({ emails, selectedEmails, onEmailSelect, onEmailToggleStar, onEmailClick, onBulkAction, onEditDraft, isLoading, selectedFolder, error, isAutoSyncing }) => {
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">Loading emails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {selectedFolder}
          </h2>
          {emails.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {emails.length} conversations
              {isAutoSyncing && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  • Auto-syncing...
                </span>
              )}
            </span>
          )}
        </div>

        {selectedEmails.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center space-x-2 bg-gray-800 dark:bg-gray-700 px-4 py-2 rounded-full"
          >
            <span className="text-sm font-medium text-white mr-2">
              {selectedEmails.length} selected
            </span>
            <button 
              onClick={() => onBulkAction('mark_read')}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 rounded-full transition-colors"
            >
              <Icons.read className="h-4 w-4 mr-2" />
              Mark Read
            </button>
            <button 
              onClick={() => onBulkAction('mark_unread')}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 rounded-full transition-colors"
            >
              <Icons.unread className="h-4 w-4 mr-2" />
              Mark Unread
            </button>
            {selectedFolder !== 'trash' && (
              <button 
                onClick={() => onBulkAction('archive')}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 rounded-full transition-colors"
              >
                <Icons.archive className="h-4 w-4 mr-2" />
                Archive
              </button>
            )}
            {selectedFolder === 'trash' && (
              <button 
                onClick={() => onBulkAction('restore')}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-full transition-colors"
              >
                <Icons.refresh className="h-4 w-4 mr-2" />
                Restore
              </button>
            )}
            <button 
              onClick={() => onBulkAction('delete')}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors"
            >
              <Icons.trash className="h-4 w-4 mr-2" />
              {selectedFolder === 'trash' ? 'Permanently Delete' : 'Delete'}
            </button>
          </motion.div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {emails.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <Icons.inbox className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No emails</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {selectedFolder === 'sent' 
                  ? 'Click "Sync" to load your sent emails.'
                  : `No emails in ${selectedFolder}.`
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {emails.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                isSelected={selectedEmails.includes(email.id)}
                onSelect={() => onEmailSelect(email.id)}
                onToggleStar={() => onEmailToggleStar(email.id)}
                onClick={() => selectedFolder === 'drafts' ? onEditDraft(email) : onEmailClick(email)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Email Row Component
const EmailRow: React.FC<{
  email: EmailData;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
  onClick: () => void;
}> = ({ email, isSelected, onSelect, onToggleStar, onClick }) => {
  const isUnread = !email.isRead;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
      className={cn(
        "flex items-center px-6 py-4 cursor-pointer transition-colors border-l-4",
        isSelected && "bg-blue-50 dark:bg-blue-900/20 border-l-blue-500 dark:border-l-blue-400",
        !isSelected && "border-l-transparent",
        isUnread && !isSelected && "bg-white dark:bg-gray-900",
        !isUnread && !isSelected && "bg-gray-50/50 dark:bg-gray-800/50"
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "mr-4 w-5 h-5 border rounded flex items-center justify-center transition-all",
          isSelected 
            ? "border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-400" 
            : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
        )}
      >
        {isSelected && <Icons.check className="w-3 h-3 text-white" />}
      </button>

      {/* Star */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        className="mr-4 text-gray-400 hover:text-yellow-500 transition-colors"
      >
        <Icons.star className={cn("w-5 h-5", email.isStarred && "fill-yellow-400 text-yellow-400")} />
      </button>

      {/* Avatar */}
      <div className="mr-4 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-white font-medium text-sm">
          {getInitials(email.sender)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className={cn(
            "text-sm truncate",
            isUnread ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"
          )}>
            {email.sender}
          </h3>
          <span className={cn(
            "text-xs ml-4 flex-shrink-0",
            isUnread ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"
          )}>
            {formatEmailDate(email.received_date)}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={cn(
            "text-sm truncate",
            isUnread ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
          )}>
            {email.subject || '[No Subject]'}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
            — {truncateText(email.body_preview, 100)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// Intelligent email content renderer based on backend analysis
const renderEmailContent = (email: EmailData) => {
  const emailType = email.email_type || 'unknown';
  const shouldPreserveLayout = email.should_preserve_layout || false;
  const shouldForceLeftAlign = email.should_force_left_align !== false; // Default to true
  const cleanedHtml = email.cleaned_html;

  // For designed emails (newsletters, marketing), preserve original layout but with proper scaling
  if (shouldPreserveLayout && (emailType === 'newsletter' || emailType === 'designed' || emailType === 'rich_html')) {
    return (
      <div className="max-w-4xl mx-auto">
        <style dangerouslySetInnerHTML={{
          __html: `
            .designed-email-content {
              max-width: 100%;
              overflow-x: auto;
            }
            .designed-email-content * {
              max-width: 100%;
              box-sizing: border-box;
            }
            .designed-email-content table {
              max-width: 100% !important;
              width: auto !important;
            }
            .designed-email-content img {
              max-width: 100% !important;
              height: auto !important;
            }
          `
        }} />
        <div 
          className="designed-email-content text-gray-800 dark:text-gray-200 leading-relaxed"
          style={{ fontSize: '14px', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{
            __html: (email.body_html || email.body_full || 'This email has no content to display.')
              // Fix large font sizes for better readability
              .replace(/font-size:\s*(\d+)px/gi, (match, size) => {
                const newSize = Math.min(parseInt(size), 16);
                return `font-size: ${newSize}px`;
              })
              // Remove fixed widths that might cause issues
              .replace(/width:\s*\d+px/gi, 'width: auto')
              .replace(/min-width:\s*\d+px/gi, 'min-width: auto')
          }}
        />
      </div>
    );
  }

  // For simple emails that need left alignment
  if (shouldForceLeftAlign && (emailType === 'simple_html' || emailType === 'plain_text')) {
    const contentToUse = cleanedHtml || email.body_html || email.body_text || email.body_full || email.body_preview;
    
    if (cleanedHtml || email.body_html) {
      return (
        <div className="max-w-4xl mx-auto">
          <style dangerouslySetInnerHTML={{
            __html: `
              .simple-email-content * {
                text-align: left !important;
                max-width: 100%;
                box-sizing: border-box;
              }
              .simple-email-content table {
                max-width: 100% !important;
                width: auto !important;
              }
              .simple-email-content img {
                max-width: 100% !important;
                height: auto !important;
              }
              .simple-email-content center {
                text-align: left !important;
              }
              .simple-email-content [align="center"],
              .simple-email-content [align="right"] {
                text-align: left !important;
              }
            `
          }} />
          <div 
            className="simple-email-content text-gray-800 dark:text-gray-200 leading-relaxed"
            style={{ 
              textAlign: 'left', 
              fontSize: '14px', 
              lineHeight: '1.6' 
            }}
            dangerouslySetInnerHTML={{ 
              __html: contentToUse
                .replace(/text-align:\s*(center|right)/gi, 'text-align: left')
                .replace(/align=["'](center|right)["']/gi, 'align="left"')
                .replace(/<center>/gi, '<div style="text-align: left;">')
                .replace(/<\/center>/gi, '</div>')
                .replace(/font-size:\s*(\d+)px/gi, (match, size) => {
                  const newSize = Math.min(parseInt(size), 16);
                  return `font-size: ${newSize}px`;
                })
            }} 
          />
        </div>
      );
    } else {
      return (
        <div className="max-w-4xl mx-auto">
          <div 
            className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap"
            style={{ 
              textAlign: 'left',
              fontSize: '14px',
              lineHeight: '1.6'
            }}
          >
            {contentToUse || 'This email has no content to display.'}
          </div>
        </div>
      );
    }
  }

  // Fallback for unknown types - preserve layout but with proper scaling
  const content = email.body_html || email.body_full || email.body_text || email.body_preview;
  
  if (email.body_html) {
    return (
      <div className="max-w-4xl mx-auto">
        <style dangerouslySetInnerHTML={{
          __html: `
            .fallback-email-content {
              max-width: 100%;
              overflow-x: auto;
            }
            .fallback-email-content * {
              max-width: 100%;
              box-sizing: border-box;
            }
            .fallback-email-content table {
              max-width: 100% !important;
              width: auto !important;
            }
            .fallback-email-content img {
              max-width: 100% !important;
              height: auto !important;
            }
          `
        }} />
        <div 
          className="fallback-email-content text-gray-800 dark:text-gray-200 leading-relaxed"
          style={{ fontSize: '14px', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{ 
            __html: (content || 'This email has no content to display.')
              .replace(/font-size:\s*(\d+)px/gi, (match, size) => {
                const newSize = Math.min(parseInt(size), 16);
                return `font-size: ${newSize}px`;
              })
          }} 
        />
      </div>
    );
  } else {
    return (
      <div className="max-w-4xl mx-auto">
        <div 
          className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap"
          style={{ 
            textAlign: 'left',
            fontSize: '14px',
            lineHeight: '1.6'
          }}
        >
          {content || 'This email has no content to display.'}
        </div>
      </div>
    );
  }
};

// Legacy utility function (kept for backwards compatibility)
const isPlainTextEmail = (html: string): boolean => {
  if (!html) return true;
  
  // Check for rich content indicators that suggest this is a designed email
  const hasRichContent = /(<table|<img|<a\s+href|background[-:]?color|font[-:]?family|<style|<link|colspan|rowspan)/i.test(html);
  
  // Check for explicit design/layout elements
  const hasDesignElements = /(width\s*[:=]|height\s*[:=]|margin|padding|border|float|position\s*:\s*(absolute|fixed|relative))/i.test(html);
  
  // If it has rich content or design elements, treat as HTML email
  return !hasRichContent && !hasDesignElements;
};

// Email View Component
const EmailView: React.FC<{
  email: EmailData;
  onBack: () => void;
  onToggleStar: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRestore?: () => void;
}> = ({ email, onBack, onToggleStar, onReply, onReplyAll, onForward, onEdit, onDelete, onArchive, onRestore }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex-1 flex flex-col bg-white dark:bg-gray-900 h-full overflow-hidden"
    >
      {/* Email header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <Icons.chevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {email.subject || '[No Subject]'}
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={onToggleStar}>
            <Icons.star className={cn("h-5 w-5", email.isStarred && "fill-yellow-400 text-yellow-400")} />
          </Button>
          <Button variant="ghost" size="icon">
            <Icons.more className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Email meta */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium">
              {getInitials(email.sender)}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{email.sender}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">to {email.recipient || 'me'}</p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {formatEmailDateDetailed(email.received_date)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-6 overflow-y-auto">
          <div className="max-w-none">
            {renderEmailContent(email)}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {onEdit ? (
              <Button onClick={onEdit}>
                <Icons.drafts className="h-4 w-4 mr-2" />
                Edit Draft
              </Button>
            ) : (
              <>
                <Button onClick={onReply}>
                  <Icons.reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                <Button variant="outline" onClick={onReplyAll}>
                  <Icons.replyAll className="h-4 w-4 mr-2" />
                  Reply All
                </Button>
                <Button variant="outline" onClick={onForward}>
                  <Icons.forward className="h-4 w-4 mr-2" />
                  Forward
                </Button>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {email.folder === 'trash' ? (
              <Button variant="outline" size="sm" onClick={onRestore} className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300">
                <Icons.refresh className="h-4 w-4 mr-1" />
                Restore
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onArchive}>
                <Icons.archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
              <Icons.trash className="h-4 w-4 mr-1" />
              {email.folder === 'trash' ? 'Permanently Delete' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default InboxPage;