import React from 'react';
import { StarIcon, StarSolidIcon, CheckIcon } from './icons';

interface EmailData {
  id: number;
  sender: string;
  subject: string;
  body_preview: string;
  received_date: string;
  message_id_header?: string;
  imap_uid?: number;
  isRead?: boolean;
  isStarred?: boolean;
  isSelected?: boolean;
}

interface EmailListProps {
  emails: EmailData[];
  selectedEmails: number[];
  onEmailSelect: (emailId: number) => void;
  onEmailToggleStar: (emailId: number) => void;
  onEmailClick: (email: EmailData) => void;
  isLoading?: boolean;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmails,
  onEmailSelect,
  onEmailToggleStar,
  onEmailClick,
  isLoading = false
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    } else if (isThisYear) {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-gmail-gray-500 dark:text-gray-400">Loading emails...</div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-gmail-gray-500 dark:text-gray-400">No emails to display</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      {emails.map((email) => {
        const isSelected = selectedEmails.includes(email.id);
        const isRead = email.isRead ?? true; // Default to read if not specified
        const isStarred = email.isStarred ?? false;

        return (
          <div
            key={email.id}
            className={`
              flex items-center px-4 py-3 border-b border-gmail-gray-100 dark:border-gray-700 hover:shadow-sm cursor-pointer transition-colors
              ${isSelected ? 'bg-gmail-blue bg-opacity-10 dark:bg-blue-900 dark:bg-opacity-30' : 'bg-white dark:bg-gray-900 hover:bg-gmail-gray-50 dark:hover:bg-gray-800'}
              ${!isRead ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : ''}
            `}
            onClick={() => onEmailClick(email)}
          >
            {/* Checkbox */}
            <div className="mr-4 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEmailSelect(email.id);
                }}
                className="w-5 h-5 border border-gmail-gray-300 dark:border-gray-600 rounded flex items-center justify-center hover:border-gmail-gray-500 dark:hover:border-gray-400"
              >
                {isSelected && <CheckIcon className="w-3 h-3 text-gmail-blue dark:text-blue-400" />}
              </button>
            </div>

            {/* Star */}
            <div className="mr-4 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEmailToggleStar(email.id);
                }}
                className="text-gmail-gray-400 dark:text-gray-500 hover:text-yellow-500"
              >
                {isStarred ? (
                  <StarSolidIcon className="w-5 h-5 text-yellow-500" />
                ) : (
                  <StarIcon className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Email Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* Sender */}
                  <div className={`text-sm ${!isRead ? 'font-bold text-black dark:text-white' : 'font-medium text-gmail-gray-700 dark:text-gray-300'}`}>
                    {truncateText(email.sender, 30)}
                  </div>
                  
                  {/* Subject and Preview */}
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-sm ${!isRead ? 'font-semibold text-black dark:text-white' : 'text-gmail-gray-700 dark:text-gray-300'}`}>
                      {truncateText(email.subject || '[No Subject]', 50)}
                    </span>
                    <span className="text-sm text-gmail-gray-500 dark:text-gray-400">
                      - {truncateText(email.body_preview, 100)}
                    </span>
                  </div>
                </div>

                {/* Date */}
                <div className="ml-4 flex-shrink-0">
                  <span className={`text-xs ${!isRead ? 'font-semibold text-black dark:text-white' : 'text-gmail-gray-500 dark:text-gray-400'}`}>
                    {formatDate(email.received_date)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EmailList; 