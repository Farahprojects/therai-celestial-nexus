
import React, { createContext, useContext, useState } from "react";
import { SettingsModal } from "@/components/settings/SettingsModal";


export type SettingsPanelType = "general" | "account" | "profiles" | "memory" | "notifications" | "delete" | "support" | "billing";
export const HIDDEN_SETTINGS_PANELS: SettingsPanelType[] = import.meta.env.DEV ? [] : ["account", "notifications"];

const normalizePanel = (panel: SettingsPanelType): SettingsPanelType =>
  HIDDEN_SETTINGS_PANELS.includes(panel) ? "general" : panel;

interface SettingsModalContextProps {
  isOpen: boolean;
  activePanel: SettingsPanelType;
  openSettings: (panel?: SettingsPanelType) => void;
  closeSettings: () => void;
  setActivePanel: (panel: SettingsPanelType) => void;
}

const SettingsModalContext = createContext<SettingsModalContextProps | undefined>(undefined);

export const SettingsModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanelState] = useState<SettingsPanelType>("general");

  const setActivePanel = (panel: SettingsPanelType) => {
    setActivePanelState(normalizePanel(panel));
  };

  const openSettings = (panel?: SettingsPanelType) => {
    if (panel) {
      setActivePanel(panel);
    } else {
      setActivePanelState((current) => normalizePanel(current));
    }
    
    setIsOpen(true);
  };

  const closeSettings = () => {
    setIsOpen(false);
  };

  return (
    <SettingsModalContext.Provider 
      value={{ 
        isOpen, 
        activePanel, 
        openSettings, 
        closeSettings, 
        setActivePanel 
      }}
    >
      {children}
      <SettingsModal />
    </SettingsModalContext.Provider>
  );
};

export const useSettingsModal = () => {
  const context = useContext(SettingsModalContext);
  
  if (context === undefined) {
    throw new Error("useSettingsModal must be used within a SettingsModalProvider");
  }
  
  return context;
};
