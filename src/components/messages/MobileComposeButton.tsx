
import React from "react";
import { Plus } from "lucide-react";

/**
 * Small, theme-colored, rectangular Compose button for mobile screens.
 * Props:
 *   - onClick (required): handler for click.
 */
interface MobileComposeButtonProps {
  onClick: () => void;
}

export const MobileComposeButton: React.FC<MobileComposeButtonProps> = ({ onClick }) => (
  <button
    aria-label="Compose"
    onClick={onClick}
    className="fixed z-40 bottom-4 right-4 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-md rounded-full px-5 py-2 text-base font-medium transition active:scale-95"
    style={{ minHeight: 44, minWidth: 0, boxShadow: '0 2px 8px rgba(30,64,175,0.10)' }}
  >
    <Plus className="w-4 h-4" />
    Compose
  </button>
);
