import React from 'react';

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

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
              {formatDate(email.received_date)}
            </div>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900">
        <style dangerouslySetInnerHTML={{
          __html: `
            .email-content * {
              text-align: left !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .email-content table {
              text-align: left !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .email-content center {
              text-align: left !important;
            }
            .email-content [align="center"],
            .email-content [align="right"] {
              text-align: left !important;
            }
          `
        }} />
        <div className="prose prose-gray dark:prose-invert max-w-none text-left">
          {email.body_html ? (
            <div 
              className="email-content text-gmail-gray-800 dark:text-gray-200 leading-relaxed text-left [&>*]:!text-left [&_p]:!text-left [&_div]:!text-left [&_span]:!text-left [&_td]:!text-left [&_th]:!text-left [&_center]:!text-left [&_*]:!text-left [&_table]:!text-left [&_tr]:!text-left [&_h1]:!text-left [&_h2]:!text-left [&_h3]:!text-left [&_h4]:!text-left [&_h5]:!text-left [&_h6]:!text-left [&_li]:!text-left [&_ul]:!text-left [&_ol]:!text-left [&_blockquote]:!text-left [&_a]:text-blue-600 [&_a]:dark:text-blue-400"
              style={{ 
                textAlign: 'left' as const,
                direction: 'ltr' as const
              }}
              dangerouslySetInnerHTML={{ 
                __html: email.body_html
                  .replace(/text-align:\s*(center|right)/gi, 'text-align: left')
                  .replace(/align=["'](center|right)["']/gi, 'align="left"')
                  .replace(/<center>/gi, '<div style="text-align: left;">')
                  .replace(/<\/center>/gi, '</div>')
                  .replace(/style=["'][^"']*text-align:\s*(center|right)[^"']*["']/gi, 'style="text-align: left;"')
              }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-gmail-gray-800 dark:text-gray-200 leading-relaxed text-left" style={{ textAlign: 'left' }}>
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