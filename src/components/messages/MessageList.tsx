
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  StarOff,
  Archive,
  Trash2,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  from_address: string;
  to_address: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
  client_id?: string;
  sent_via: string;
  read?: boolean;
  starred?: boolean;
}

interface MessageListProps {
  messages: EmailMessage[];
  selectedMessages: Set<string>;
  selectedMessage: EmailMessage | null;
  onSelectMessage: (message: EmailMessage) => void;
  onSelectMessageCheckbox: (messageId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
}

export const MessageList = ({
  messages,
  selectedMessages,
  selectedMessage,
  onSelectMessage,
  onSelectMessageCheckbox,
  onSelectAll
}: MessageListProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const allSelected = messages.length > 0 && messages.every(m => selectedMessages.has(m.id));

  return (
    <div className="w-96 border-r bg-white flex flex-col">
      {/* List Header */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
          />
          <span className="text-sm font-medium text-gray-700">
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-lg mb-2">No messages found</div>
            <p className="text-sm">Your messages will appear here</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              isSelected={selectedMessages.has(message.id)}
              isActive={selectedMessage?.id === message.id}
              onSelect={() => onSelectMessage(message)}
              onCheckboxChange={(checked) => onSelectMessageCheckbox(message.id, checked)}
              formatDate={formatDate}
              truncateText={truncateText}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface MessageRowProps {
  message: EmailMessage;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onCheckboxChange: (checked: boolean) => void;
  formatDate: (date: string) => string;
  truncateText: (text: string, length?: number) => string;
}

const MessageRow = ({
  message,
  isSelected,
  isActive,
  onSelect,
  onCheckboxChange,
  formatDate,
  truncateText
}: MessageRowProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 group",
        isActive && "bg-blue-50 border-blue-200",
        !message.read && "bg-blue-25"
      )}
      onClick={onSelect}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={onCheckboxChange}
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />

      {/* Star */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          // Toggle star functionality
        }}
      >
        {message.starred ? (
          <Star className="h-4 w-4 text-yellow-400 fill-current" />
        ) : (
          <StarOff className="h-4 w-4 text-gray-400" />
        )}
      </Button>

      {/* Direction Indicator */}
      <div className="flex-shrink-0">
        {message.direction === 'incoming' ? (
          <ArrowDown className="w-4 h-4 text-green-600" />
        ) : (
          <ArrowUp className="w-4 h-4 text-blue-600" />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div
            className={cn(
              "text-sm truncate",
              !message.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"
            )}
          >
            {message.direction === 'incoming' ? message.from_address : message.to_address}
          </div>
          <div className="flex items-center gap-1">
            {message.sent_via !== 'email' && (
              <Badge variant="outline" className="text-xs">
                {message.sent_via}
              </Badge>
            )}
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatDate(message.created_at)}
            </span>
          </div>
        </div>
        
        <div
          className={cn(
            "text-sm truncate mb-1",
            !message.read ? "font-medium text-gray-900" : "text-gray-600"
          )}
        >
          {message.subject || 'No Subject'}
        </div>
        
        <div className="text-xs text-gray-500 truncate">
          {truncateText(message.body)}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            // Archive action
          }}
        >
          <Archive className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
          onClick={(e) => {
            e.stopPropagation();
            // Delete action
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
