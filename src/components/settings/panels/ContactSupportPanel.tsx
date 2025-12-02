
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, X } from "lucide-react";
import { showToast } from "@/utils/notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type SupportFile = {
  file: File;
  id: string;
  preview?: string;
};

const SUPPORTED_FORMATS = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB - more standard for modern images
const MAX_FILES = 3;

export const ContactSupportPanel = () => {
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [files, setFiles] = useState<SupportFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const newFiles = Array.from(e.target.files);
    setFileError(""); // Clear any previous errors
    
    if (files.length + newFiles.length > MAX_FILES) {
      setFileError("You can upload up to 3 attachments only.");
      return;
    }
    
    const validFiles = [];
    const invalidFiles = [];
    
    newFiles.forEach(file => {
      if (!SUPPORTED_FORMATS.includes(file.type)) {
        invalidFiles.push(`${file.name} is not a supported format (JPEG, PNG, PDF only).`);
      } else if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} exceeds the 25MB limit. Please compress the file or choose a smaller one.`);
      } else {
        validFiles.push(file);
      }
    });
    
    // Show inline error for invalid files
    if (invalidFiles.length > 0) {
      setFileError(invalidFiles.join(" "));
    }
    
    // Only add valid files
    if (validFiles.length > 0) {
      const filesToAdd = validFiles.map(file => ({
        file,
        id: crypto.randomUUID(),
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      }));
      
      setFiles(prev => [...prev, ...filesToAdd]);
    }
    
    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const removeFile = (id: string) => {
    setFiles(prev => {
      const updatedFiles = prev.filter(file => file.id !== id);
      // Clean up any URL.createObjectURL resources
      const removedFile = prev.find(file => file.id === id);
      if (removedFile?.preview) {
        URL.revokeObjectURL(removedFile.preview);
      }
      return updatedFiles;
    });
    // Clear file error when removing files
    setFileError("");
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subject || !message.trim()) {
      showToast({
        title: "Missing information",
        description: "Please select a subject and enter a message.",
        variant: "destructive"
      });
      return;
    }
    
    if (!user?.email) {
      showToast({
        title: "Authentication required",
        description: "Please sign in to contact support.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.functions.invoke('contact-form-handler', {
        body: {
          name: user.user_metadata?.full_name || user.email.split('@')[0],
          email: user.email,
          subject: subject,
          message: message.trim()
        }
      });
      
      if (error) {
        throw error;
      }
      
      // Success
      showToast({
        title: "Message sent successfully!",
        description: "We'll get back to you soon.",
      });
      
      // Reset form
      setSubject("");
      setMessage("");
      setFileError("");
      setFiles(files => {
        // Clean up URL.createObjectURL resources
        files.forEach(file => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
        return [];
      });
    } catch (error) {
      console.error('Contact form error:', error);
      showToast({
        title: "Failed to send message",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className={isMobile ? "w-full" : "shadow-md"}>
      {isMobile ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Contact Support</h3>
            <p className="text-sm text-gray-600">We're here to help. Select a subject and tell us what's going on.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium">
                Subject
              </label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="subject" className="rounded-lg">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API Issue</SelectItem>
                  <SelectItem value="billing">Billing Issue</SelectItem>
                  <SelectItem value="account">Account Problem</SelectItem>
                  <SelectItem value="general">General Inquiry</SelectItem>
                  <SelectItem value="marketing">Marketing/Partnership Inquiry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium">
                Message
              </label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                className="min-h-[150px] rounded-lg resize-y"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Attachments</label>
                <span className="text-xs text-gray-500">
                  Max 3 files JPEG, PNG, PDF
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1"
                  >
                    <span className="text-sm truncate max-w-[200px]">
                      {file.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                
                {files.length < MAX_FILES && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex gap-2 rounded-md"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={16} />
                    <span>Add file</span>
                  </Button>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".jpeg,.jpg,.png,.pdf"
                  multiple
                  className="hidden"
                />
              </div>
              
              {fileError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{fileError}</p>
                </div>
              )}
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="rounded-lg w-full"
            >
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </form>
        </div>
      ) : (
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold">Contact Support</h3>
            <p className="text-sm text-gray-600">We're here to help. Select a subject and tell us what's going on.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium">
                Subject
              </label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="subject" className="rounded-lg">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API Issue</SelectItem>
                  <SelectItem value="billing">Billing Issue</SelectItem>
                  <SelectItem value="account">Account Problem</SelectItem>
                  <SelectItem value="general">General Inquiry</SelectItem>
                  <SelectItem value="marketing">Marketing/Partnership Inquiry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium">
                Message
              </label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                className="min-h-[150px] rounded-lg resize-y"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Attachments</label>
                <span className="text-xs text-gray-500">
                  Max 3 files JPEG, PNG, PDF
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1"
                  >
                    <span className="text-sm truncate max-w-[200px]">
                      {file.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                
                {files.length < MAX_FILES && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex gap-2 rounded-md"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={16} />
                    <span>Add file</span>
                  </Button>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".jpeg,.jpg,.png,.pdf"
                  multiple
                  className="hidden"
                />
              </div>
              
              {fileError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{fileError}</p>
                </div>
              )}
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="rounded-lg w-full"
            >
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
