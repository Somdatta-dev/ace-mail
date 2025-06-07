import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { apiClient } from '../../services/api';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmail?: any;
  onReplyWithContent?: (content: string) => void;
  onImproveDraft?: (content: string) => void;
}

interface AIFeature {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Icons;
  action: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  selectedEmail,
  onReplyWithContent,
  onImproveDraft
}) => {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [chatMode, setChatMode] = useState(false);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'ai', content: string}>>([]);

  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await apiClient.checkAIStatus();
        setAiEnabled(response.ai_enabled);
      } catch (error) {
        console.error('Failed to check AI status:', error);
        setAiEnabled(false);
      }
    };

    if (isOpen) {
      checkAIStatus();
    }
  }, [isOpen]);

  const handleSummarize = async () => {
    if (!selectedEmail || !aiEnabled) return;
    
    setLoading(true);
    setResult('');
    try {
      const response = await apiClient.summarizeEmail(selectedEmail.id);
      if (response.status === 'success' && response.summary) {
        setResult(response.summary);
      } else {
        setResult(response.message || 'Failed to summarize email');
      }
    } catch (error) {
      setResult('Error summarizing email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractActionItems = async () => {
    if (!selectedEmail || !aiEnabled) return;
    
    setLoading(true);
    setActionItems([]);
    try {
      const response = await apiClient.extractActionItems(selectedEmail.id);
      if (response.status === 'success' && response.action_items) {
        setActionItems(response.action_items);
        setResult(''); // Clear other results
      } else {
        setResult(response.message || 'No action items found');
      }
    } catch (error) {
      setResult('Error extracting action items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComposeReply = async () => {
    if (!selectedEmail || !aiEnabled) return;
    
    setLoading(true);
    try {
      const response = await apiClient.composeReply(selectedEmail.id);
      if (response.status === 'success' && response.reply) {
        onReplyWithContent?.(response.reply);
        setResult('Reply composed and opened in compose window.');
      } else {
        setResult(response.message || 'Failed to compose reply');
      }
    } catch (error) {
      setResult('Error composing reply. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorizeEmail = async () => {
    if (!selectedEmail || !aiEnabled) return;
    
    setLoading(true);
    try {
      const response = await apiClient.categorizeEmail(selectedEmail.id);
      if (response.status === 'success' && response.category) {
        setResult(`This email is categorized as: ${response.category.toUpperCase()}`);
      } else {
        setResult(response.message || 'Failed to categorize email');
      }
    } catch (error) {
      setResult('Error categorizing email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!selectedEmail || !aiEnabled || !question.trim()) return;
    
    setLoading(true);
    const userQuestion = question.trim();
    setChatHistory(prev => [...prev, { type: 'user', content: userQuestion }]);
    setQuestion('');
    
    try {
      const response = await apiClient.askAboutEmail(selectedEmail.id, userQuestion);
      if (response.status === 'success' && response.answer) {
        setChatHistory(prev => [...prev, { type: 'ai', content: response.answer! }]);
      } else {
        setChatHistory(prev => [...prev, { type: 'ai', content: response.message || 'Sorry, I could not answer that question.' }]);
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { type: 'ai', content: 'Error processing your question. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const features: AIFeature[] = [
    {
      id: 'summarize',
      title: 'Summarize this email',
      description: 'Get a brief summary of the main points',
      icon: 'sparkles',
      action: handleSummarize
    },
    {
      id: 'actions',
      title: 'List action items',
      description: 'Extract tasks and action items from this email',
      icon: 'actionItems',
      action: handleExtractActionItems
    },
    {
      id: 'reply',
      title: 'Help me reply',
      description: 'Generate a professional reply',
      icon: 'reply',
      action: handleComposeReply
    },
    {
      id: 'categorize',
      title: 'Categorize email',
      description: 'Identify the type and priority of this email',
      icon: 'brain',
      action: handleCategorizeEmail
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Icons.ai className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Assistant</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        >
          <Icons.close className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!aiEnabled && (
          <div className="text-center py-8">
            <Icons.ai className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">AI features are not available</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Check your OpenAI API configuration</p>
          </div>
        )}

        {aiEnabled && !selectedEmail && (
          <div className="text-center py-8">
            <Icons.mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select an email to use AI features</p>
          </div>
        )}

        {aiEnabled && selectedEmail && !chatMode && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              What can AI do with this email?
            </div>
            
            {features.map((feature) => {
              const Icon = Icons[feature.icon];
              return (
                <button
                  key={feature.id}
                  onClick={feature.action}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{feature.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{feature.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => setChatMode(true)}
              disabled={loading}
              className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <Icons.chat className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Ask a question</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Chat with AI about this email</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {aiEnabled && selectedEmail && chatMode && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setChatMode(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                <Icons.chevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">Ask about this email</span>
            </div>

            {/* Chat History */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-100 dark:bg-blue-900/30 ml-4'
                      : 'bg-gray-100 dark:bg-gray-800 mr-4'
                  }`}
                >
                  <div className="text-sm">
                    <span className="font-medium">
                      {message.type === 'user' ? 'You' : 'AI'}:
                    </span>
                  </div>
                  <div className="text-sm mt-1">{message.content}</div>
                </div>
              ))}
            </div>

            {/* Question Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleAskQuestion()}
                placeholder="Ask a question about this email..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={handleAskQuestion}
                disabled={loading || !question.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Icons.send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Icons.brain className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
              <span className="text-sm text-blue-600 dark:text-blue-400">AI is thinking...</span>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">
              {result}
            </div>
          </div>
        )}

        {actionItems.length > 0 && !loading && (
          <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Icons.actionItems className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="font-medium text-orange-800 dark:text-orange-200">Action Items</span>
            </div>
            <ul className="space-y-2">
              {actionItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Icons.check className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-orange-800 dark:text-orange-200">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* More Suggestions */}
      {aiEnabled && selectedEmail && !chatMode && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <button
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
            onClick={() => setChatMode(true)}
          >
            More suggestions
            <Icons.chevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}; 