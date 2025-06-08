import React from 'react';
import { formatEmailDateDetailed } from '../lib/utils';

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
}

interface EmailViewProps {
  email?: EmailData | null;
  onClose: () => void;
}

const EmailView: React.FC<EmailViewProps> = ({ email, onClose }) => {
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gmail-gray-50 dark:bg-gray-800">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-gmail-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gmail-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gmail-gray-700 dark:text-gray-300 mb-2">Select an email to read</h3>
          <p className="text-gmail-gray-500 dark:text-gray-400">Choose an email from the list to view its contents here.</p>
        </div>
      </div>
    );
  }



  return (
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col">
      {/* Email Header */}
      <div className="border-b border-gmail-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-normal text-gmail-gray-900 dark:text-gray-100 pr-4">
            {email.subject || '[No Subject]'}
          </h1>
          <button
            onClick={onClose}
            className="text-gmail-gray-400 dark:text-gray-500 hover:text-gmail-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Sender Avatar */}
              <div className="w-10 h-10 bg-gmail-blue dark:bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {email.sender.charAt(0).toUpperCase()}
                </span>
              </div>
              
              <div>
                <div className="font-medium text-gmail-gray-900 dark:text-gray-100">{email.sender}</div>
                <div className="text-sm text-gmail-gray-600 dark:text-gray-400">
                  to {email.recipient || 'me'}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gmail-gray-500 dark:text-gray-400">
              {formatEmailDateDetailed(email.received_date)}
            </div>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          {email.body_html ? (
            <div className="email-html-content">
              <style dangerouslySetInnerHTML={{
                __html: `
                  .email-html-content {
                    max-width: 100%;
                    overflow-x: auto;
                  }
                  .email-html-content * {
                    max-width: 100%;
                    box-sizing: border-box;
                  }
                  .email-html-content table {
                    max-width: 100% !important;
                    width: auto !important;
                    height: auto !important;
                  }
                  .email-html-content img {
                    max-width: 100% !important;
                    height: auto !important;
                  }
                  .email-html-content p, 
                  .email-html-content div, 
                  .email-html-content span {
                    text-align: left !important;
                  }
                  .email-html-content center {
                    text-align: left !important;
                  }
                  .email-html-content [align="center"],
                  .email-html-content [align="right"] {
                    text-align: left !important;
                  }
                  .email-html-content a {
                    color: #2563eb;
                    text-decoration: underline;
                  }
                  .dark .email-html-content a {
                    color: #60a5fa;
                  }
                `
              }} />
              <div 
                className="text-gray-800 dark:text-gray-200 leading-relaxed"
                style={{ 
                  textAlign: 'left',
                  direction: 'ltr',
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}
                dangerouslySetInnerHTML={{ 
                  __html: email.body_html
                    // Fix text alignment
                    .replace(/text-align:\s*(center|right)/gi, 'text-align: left')
                    .replace(/align=["'](center|right)["']/gi, 'align="left"')
                    .replace(/<center>/gi, '<div style="text-align: left;">')
                    .replace(/<\/center>/gi, '</div>')
                    // Fix table and font sizing for better readability
                    .replace(/font-size:\s*(\d+)px/gi, (match, size) => {
                      const newSize = Math.min(parseInt(size), 16);
                      return `font-size: ${newSize}px`;
                    })
                    // Remove fixed widths that might cause horizontal scroll
                    .replace(/width:\s*\d+px/gi, 'width: auto')
                    .replace(/min-width:\s*\d+px/gi, 'min-width: auto')
                }}
              />
            </div>
          ) : (
            <div 
              className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed"
              style={{ 
                textAlign: 'left',
                fontSize: '14px',
                lineHeight: '1.6'
              }}
            >
              {email.body_full || email.body_text || email.body_preview || 'This email has no content to display.'}
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t border-gmail-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-gmail-blue dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">
            Reply
          </button>
          <button className="px-4 py-2 text-gmail-gray-600 dark:text-gray-300 border border-gmail-gray-300 dark:border-gray-600 rounded hover:bg-gmail-gray-50 dark:hover:bg-gray-800 transition-colors">
            Reply All
          </button>
          <button className="px-4 py-2 text-gmail-gray-600 dark:text-gray-300 border border-gmail-gray-300 dark:border-gray-600 rounded hover:bg-gmail-gray-50 dark:hover:bg-gray-800 transition-colors">
            Forward
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailView; 