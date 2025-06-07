import React from 'react';
import {
  InboxIcon,
  StarIcon,
  PaperAirplaneIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  PlusIcon,
} from './icons';
import { classNames } from '../utils/classNames';

interface SidebarProps {
  selectedFolder: string;
  onFolderSelect: (folder: string) => void;
  unreadCounts?: { [key: string]: number };
}

const menuItems = [
  { id: 'inbox', label: 'Inbox', icon: InboxIcon, defaultCount: 5 },
  { id: 'starred', label: 'Starred', icon: StarIcon },
  { id: 'sent', label: 'Sent', icon: PaperAirplaneIcon },
  { id: 'drafts', label: 'Drafts', icon: ArchiveBoxIcon },
  { id: 'spam', label: 'Spam', icon: ExclamationTriangleIcon },
  { id: 'trash', label: 'Trash', icon: TrashIcon },
];

const labels = [
  { id: 'work', label: 'Work', color: 'bg-blue-500' },
  { id: 'personal', label: 'Personal', color: 'bg-green-500' },
  { id: 'important', label: 'Important', color: 'bg-red-500' },
];

const Sidebar: React.FC<SidebarProps> = ({ selectedFolder, onFolderSelect, unreadCounts = {} }) => {
  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gmail-gray-200 dark:border-gray-700 h-full flex flex-col">
      {/* Compose Button */}
      <div className="p-4">
        <button className="w-full bg-gmail-blue text-white rounded-full py-3 px-6 flex items-center justify-center space-x-2 hover:bg-blue-600 transition-colors shadow-lg">
          <PlusIcon className="h-5 w-5" />
          <span className="font-medium">Compose</span>
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-2">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const count = unreadCounts[item.id] || (item.id === 'inbox' ? item.defaultCount : 0);
            const isSelected = selectedFolder === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onFolderSelect(item.id)}
                className={classNames(
                  'w-full flex items-center justify-between px-4 py-2 rounded-r-full text-left transition-colors',
                  isSelected
                    ? 'bg-gmail-red bg-opacity-10 text-gmail-red border-r-4 border-gmail-red'
                    : 'text-gmail-gray-700 hover:bg-gmail-gray-100'
                )}
              >
                <div className="flex items-center space-x-4">
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
                {(count ?? 0) > 0 && (
                  <span className="text-xs bg-gmail-gray-600 text-white rounded-full px-2 py-1 min-w-[20px] text-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Labels Section */}
        <div className="mt-8">
          <h3 className="px-4 text-sm font-medium text-gmail-gray-600 mb-2">Labels</h3>
          <div className="space-y-1">
            {labels.map((label) => (
              <button
                key={label.id}
                onClick={() => onFolderSelect(label.id)}
                className={classNames(
                  'w-full flex items-center space-x-4 px-4 py-2 rounded-r-full text-left transition-colors',
                  selectedFolder === label.id
                    ? 'bg-gmail-red bg-opacity-10 text-gmail-red'
                    : 'text-gmail-gray-700 hover:bg-gmail-gray-100'
                )}
              >
                <div className={classNames('w-3 h-3 rounded-full', label.color)}></div>
                <span className="font-medium">{label.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-gmail-gray-200">
        <button className="w-full flex items-center space-x-4 px-4 py-2 text-gmail-gray-700 hover:bg-gmail-gray-100 rounded-r-full transition-colors">
          <Cog6ToothIcon className="h-5 w-5" />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 