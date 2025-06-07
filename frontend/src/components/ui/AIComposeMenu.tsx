import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface AIComposeMenuProps {
  onImproveContent: () => void;
  onGenerateContent: (prompt: string) => void;
  onToneChange: (tone: string) => void;
  hasContent: boolean;
  disabled?: boolean;
}

const AI_PROMPTS = [
  {
    id: 'professional',
    label: 'Professional Email',
    prompt: 'Write a professional business email',
    icon: 'settings' as keyof typeof Icons
  },
  {
    id: 'followup',
    label: 'Follow-up Email',
    prompt: 'Write a polite follow-up email',
    icon: 'reply' as keyof typeof Icons
  },
  {
    id: 'thankyou',
    label: 'Thank You Email',
    prompt: 'Write a thank you email',
    icon: 'star' as keyof typeof Icons
  },
  {
    id: 'meeting',
    label: 'Meeting Request',
    prompt: 'Write an email to schedule a meeting',
    icon: 'calendar' as keyof typeof Icons
  }
];

const TONE_OPTIONS = [
  { id: 'formal', label: 'More Formal', icon: 'improve' as keyof typeof Icons },
  { id: 'casual', label: 'More Casual', icon: 'chat' as keyof typeof Icons },
  { id: 'concise', label: 'Make Shorter', icon: 'sparkles' as keyof typeof Icons },
  { id: 'detailed', label: 'Add Details', icon: 'plus' as keyof typeof Icons }
];

export const AIComposeMenu: React.FC<AIComposeMenuProps> = ({
  onImproveContent,
  onGenerateContent,
  onToneChange,
  hasContent,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showTones, setShowTones] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowPrompts(false);
        setShowTones(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleGenerateFromPrompt = (contentType: string) => {
    onGenerateContent(contentType);
    setIsOpen(false);
    setShowPrompts(false);
  };

  const handleToneChange = (tone: string) => {
    onToneChange(tone);
    setIsOpen(false);
    setShowTones(false);
  };

  const handleImprove = () => {
    onImproveContent();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all",
          isOpen && "bg-blue-50 dark:bg-blue-900/20"
        )}
      >
        <Icons.ai className="h-4 w-4 mr-2" />
        AI Assistant
        <Icons.chevronDown className={cn("h-3 w-3 ml-1 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-1">
            {/* Main AI Options */}
            {!showPrompts && !showTones && (
              <div className="space-y-1">
                {hasContent && (
                  <>
                    <button
                      onClick={handleImprove}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      <Icons.improve className="h-4 w-4 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">Improve Content</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Enhance clarity and tone</div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setShowTones(true)}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      <Icons.sparkles className="h-4 w-4 mr-3" />
                      <div className="text-left flex-1">
                        <div className="font-medium">Change Tone</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Adjust formality and style</div>
                      </div>
                      <Icons.chevronRight className="h-3 w-3" />
                    </button>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  </>
                )}
                
                <button
                  onClick={() => setShowPrompts(true)}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  <Icons.compose className="h-4 w-4 mr-3" />
                  <div className="text-left flex-1">
                    <div className="font-medium">Generate Content</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Start with AI templates</div>
                  </div>
                  <Icons.chevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Tone Options Submenu */}
            {showTones && (
              <div className="space-y-1">
                <div className="flex items-center px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowTones(false)}
                    className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <Icons.chevronLeft className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Change Tone</span>
                </div>
                
                {TONE_OPTIONS.map((tone) => {
                  const ToneIcon = Icons[tone.icon];
                  return (
                    <button
                      key={tone.id}
                      onClick={() => handleToneChange(tone.id)}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      <ToneIcon className="h-4 w-4 mr-3" />
                      {tone.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content Generation Submenu */}
            {showPrompts && (
              <div className="space-y-1">
                <div className="flex items-center px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowPrompts(false)}
                    className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <Icons.chevronLeft className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generate Content</span>
                </div>
                
                {AI_PROMPTS.map((promptOption) => {
                  const PromptIcon = Icons[promptOption.icon];
                  return (
                    <button
                      key={promptOption.id}
                      onClick={() => handleGenerateFromPrompt(promptOption.id)}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      <PromptIcon className="h-4 w-4 mr-3" />
                      {promptOption.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 