import React from 'react';
import { Search, Clock, MessageSquare, User } from 'lucide-react';

interface SearchIndexProps {
  totalConversations: number;
  totalMessages: number;
  lastIndexed: string;
}

export const SearchIndex: React.FC<SearchIndexProps> = ({
  totalConversations,
  totalMessages,
  lastIndexed
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-700">Search Index</span>
      </div>
      
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          <span>{totalConversations} conversations</span>
        </div>
        
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{totalMessages} messages</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Updated {formatDate(lastIndexed)}</span>
        </div>
      </div>
    </div>
  );
};
