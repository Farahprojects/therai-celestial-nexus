// Conversation Modes Registry
// Defines available modes for shared conversations

export interface ConversationMode {
  id: string;
  name: string;
  description: string;
  icon: 'MessageCircle' | 'Blend' | 'Bell' | 'Target';
  requires_compatibility: boolean;
  enabled: boolean; // false = placeholder for future implementation
}

export const CONVERSATION_MODES: ConversationMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Regular conversation',
    icon: 'MessageCircle',
    requires_compatibility: false,
    enabled: true
  },
  {
    id: 'together',
    name: 'Together Mode',
    description: 'Invite @therai for relationship insights',
    icon: 'Blend',
    requires_compatibility: true,
    enabled: true // ONLY THIS ONE WORKS IN PHASE 1
  },
  {
    id: 'daily_nudge',
    name: 'Daily Nudge',
    description: 'Automated daily energy check-ins',
    icon: 'Bell',
    requires_compatibility: true,
    enabled: false // Placeholder
  },
  {
    id: 'goal_tracking',
    name: 'Goal Tracking',
    description: 'Track and celebrate shared goals',
    icon: 'Target',
    requires_compatibility: false,
    enabled: false // Placeholder
  }
];

/**
 * Get available modes based on conversation type
 * @param isCompatibilityChat - Whether conversation has compatibility/synastry data
 * @returns Filtered array of available modes
 */
export function getAvailableModes(isCompatibilityChat: boolean): ConversationMode[] {
  return CONVERSATION_MODES.filter(mode => 
    !mode.requires_compatibility || isCompatibilityChat
  );
}

