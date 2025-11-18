import { useState } from 'react';
import { MessagesSidebar } from './MessagesSidebar';
import { GmailMessageList } from './GmailMessageList';
import { GmailMessageDetail } from './GmailMessageDetail';
import { useEmailMessages } from '../../hooks/useEmailMessages';
import type { EmailMessage } from '../../types/email';

export function MessagesView() {
  const { data: messages = [], isLoading, error } = useEmailMessages();
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');

  const filteredMessages = messages.filter((message) => {
    // Apply filter
    if (filter === 'incoming' && message.direction !== 'incoming') return false;
    if (filter === 'outgoing' && message.direction !== 'outgoing') return false;

    // Apply search
    if (!searchTerm) return true;
    const lowered = searchTerm.toLowerCase();
    return (
      message.subject?.toLowerCase().includes(lowered) ||
      message.body?.toLowerCase().includes(lowered) ||
      message.from_address.toLowerCase().includes(lowered) ||
      message.to_address.toLowerCase().includes(lowered)
    );
  });

  const handleSelectMessage = (message: EmailMessage) => {
    setSelectedMessage(message);
  };

  const handleSelectMessageCheckbox = (messageId: string, checked: boolean) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(messageId);
      } else {
        next.delete(messageId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMessages(new Set(filteredMessages.map((m) => m.id)));
    } else {
      setSelectedMessages(new Set());
    }
  };

  const handleArchiveSelected = () => {
    console.log('Archive selected:', Array.from(selectedMessages));
    // TODO: Implement archive functionality
  };

  const handleDeleteSelected = () => {
    console.log('Delete selected:', Array.from(selectedMessages));
    // TODO: Implement delete functionality
  };

  const handleToggleStar = (message: EmailMessage) => {
    console.log('Toggle star:', message.id);
    // TODO: Implement star toggle functionality
  };

  const handleClose = () => {
    setSelectedMessage(null);
  };

  const handleArchive = () => {
    console.log('Archive:', selectedMessage?.id);
    // TODO: Implement archive functionality
    setSelectedMessage(null);
  };

  const handleDelete = () => {
    console.log('Delete:', selectedMessage?.id);
    // TODO: Implement delete functionality
    setSelectedMessage(null);
  };

  const stats = {
    total: messages.length,
    inbound: messages.filter((m) => m.direction === 'incoming').length,
    outbound: messages.filter((m) => m.direction === 'outgoing').length,
    unread: messages.filter((m) => !m.is_read && m.direction === 'incoming').length,
  };

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-sm text-red-600 font-light">
          Failed to load email messages. Please try again later.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-sm text-gray-600 font-light">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex border border-gray-200 rounded-2xl overflow-hidden bg-white h-[calc(100vh-12rem)]">
      <MessagesSidebar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filter={filter}
        onFilterChange={setFilter}
        stats={stats}
      />

      {!selectedMessage ? (
        <GmailMessageList
          messages={filteredMessages}
          selectedMessages={selectedMessages}
          onSelectMessage={handleSelectMessage}
          onSelectMessageCheckbox={handleSelectMessageCheckbox}
          onSelectAll={handleSelectAll}
          onArchiveSelected={handleArchiveSelected}
          onDeleteSelected={handleDeleteSelected}
          onToggleStar={handleToggleStar}
        />
      ) : (
        <GmailMessageDetail
          message={selectedMessage}
          onClose={handleClose}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
