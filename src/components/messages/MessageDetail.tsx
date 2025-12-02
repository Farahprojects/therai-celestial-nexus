
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Reply, 
  Forward, 
  Archive, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Star,
  StarOff,
  MoreHorizontal,
  X
} from 'lucide-react';

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

interface MessageDetailProps {
  message: EmailMessage | null;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const MessageDetail = ({
  message,
  onClose,
  onReply,
  onForward,
  onArchive,
  onDelete
}: MessageDetailProps) => {
  if (!message) {
    return (
      <div className="flex-1 bg-gray-50">
        {/* Empty state - no content needed */}
      </div>
    );
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white">
              {message.direction === 'incoming' ? (
                <ArrowDown className="w-5 h-5" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {message.subject || 'No Subject'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={message.direction === 'incoming' ? 'default' : 'secondary'}>
                  {message.direction === 'incoming' ? 'Received' : 'Sent'}
                </Badge>
                {message.sent_via && message.sent_via !== 'email' && (
                  <Badge variant="outline">
                    via {message.sent_via}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              {message.starred ? (
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
              ) : (
                <StarOff className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Message Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onReply}>
              <Reply className="w-4 h-4 mr-1" />
              Reply
            </Button>
            <Button variant="outline" size="sm" onClick={onForward}>
              <Forward className="w-4 h-4 mr-1" />
              Forward
            </Button>
            <Button variant="outline" size="sm" onClick={onArchive}>
              <Archive className="w-4 h-4 mr-1" />
              Archive
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
          
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Message Info */}
      <div className="border-b p-4 bg-gray-50">
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="font-medium text-gray-700 w-16">From:</span>
            <span className="text-gray-900">{message.from_address}</span>
          </div>
          <div className="flex">
            <span className="font-medium text-gray-700 w-16">To:</span>
            <span className="text-gray-900">{message.to_address}</span>
          </div>
          <div className="flex">
            <span className="font-medium text-gray-700 w-16">Date:</span>
            <span className="text-gray-900">{formatDateTime(message.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Message Body */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="prose max-w-none">
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
            {message.body}
          </div>
        </div>
      </div>

      {/* Quick Reply Footer */}
      <div className="border-t p-4 bg-gray-50">
        <div className="flex items-center justify-center gap-2">
          <Button onClick={onReply} className="flex items-center gap-2">
            <Reply className="w-4 h-4" />
            Quick Reply
          </Button>
          <Button variant="outline" onClick={onForward} className="flex items-center gap-2">
            <Forward className="w-4 h-4" />
            Forward
          </Button>
        </div>
      </div>
    </div>
  );
};
