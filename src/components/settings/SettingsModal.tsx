import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { X, User, Bell, LifeBuoy, Settings as SettingsIcon, LogOut, CreditCard, ArrowLeft, Users, Brain } from "lucide-react";
import { HIDDEN_SETTINGS_PANELS, SettingsPanelType, useSettingsModal } from "@/contexts/SettingsModalContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AccountSettingsPanel } from "./account/AccountSettingsPanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { DeleteAccountPanel } from "./panels/DeleteAccountPanel";
import { ContactSupportPanel } from "./panels/ContactSupportPanel";
import { ProfilesPanel } from "./panels/ProfilesPanel";
import { VoiceSelectionPanel } from "./VoiceSelectionPanel";
import DisplayNamePanel from "./panels/DisplayNamePanel";
import { BillingPanel } from "./panels/BillingPanel";
import { MemoryPanel } from "./panels/MemoryPanel";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { safeConsoleError } from '@/utils/safe-logging';
export const SettingsModal = () => {
  const { isOpen, closeSettings, activePanel, setActivePanel } = useSettingsModal();
  const { signOut, user } = useAuth();
  const { fetchData: fetchSettingsData } = useUserData();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isMobile = useIsMobile();
  const [showMobileMenu, setShowMobileMenu] = useState(true);
  const hiddenPanels = HIDDEN_SETTINGS_PANELS;

  // Fetch settings data when modal opens and user is signed in
  useEffect(() => {
    if (isOpen && user) {
      fetchSettingsData();
    }
  }, [isOpen, user, fetchSettingsData]);

  // Reset mobile menu when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowMobileMenu(true);
    }
  }, [isOpen]);

  const handleTabChange = (value: string) => {
    setActivePanel(value);
  };

  const handlePanelClick = (panel: string) => {
    if (!user && panel !== 'general' && panel !== 'support') {
      setShowSignInPrompt(true);
      return;
    }
    setActivePanel(panel as SettingsPanelType);
  };

  const handleMobilePanelClick = (panel: string) => {
    if (!user && panel !== 'general' && panel !== 'support') {
      setShowSignInPrompt(true);
      return;
    }
    setActivePanel(panel as SettingsPanelType);
    setShowMobileMenu(false); // Hide menu, show panel
  };

  const handleMobileBack = () => {
    setShowMobileMenu(true); // Show menu, hide panel
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    
    try {
      setLoggingOut(true);
      await signOut();
      closeSettings();
    } catch (error) {
      safeConsoleError('Logout error:', error);
      // Close settings even on error since signOut handles cleanup
      closeSettings();
    } finally {
      setLoggingOut(false);
    }
  };

  // Filter tabs based on user login status
  const tabs = [
    { id: "general", label: "General", icon: SettingsIcon },
    ...(user ? [
      { id: "account", label: "Account Settings", icon: User },
      { id: "profiles", label: "Profiles", icon: Users },
      { id: "memory", label: "Memory", icon: Brain },
      { id: "billing", label: "Billing", icon: CreditCard },
      { id: "notifications", label: "Notifications", icon: Bell },
    ] : []),
    { id: "support", label: "Contact Support", icon: LifeBuoy },
  ].filter((tab) => !hiddenPanels.includes(tab.id as SettingsPanelType));

  const handleLegalTerms = () => {
    window.open('/legal', '_blank');
  };

  const renderSettingsContent = () => (
    <Tabs value={activePanel} className="space-y-4">
      <TabsContent value="general">
        <div className="space-y-6">
          {/* Display Name - Available for all users */}
          <DisplayNamePanel />
          
          {/* Voice Selection - Available for all users */}
          <VoiceSelectionPanel />
          
          <div className="border-t pt-2">
            {user ? (
              <>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-800">Log out on this device</span>
                  <Button 
                    variant="ghost" 
                    className="h-9 rounded-full px-4 text-gray-800 hover:bg-gray-100" 
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? "Logging out..." : "Log out"}
                  </Button>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-800">Delete account</span>
                  <Button 
                    variant="ghost" 
                    className="h-9 rounded-full px-4 text-gray-800 hover:bg-gray-100" 
                    onClick={() => handleTabChange("delete")}
                  >
                    Delete account
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-light text-gray-900 mb-2">
                      Sign in to access <span className="italic">account settings</span>
                    </h3>
                    <p className="text-sm text-gray-600">
                      Create an account to save preferences and access advanced features.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowSignInPrompt(true)}
                    className="bg-gray-900 text-white hover:bg-gray-800 font-light"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
      {!hiddenPanels.includes("account") && (
        <TabsContent value="account"><AccountSettingsPanel /></TabsContent>
      )}
      <TabsContent value="profiles"><ProfilesPanel /></TabsContent>
      <TabsContent value="memory"><MemoryPanel /></TabsContent>
      <TabsContent value="billing"><BillingPanel /></TabsContent>
      {!hiddenPanels.includes("notifications") && (
        <TabsContent value="notifications"><NotificationsPanel /></TabsContent>
      )}
      <TabsContent value="support"><ContactSupportPanel /></TabsContent>
      <TabsContent value="delete"><DeleteAccountPanel /></TabsContent>
    </Tabs>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className={`${isMobile ? 'max-w-full h-full' : 'sm:max-w-[800px] h-[80vh]'} p-0 flex flex-col bg-white`}>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        
        {/* Header */}
        <div className={`flex justify-between items-center ${isMobile ? 'p-4' : 'p-6'} border-b`}>
          {isMobile && !showMobileMenu ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleMobileBack} className="hover:bg-gray-100 hover:text-gray-900">
                <ArrowLeft size={20} className="text-gray-800" />
              </Button>
              <h2 className="text-base font-medium">Settings</h2>
            </div>
          ) : (
            <h2 className={`${isMobile ? 'text-base font-medium' : 'text-2xl font-semibold'}`}>Settings</h2>
          )}
          <DialogClose asChild>
            <Button variant="ghost" size="icon" onClick={closeSettings} className="hover:bg-gray-100 hover:text-gray-900">
              <X size={20} className="text-gray-800" />
            </Button>
          </DialogClose>
        </div>

        {/* Mobile Navigation */}
        {isMobile ? (
          <div className="flex-1 overflow-y-auto">
            {showMobileMenu ? (
              /* Mobile Settings Menu */
              <div className="p-6">
                <div className="space-y-3">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      className="w-full justify-start p-4 h-auto hover:bg-gray-100 hover:text-gray-900 text-left"
                      onClick={() => handleMobilePanelClick(tab.id)}
                    >
                      <div className="flex items-center gap-3">
                        <tab.icon className="h-5 w-5" />
                        <div>
                          <div className="font-medium">{tab.label}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>

                {/* Help submenu items */}
                <div className="mt-6 border-t pt-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start p-4 h-auto hover:bg-gray-100 hover:text-gray-900 text-left"
                    onClick={handleLegalTerms}
                  >
                    <div className="flex items-center gap-3">
                      <LifeBuoy className="h-5 w-5" />
                      <div>
                        <div className="font-medium">Legal & Terms</div>
                      </div>
                    </div>
                  </Button>
                </div>

                {user && (
                  <div className="border-t pt-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleLogout}
                      disabled={loggingOut}
                    >
                      <LogOut className="h-5 w-5 mr-3" />
                      {loggingOut ? 'Logging out...' : 'Logout'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* Mobile Settings Panel */
              <div className="p-6">
                {renderSettingsContent()}
              </div>
            )}
          </div>
        ) : (
          /* Desktop Navigation */
          <div className="flex flex-1 overflow-hidden">
            <div className="w-[220px] border-r p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      className={`w-full justify-start hover:bg-gray-100 hover:text-gray-900 ${
                        activePanel === tab.id ? "bg-muted font-semibold" : "text-gray-700"
                      }`}
                      onClick={() => handlePanelClick(tab.id)}
                    >
                    <tab.icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </Button>
                ))}
              </nav>

              <div className="mt-4 border-t pt-4 space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-gray-100 hover:text-gray-900 text-gray-700"
                  onClick={handleLegalTerms}
                >
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Legal & Terms
                </Button>

                {user && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {loggingOut ? "Logging out..." : "Logout"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {renderSettingsContent()}
            </div>
          </div>
        )}
      </DialogContent>
      
      {showSignInPrompt && (
        <SignInPrompt 
          feature="account settings"
          onClose={() => setShowSignInPrompt(false)}
        />
      )}
    </Dialog>
  );
};