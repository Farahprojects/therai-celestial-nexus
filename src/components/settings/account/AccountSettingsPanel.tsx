
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
// import { EmailSettingsPanel } from "./EmailSettingsPanel"; // Removed - no longer needed
import { PasswordSettingsPanel } from "./PasswordSettingsPanel";

export const AccountSettingsPanel = () => {
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-6">Account Settings</h2>
      
      <div>
        <PasswordSettingsPanel />
      </div>
    </div>
  );
};

export default AccountSettingsPanel;
