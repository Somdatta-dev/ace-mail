import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Icons } from './ui/Icons';
import { Button } from './ui/Button';
import { AIComposeMenu } from './ui/AIComposeMenu';
import { apiClient } from '../services/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    type?: 'compose' | 'reply' | 'reply-all' | 'forward' | 'draft';
    originalEmail?: any;
    draftId?: number;
  };
  onOpenAIDraftImprover?: (currentBody: string, onImproved: (improvedContent: string) => void) => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, initialData, onOpenAIDraftImprover }) => {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isHtml, setIsHtml] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAutoSaveRef = useRef<string>('');

  // Auto-save interval (5 seconds)
  const AUTO_SAVE_DELAY = 5000;

  // Initialize form with provided data
  useEffect(() => {
    if (initialData) {
      setTo(initialData.to || '');
      setCc(initialData.cc || '');
      setBcc(initialData.bcc || '');
      setSubject(initialData.subject || '');
      setBody(initialData.body || '');
      setShowCc(!!initialData.cc);
      setShowBcc(!!initialData.bcc);
      setDraftId(initialData.draftId || null);
      
      if (initialData.type === 'draft') {
        setLastSaved(new Date());
      }
    }
  }, [initialData]);

  // Auto-save functionality
  const saveDraftAuto = useCallback(async () => {
    if (!hasUnsavedChanges) return;

    const currentContent = JSON.stringify({ to, cc, bcc, subject, body, isHtml });
    
    // Don't save if content hasn't changed
    if (currentContent === lastAutoSaveRef.current) return;
    
    // Don't auto-save empty drafts
    if (!to.trim() && !cc.trim() && !bcc.trim() && !subject.trim() && !body.trim()) return;

    try {
      setIsSavingDraft(true);
      
      const draftData = {
        to: to.trim(),
        cc: cc.trim(),
        bcc: bcc.trim(),
        subject: subject.trim(),
        body: body,
        is_html: isHtml
      };

      let result;
      if (draftId) {
        result = await apiClient.updateDraft(draftId, draftData);
      } else {
        result = await apiClient.saveDraft(draftData);
        if (result.draft_id) {
          setDraftId(result.draft_id);
        }
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      lastAutoSaveRef.current = currentContent;
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setIsSavingDraft(false);
    }
  }, [to, cc, bcc, subject, body, isHtml, draftId, hasUnsavedChanges]);

  // Set up auto-save timer when content changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveDraftAuto();
      }, AUTO_SAVE_DELAY);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, saveDraftAuto]);

  // Mark as having unsaved changes when form data changes
  useEffect(() => {
    const currentContent = JSON.stringify({ to, cc, bcc, subject, body, isHtml });
    const initialContent = JSON.stringify({ 
      to: initialData?.to || '', 
      cc: initialData?.cc || '', 
      bcc: initialData?.bcc || '', 
      subject: initialData?.subject || '', 
      body: initialData?.body || '', 
      isHtml: false 
    });
    
    if (currentContent !== initialContent && currentContent !== lastAutoSaveRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [to, cc, bcc, subject, body, isHtml, initialData]);

  const handleSend = async () => {
    if (!to.trim()) {
      setError('Recipient email is required');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      await apiClient.sendEmail({
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        body: body,
        is_html: isHtml,
        attachments: attachments.length > 0 ? attachments : undefined
      });

      // Delete draft if it exists (since email was sent)
      if (draftId) {
        try {
          await apiClient.deleteDraft(draftId);
        } catch (err) {
          console.error('Failed to delete draft after sending:', err);
        }
      }

      // Reset form and close modal
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!to.trim() && !cc.trim() && !bcc.trim() && !subject.trim() && !body.trim()) {
      setError('Cannot save empty draft');
      return;
    }

    setIsSavingDraft(true);
    setError('');

    try {
      const draftData = {
        to: to.trim(),
        cc: cc.trim(),
        bcc: bcc.trim(),
        subject: subject.trim(),
        body: body,
        is_html: isHtml
      };

      let result;
      if (draftId) {
        result = await apiClient.updateDraft(draftId, draftData);
      } else {
        result = await apiClient.saveDraft(draftData);
        if (result.draft_id) {
          setDraftId(result.draft_id);
        }
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      lastAutoSaveRef.current = JSON.stringify({ to, cc, bcc, subject, body, isHtml });
      
      // Close modal after saving draft
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleClose = async () => {
    if (!isSending) {
      // Auto-save before closing if there are unsaved changes
      if (hasUnsavedChanges && (to.trim() || cc.trim() || bcc.trim() || subject.trim() || body.trim())) {
        await saveDraftAuto();
      }
      onClose();
    }
  };

  const resetForm = () => {
    setTo('');
    setCc('');
    setBcc('');
    setSubject('');
    setBody('');
    setShowCc(false);
    setShowBcc(false);
    setIsHtml(false);
    setAttachments([]);
    setDraftId(null);
    setLastSaved(null);
    setHasUnsavedChanges(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    setHasUnsavedChanges(true);
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    return date.toLocaleDateString();
  };

  const handleAIGeneration = async (contentType: string) => {
    try {
      setError('');
      setIsSavingDraft(true);
      
      // Use the content type directly (it's now an ID, not a prompt)
      const type = contentType;
      
      // Pass original email ID if this is a reply/forward
      const emailId = initialData?.originalEmail?.id;
      
      // Call AI API to generate content with context
      const response = await apiClient.generateContent(type, emailId);
      
      if (response.status === 'success' && response.generated_content) {
        setBody(response.generated_content);
        setHasUnsavedChanges(true);
      } else {
        setError('Failed to generate AI content');
      }
    } catch (err) {
      setError('AI generation failed. Please try again.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleToneChange = (tone: string) => {
    // For tone changes, we'll open the draft improver with a specific type
    if (onOpenAIDraftImprover) {
      onOpenAIDraftImprover(body, (improvedContent: string) => {
        setBody(improvedContent);
        setHasUnsavedChanges(true);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {initialData?.type === 'reply' ? 'Reply' :
                 initialData?.type === 'reply-all' ? 'Reply All' :
                 initialData?.type === 'forward' ? 'Forward' :
                 initialData?.type === 'draft' ? 'Edit Draft' : 'Compose'}
              </h2>
              
              {/* Auto-save status */}
              <div className="flex items-center space-x-2 text-sm">
                {isSavingDraft && (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center">
                    <Icons.refresh className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </span>
                )}
                {lastSaved && !isSavingDraft && (
                  <span className="text-gray-500 dark:text-gray-400">
                    Saved {formatLastSaved(lastSaved)}
                  </span>
                )}
                {hasUnsavedChanges && !isSavingDraft && (
                  <span className="text-orange-600 dark:text-orange-400">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="attachment-input"
                disabled={isSending}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => document.getElementById('attachment-input')?.click()}
                disabled={isSending}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Attach files"
              >
                <Icons.attachment className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsHtml(!isHtml)}
                className={cn(
                  "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100",
                  isHtml && "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                )}
                title={isHtml ? "Switch to Plain Text" : "Switch to HTML"}
              >
                <Icons.fileText className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleClose} 
                disabled={isSending}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Icons.close className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Form */}
          <div className="flex flex-col h-[600px]">
            {/* Recipients */}
            <div className="px-6 py-4 space-y-3 border-b border-gray-200 dark:border-gray-700">
              {/* To */}
              <div className="flex items-center space-x-3">
                <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">
                  To
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Recipients"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSending}
                />
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCc(!showCc)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    Cc
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBcc(!showBcc)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    Bcc
                  </Button>
                </div>
              </div>

              {/* CC */}
              {showCc && (
                <div className="flex items-center space-x-3">
                  <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cc
                  </label>
                  <input
                    type="email"
                    value={cc}
                    onChange={(e) => {
                      setCc(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Carbon copy"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSending}
                  />
                </div>
              )}

              {/* BCC */}
              {showBcc && (
                <div className="flex items-center space-x-3">
                  <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Bcc
                  </label>
                  <input
                    type="email"
                    value={bcc}
                    onChange={(e) => {
                      setBcc(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Blind carbon copy"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSending}
                  />
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center space-x-3">
                <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Subject"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSending}
                />
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-md px-3 py-2"
                      >
                        <Icons.attachment className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({formatFileSize(file.size)})
                        </span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-1"
                          disabled={isSending}
                        >
                          <Icons.close className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-4">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Message</div>
                  {onOpenAIDraftImprover && (
                    <AIComposeMenu
                      onImproveContent={() => onOpenAIDraftImprover(body, (improvedContent: string) => {
                        setBody(improvedContent);
                        setHasUnsavedChanges(true);
                      })}
                      onGenerateContent={handleAIGeneration}
                      onToneChange={handleToneChange}
                      hasContent={body.trim().length > 0}
                      disabled={isSending}
                    />
                  )}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={isHtml ? "Write your HTML email..." : "Write your message..."}
                  className="w-full flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSending}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-6 py-2">
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                  {error}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                {isHtml && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">HTML</span>}
                {attachments.length > 0 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                    {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <Button 
                  variant="outline" 
                  onClick={handleSaveDraft} 
                  disabled={isSending || isSavingDraft}
                >
                  {isSavingDraft ? (
                    <>
                      <Icons.refresh className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icons.drafts className="h-4 w-4 mr-2" />
                      Save Draft
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleClose} disabled={isSending}>
                  Cancel
                </Button>
                <Button onClick={handleSend} disabled={isSending}>
                  {isSending ? (
                    <>
                      <Icons.refresh className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Icons.send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ComposeModal; 