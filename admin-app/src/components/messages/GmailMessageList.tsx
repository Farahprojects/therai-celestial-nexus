import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { 
  Star, 
  StarOff, 
  Archive, 
  Trash2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EmailMessage } from "../../types/email";

interface GmailMessageListProps {
  messages: EmailMessage[];
  selectedMessages: Set<string>;
  onSelectMessage: (message: EmailMessage) => void;
  onSelectMessageCheckbox: (messageId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onArchiveSelected: () => void;
  onDeleteSelected: () => void;
  onToggleStar: (message: EmailMessage) => void;
  mobileDense?: boolean; // NEW: allow dense/compact layout for mobile
}

export const GmailMessageList = ({
  messages,
  selectedMessages,
  onSelectMessage,
  onSelectMessageCheckbox,
  onSelectAll,
  onArchiveSelected,
  onDeleteSelected,
  onToggleStar,
  mobileDense = false // Default is false
}: GmailMessageListProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
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

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const allSelected = messages.length > 0 && messages.every(m => selectedMessages.has(m.id));

  return (
    <div className="w-full bg-white flex flex-col h-[calc(100vh-8rem)]">
      {/* Toolbar */}
      <div
        className="border-b bg-gray-50/50 flex-shrink-0"
      >
        {/* Change to grid layout for perfect alignment */}
        <div className="grid grid-cols-[48px_1fr_90px] items-center px-2 py-2">
          {/* First col: checkbox + actions (aligned with row checkboxes) */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => onSelectAll(checked === true)}
              className="rounded"
            />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onArchiveSelected}>
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onDeleteSelected}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          {/* Middle col: (empty, for now; aligns with row grid) */}
          <div />
          {/* Right col: (empty, placeholder for potential future actions) */}
          <div />
        </div>
      </div>

      {/* Message List - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-lg mb-2">No messages found</div>
            <p className="text-sm">Your messages will appear here</p>
          </div>
        ) : (
          <div>
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                isSelected={selectedMessages.has(message.id)}
                onSelect={() => onSelectMessage(message)}
                onCheckboxChange={(checked) => onSelectMessageCheckbox(message.id, checked)}
                formatDate={formatDate}
                truncateText={truncateText}
                onToggleStar={() => onToggleStar(message)}
                mobileDense={mobileDense}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Utility: get first word of name or email (e.g. "Peter" from "Peter Farah" or "peter@company.com")
const getSenderShortName = (address: string) => {
  if (!address) return '';
  const namePart = address.split(/[ @]/)[0];
  return namePart.length > 15 ? namePart.slice(0, 15) : namePart;
};

interface MessageRowProps {
  message: EmailMessage;
  isSelected: boolean;
  onSelect: () => void;
  onCheckboxChange: (checked: boolean) => void;
  formatDate: (date: string) => string;
  truncateText: (text: string, length?: number) => string;
  onToggleStar: () => void;
  mobileDense?: boolean;
}

const MessageRow = ({
  message,
  isSelected,
  onSelect,
  onCheckboxChange,
  formatDate,
  truncateText,
  onToggleStar,
  mobileDense = false
}: MessageRowProps) => {
  const senderShort = getSenderShortName(
    message.direction === 'incoming' ? message.from_address : message.to_address
  );
  const subject = message.subject || 'No Subject';

  if (mobileDense) {
    // Two-line grid for mobile
    return (
      <div
        className={cn(
          "grid grid-cols-[48px_1fr_90px] grid-rows-2 items-stretch px-2 pr-2 py-2 gap-x-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition group relative",
          !message.is_read ? "bg-accent" : "bg-white",
        )}
        style={{ minHeight: 62 }}
        onClick={onSelect}
      >
        {/* First line */}
        <div className="flex items-center gap-2 row-span-2 pl-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onCheckboxChange(checked === true)}
            onClick={(e) => e.stopPropagation()}
            className="rounded"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            tabIndex={0}
            aria-label={message.is_starred ? "Unstar message" : "Star message"}
          >
            {message.is_starred ? (
              <Star className="h-4 w-4 text-yellow-400 fill-current" />
            ) : (
              <StarOff className="h-4 w-4 text-gray-400" />
            )}
          </Button>
        </div>

        {/* Sender and subject - first row */}
        <div className="flex items-center min-w-0 row-start-1 col-start-2 col-span-1">
          <span className={cn(
            "inline-block rounded-full mr-1 transition",
            !message.is_read ? "w-2 h-2 bg-blue-600" : "w-2 h-2 bg-transparent"
          )} title={!message.is_read ? "Unread" : undefined} />
          <span className={cn(
            "truncate max-w-[100px] text-sm",
            !message.is_read ? "font-semibold text-gray-900" : "text-gray-700"
          )} title={senderShort}>
            {senderShort}
          </span>
          <span className="mx-2 text-gray-300 select-none">|</span>
          <span className={cn(
            "truncate text-sm",
            !message.is_read ? "font-medium text-gray-900" : "text-gray-700"
          )} title={subject}>
            {subject}
          </span>
        </div>
        {/* Date - first row, rightmost */}
        <div className="flex justify-end items-center text-xs text-gray-500 row-start-1 col-start-3 col-span-1">
          {formatDate(message.created_at)}
        </div>

        {/* Body preview - second row */}
        <div className="flex items-center min-w-0 text-xs text-gray-600 row-start-2 col-start-2 col-span-2 mt-1">
          {message.body &&
            <span className="truncate max-w-full">
              {truncateText(message.body, 120)}
            </span>
          }
        </div>
      </div>
    );
  }

  // Default (desktop) layout unchanged
  return (
    <div
      className={cn(
        `grid grid-cols-[48px_120px_1fr_76px] items-center px-2 pr-2 py-1 gap-0 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition group relative`,
        !message.is_read ? "bg-accent" : "bg-white"
      )}
      style={{ minHeight: 46 }}
      onClick={onSelect}
    >
      {/* Selection + Star */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onCheckboxChange(checked === true)}
          onClick={(e) => e.stopPropagation()}
          className="rounded"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
        >
          {message.is_starred ? (
            <Star className="h-4 w-4 text-yellow-400 fill-current" />
          ) : (
            <StarOff className="h-4 w-4 text-gray-400" />
          )}
        </Button>
      </div>

      {/* Sender name & unread dot */}
      <div className="flex items-center min-w-0">
        {/* Unread blue dot */}
        <span className={cn(
          "inline-block rounded-full mr-1 transition",
          !message.is_read ? "w-2 h-2 bg-blue-600" : "w-2 h-2 bg-transparent"
        )}
        title={!message.is_read ? "Unread" : undefined}
        />
        <span
          className={cn(
            "truncate max-w-[75px] text-sm",
            !message.is_read ? "font-semibold text-gray-900" : "text-gray-700"
          )}
          title={senderShort}
        >
          {senderShort}
        </span>
      </div>

      {/* Subject + Body */}
      <div className="flex items-center min-w-0">
        <span
          className={cn(
            "truncate text-sm",
            !message.is_read ? "font-medium text-gray-900" : "text-gray-700"
          )}
        >
          {subject}
        </span>
        {message.body && (
          <>
            <span className="text-xs text-gray-400 mx-1">–</span>
            <span className="truncate text-xs text-gray-500 max-w-full">
              {truncateText(message.body, 38)}
            </span>
          </>
        )}
      </div>
      
      {/* Date / When */}
      <div className="flex justify-end items-center text-xs text-gray-500">
        {formatDate(message.created_at)}
      </div>
    </div>
  );
};
