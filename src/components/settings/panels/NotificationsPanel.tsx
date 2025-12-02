
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader, RefreshCw } from "lucide-react";
import { useUserData } from "@/hooks/useUserData";
import { Button } from "@/components/ui/button";


export const NotificationsPanel = () => {
  const {
    preferences,
    saving,
    error,
    updateMainNotificationsToggle
  } = useUserData();


  // Handle refresh on timeout errors
  const handleRefresh = () => {
    window.location.reload();
  };

  // Optimistically handle toggle changes without waiting for backend response
  const handleMainToggleChange = (checked: boolean) => {
    updateMainNotificationsToggle(checked, { showToast: false });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-6">Notification Settings</h2>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          <p className="font-medium">Error loading preferences</p>
          <p className="text-sm">{error}</p>
          <div className="flex items-center mt-3 space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center space-x-1"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              <span>Reload</span>
            </Button>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="text-lg font-medium">Email Notifications</h3>
            <p className="text-sm text-gray-500">
              Turn off all notifications
            </p>
          </div>
          
          {saving ? (
            <Loader className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <div className="flex items-center space-x-2">
              <Switch 
                checked={preferences?.email_notifications_enabled ?? false}
                onCheckedChange={handleMainToggleChange}
                disabled={saving}
                id="email-notifications"
                className="focus:ring-2 focus:ring-primary"
              />
              <Label htmlFor="email-notifications">
                {preferences?.email_notifications_enabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          )}
        </div>
        
        {preferences && !preferences.email_notifications_enabled && (
          <div className="bg-gray-50 p-4 rounded-md text-gray-500 text-sm">
            Email notifications are currently disabled.
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
