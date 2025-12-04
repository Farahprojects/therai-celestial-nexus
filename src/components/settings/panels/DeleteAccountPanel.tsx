
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { safeConsoleError, safeConsoleLog, safeConsoleWarn } from '@/utils/safe-logging';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showToast } from "@/utils/notifications";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";

export const DeleteAccountPanel = () => {
  const { user, signOut } = useAuth();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDeleteClick = () => {
    setIsDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!user) {
      showToast({
        variant: "destructive",
        title: "Error",
        description: "No user session found."
      });
      return;
    }
    
    setIsDeleting(true);
    
    try {
      safeConsoleLog('🚀 Calling delete-account edge function...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');
      
      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        safeConsoleError('❌ Edge function error:', error);
        throw new Error(error.message || 'Failed to delete account')
      }
      
      console.log('✅ Account deletion successful:', data);
      
      // Immediately clear all auth state and sign out
      console.log('🚪 Clearing auth state after successful account deletion...');
      
      // 1. Clean up storage first
      const { cleanupAuthState } = await import('@/utils/authCleanup');
      cleanupAuthState();
      
      // 2. Force global sign out from Supabase
      try {
        await supabase.auth.signOut({ scope: 'global' });
        console.log('✅ Supabase global signOut completed');
      } catch (signOutError) {
        safeConsoleWarn('⚠️ Supabase signOut failed but continuing:', signOutError);
      }
      
      // 3. Use AuthContext signOut for complete cleanup
      try {
        await signOut();
        console.log('✅ AuthContext signOut completed');
      } catch (contextSignOutError) {
        safeConsoleWarn('⚠️ AuthContext signOut failed:', contextSignOutError);
      }
      
      // 4. Emergency cleanup (this will force reload)
      const { emergencyAuthCleanup } = await import('@/utils/authCleanup');
      emergencyAuthCleanup();
      
      showToast({
        title: "Account Deleted",
        description: "Your account has been successfully deleted."
      });
      
    } catch (error) {
      safeConsoleError('❌ Delete account error:', error);
      showToast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account. Please try again."
      });
    } finally {
      setIsDeleting(false);
      setIsDialogOpen(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-3">
        <h2 className="text-2xl font-light tracking-tight text-foreground">
          Delete Account
        </h2>
        <p className="text-muted-foreground font-light leading-relaxed max-w-2xl">
          Permanently remove your account and all associated data. This action cannot be undone 
          and will immediately cancel any active subscriptions.
        </p>
      </div>
      
      {/* Warning Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-3">
            <h3 className="font-medium text-gray-800">
              This will permanently delete:
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground font-light">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Your profile and account settings
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                All conversations and chat history
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Payment methods and billing information
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Active subscriptions (immediately cancelled)
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Action Button */}
      <div className="pt-4">
        <Button 
          variant="ghost" 
          onClick={handleDeleteClick}
          className="h-9 rounded-full px-4 text-gray-800 hover:bg-gray-100"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl bg-background/95 backdrop-blur-xl">
          <DialogHeader className="space-y-4 text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-gray-700" />
            </div>
            <DialogTitle className="text-xl font-light tracking-tight text-foreground">
              Delete Your Account?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-light leading-relaxed px-2">
              This action cannot be undone. Your account and all data will be permanently deleted, 
              and any active subscriptions will be immediately cancelled.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
            <Button 
              variant="ghost" 
              onClick={handleCancel} 
              className="flex-1 rounded-full font-medium hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button 
              variant="ghost" 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex-1 rounded-full font-medium hover:bg-gray-100"
            >
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
                  Deleting...
                </div>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
