import React, { useState } from 'react';
import { Icons } from './Icons';
import { apiClient } from '../../services/api';

interface AIDraftImproverProps {
  isOpen: boolean;
  onClose: () => void;
  draftContent: string;
  onContentImproved: (improvedContent: string) => void;
}

const improvementTypes = [
  { id: 'general', label: 'General', description: 'Improve clarity and effectiveness' },
  { id: 'formal', label: 'More Formal', description: 'Make the tone more professional' },
  { id: 'casual', label: 'More Casual', description: 'Make the tone more friendly' },
  { id: 'concise', label: 'More Concise', description: 'Shorten while keeping key info' },
  { id: 'grammar', label: 'Fix Grammar', description: 'Correct grammar and spelling' }
];

export const AIDraftImprover: React.FC<AIDraftImproverProps> = ({
  isOpen,
  onClose,
  draftContent,
  onContentImproved
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('general');

  const handleImprove = async () => {
    if (!draftContent.trim()) return;
    
    setLoading(true);
    setResult('');
    
    try {
      const response = await apiClient.improveDraft(draftContent, selectedType as any);
      if (response.status === 'success' && response.improved_content) {
        setResult(response.improved_content);
      } else {
        setResult(response.message || 'Failed to improve draft');
      }
    } catch (error) {
      setResult('Error improving draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseImprovement = () => {
    if (result) {
      onContentImproved(result);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Icons.improve className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Draft Improver</h2>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Original & Controls */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Original Draft</h3>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {draftContent || 'No content to improve'}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Improvement Type</h3>
                <div className="space-y-2">
                  {improvementTypes.map((type) => (
                    <label key={type.id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="improvementType"
                        value={type.id}
                        checked={selectedType === type.id}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{type.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{type.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleImprove}
                disabled={loading || !draftContent.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Icons.brain className="w-4 h-4 animate-pulse" />
                    AI is improving...
                  </>
                ) : (
                  <>
                    <Icons.improve className="w-4 h-4" />
                    Improve Draft
                  </>
                )}
              </button>
            </div>

            {/* Right: Improved Version */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Improved Version</h3>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Icons.brain className="w-6 h-6 text-green-600 dark:text-green-400 animate-pulse" />
                    </div>
                  ) : result ? (
                    <div className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {result}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                      Click "Improve Draft" to see the AI-enhanced version
                    </div>
                  )}
                </div>
              </div>

              {result && !loading && (
                <div className="space-y-2">
                  <button
                    onClick={handleUseImprovement}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icons.check className="w-4 h-4" />
                    Use This Version
                  </button>
                  <button
                    onClick={() => setResult('')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              AI suggestions are generated by OpenAI and should be reviewed before use.
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 