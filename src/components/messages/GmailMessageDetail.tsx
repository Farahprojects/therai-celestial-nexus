
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Reply, 
  Forward, 
  Archive, 
  Trash2, 
  Star,
  StarOff,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ReplyModal } from './ReplyModal';
import { CleanEmailRenderer } from './CleanEmailRenderer';

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

interface GmailMessageDetailProps {
  message: EmailMessage | null;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const GmailMessageDetail = ({
  message,
  onClose,
  onReply,
  onForward,
  onArchive,
  onDelete
}: GmailMessageDetailProps) => {
  const [showReplyModal, setShowReplyModal] = useState(false);

  if (!message) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">No message selected</div>
          <p className="text-sm">Select a message to view its content</p>
        </div>
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

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase();
  };

  const handleReplyClick = () => {
    setShowReplyModal(true);
  };

  const handleReplySend = (replyData: {
    to: string;
    subject: string;
    body: string;
    attachments: { file: File; name: string; size: number; type: string }[];
  }) => {
    console.log('Reply sent:', replyData);
    // Here you would typically send the reply via your email service
    onReply(); // Call the original onReply for any additional handling
    setShowReplyModal(false);
  };

  return (
    <div className="w-full bg-white flex flex-col h-[calc(100vh-8rem)]">
      {/* Toolbar - similar to message list toolbar */}
      <div className="px-4 py-2 border-b bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="h-6 w-px bg-gray-300 mx-2" />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onArchive} className="h-8 w-8 p-0">
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              {message.starred ? (
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
              ) : (
                <StarOff className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Message Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Subject */}
          <h1 className="text-2xl font-medium text-gray-900 mb-6 leading-tight">
            {message.subject || 'No Subject'}
          </h1>

          {/* Message Info */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-medium flex-shrink-0">
                {getInitials(message.direction === 'incoming' ? message.from_address : message.to_address)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-base text-gray-900 mb-1">
                  {message.direction === 'incoming' ? message.from_address : message.to_address}
                </div>
                <div className="text-sm text-gray-600 mb-1">
                  to {message.direction === 'incoming' ? message.to_address : message.from_address}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDateTime(message.created_at)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Badge variant={message.direction === 'incoming' ? 'default' : 'secondary'} className="text-xs">
                {message.direction === 'incoming' ? 'Received' : 'Sent'}
              </Badge>
            </div>
          </div>

          {/* Clean Message Body */}
          <CleanEmailRenderer 
            body={message.body}
            sentVia={message.sent_via}
            direction={message.direction}
          />

          {/* Action Buttons */}
          <div className="mt-8 flex items-center gap-3 pt-4 border-t">
            <Button onClick={handleReplyClick} className="flex items-center gap-2">
              <Reply className="w-4 h-4" />
              Reply
            </Button>
            <Button variant="outline" onClick={onForward} className="flex items-center gap-2">
              <Forward className="w-4 h-4" />
              Forward
            </Button>
          </div>
        </div>
      </div>

      {/* Reply Modal */}
      <ReplyModal
        isOpen={showReplyModal}
        onClose={() => setShowReplyModal(false)}
        originalMessage={message}
        onSend={handleReplySend}
      />
    </div>
  );
};
