import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Send, Bold, Italic, Underline, Loader2 } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { LinkInsertPopup } from './LinkInsertPopup';
import { ColorPicker } from './ColorPicker';
import { FontSelector } from './FontSelector';
import { AttachmentDropzone } from './AttachmentDropzone';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/notifications';
import { useIsMobile } from '@/hooks/use-mobile';

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
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface ReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalMessage: EmailMessage;
  onSend: (replyData: {
    to: string;
    subject: string;
    body: string;
    attachments: Attachment[];
  }) => void;
}

export const ReplyModal = ({ isOpen, onClose, originalMessage, onSend }: ReplyModalProps) => {
  const [to] = useState(originalMessage.from_address);
  const [subject, setSubject] = useState(`Re: ${originalMessage.subject || 'No Subject'}`);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [currentFont, setCurrentFont] = useState('font-inter');
  const [currentSize, setCurrentSize] = useState('text-base');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [textStyles, setTextStyles] = useState({
    bold: false,
    italic: false,
    underline: false
  });
  const [isSending, setIsSending] = useState(false);
  const isMobile = useIsMobile();

  const handleSend = async () => {
    if (!body.trim()) {
      showToast({
        title: "Error",
        description: "Please enter a message before sending.",
        variant: "destructive"
      });
      return;
    }
    setIsSending(true);
    try {
      const formattedBody = formatBodyWithStyles();
      const { error } = await supabase.functions.invoke('outbound-messenger', {
        body: {
          to,
          subject,
          html: formattedBody,
          text: body
        }
      });
      if (error) {
        console.error('Error sending email:', error);
          showToast({
            title: "Error",
            description: "Failed to send email. Please try again.",
            variant: "destructive"
          });
        return;
      }
      onSend({
        to,
        subject,
        body: formattedBody,
        attachments
      });
      showToast({
        title: "Success",
        description: "Reply sent successfully!",
        variant: "success"
      });
      setBody('');
      setAttachments([]);
      setTextStyles({ bold: false, italic: false, underline: false });
      onClose();
    } catch (error) {
      console.error('Unexpected error:', error);
      showToast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatBodyWithStyles = () => {
    let formattedBody = body;
    if (textStyles.bold) formattedBody = `<strong>${formattedBody}</strong>`;
    if (textStyles.italic) formattedBody = `<em>${formattedBody}</em>`;
    if (textStyles.underline) formattedBody = `<u>${formattedBody}</u>`;
    if (currentColor !== '#000000') {
      formattedBody = `<span style="color: ${currentColor}">${formattedBody}</span>`;
    }
    formattedBody = formattedBody.replace(/\n/g, '<br>');
    const originalDate = new Date(originalMessage.created_at).toLocaleString();
    const quote = `
      <br><br>
      <div style="border-left: 3px solid #ccc; padding-left: 10px; margin: 10px 0;">
        <strong>--- Original Message ---</strong><br>
        <strong>From:</strong> ${originalMessage.from_address}<br>
        <strong>Date:</strong> ${originalDate}<br>
        <strong>Subject:</strong> ${originalMessage.subject}<br><br>
        ${originalMessage.body.replace(/\n/g, '<br>')}
      </div>
    `;
    return formattedBody + quote;
  };

  const insertText = (text: string) => {
    const textarea = document.getElementById('reply-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentBody = body;
      const newBody = currentBody.substring(0, start) + text + currentBody.substring(end);
      setBody(newBody);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }, 0);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    insertText(emoji);
  };

  const handleLinkInsert = (url: string, linkText: string) => {
    insertText(`[${linkText}](${url})`);
  };

  const toggleStyle = (style: 'bold' | 'italic' | 'underline') => {
    setTextStyles(prev => ({
      ...prev,
      [style]: !prev[style]
    }));
  };

  const getTextareaClasses = () => {
    let classes = `${currentFont} ${currentSize}`;
    if (textStyles.bold) classes += ' font-bold';
    if (textStyles.italic) classes += ' italic';
    if (textStyles.underline) classes += ' underline';
    return classes;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Reply to Message</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={to}
              disabled
              className="bg-gray-50"
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>

          {/* Message Body */}
          <div className="space-y-2">
            <Label htmlFor="reply-body">Message</Label>
            <Textarea
              id="reply-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your reply..."
              className={`min-h-[200px] resize-none ${getTextareaClasses()}`}
              style={{ color: currentColor }}
            />
          </div>

          {/* Original Message Preview */}
          <div className="border-l-4 border-gray-300 pl-4 bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600 mb-2">Original message:</div>
            <div className="text-sm">
              <div className="font-medium">{originalMessage.subject}</div>
              <div className="text-gray-600 text-xs mb-2">
                From: {originalMessage.from_address} • {new Date(originalMessage.created_at).toLocaleString()}
              </div>
              <div className="text-gray-800 max-h-20 overflow-y-auto">
                {originalMessage.body}
              </div>
            </div>
          </div>
        </div>

        {/* Formatting tools and Action Buttons */}
        {isMobile ? (
          <div className="flex flex-col gap-2 pt-4 border-t">
            {/* Row 1: Formatting Tools */}
            <div className="flex flex-wrap items-center gap-1 justify-start">
              <Button
                variant={textStyles.bold ? "default" : "ghost"}
                size="sm"
                type="button"
                onClick={() => toggleStyle('bold')}
                className="px-2 py-1"
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant={textStyles.italic ? "default" : "ghost"}
                size="sm"
                type="button"
                onClick={() => toggleStyle('italic')}
                className="px-2 py-1"
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button
                variant={textStyles.underline ? "default" : "ghost"}
                size="sm"
                type="button"
                onClick={() => toggleStyle('underline')}
                className="px-2 py-1"
              >
                <Underline className="w-4 h-4" />
              </Button>
              <FontSelector
                onFontSelect={setCurrentFont}
                onFontSizeSelect={setCurrentSize}
                currentFont={currentFont}
                currentSize={currentSize}
              />
              <ColorPicker
                onColorSelect={setCurrentColor}
                currentColor={currentColor}
              />
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              <LinkInsertPopup onLinkInsert={handleLinkInsert} />
              <AttachmentDropzone
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
              {attachments.length > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  {attachments.length}
                </span>
              )}
            </div>
            {/* Row 2: Action Buttons (Cancel left, Send right) */}
            <div className="flex w-full justify-between gap-2 mt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                className="flex-1"
                disabled={!body.trim() || isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-4 border-t">
            {/* Text Formatting */}
            <div className="flex items-center gap-1">
              <Button
                variant={textStyles.bold ? "default" : "ghost"}
                size="sm"
                type="button"
                onClick={() => toggleStyle('bold')}
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant={textStyles.italic ? "default" : "ghost"}
                size="sm"
                type="button"
                onClick={() => toggleStyle('italic')}
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button
                variant={textStyles.underline ? "default" : "ghost"}
                size="sm"
                type="button"
                onClick={() => toggleStyle('underline')}
              >
                <Underline className="w-4 h-4" />
              </Button>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <FontSelector
                onFontSelect={setCurrentFont}
                onFontSizeSelect={setCurrentSize}
                currentFont={currentFont}
                currentSize={currentSize}
              />
              <ColorPicker
                onColorSelect={setCurrentColor}
                currentColor={currentColor}
              />
              <Separator orientation="vertical" className="h-6 mx-1" />
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              <LinkInsertPopup onLinkInsert={handleLinkInsert} />
              <AttachmentDropzone
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
              {attachments.length > 0 && (
                <span className="text-sm text-muted-foreground ml-2">
                  {attachments.length} attachment(s)
                </span>
              )}
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={!body.trim() || isSending}>
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
