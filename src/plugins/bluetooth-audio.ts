import { registerPlugin } from '@capacitor/core';

/**
 * Audio route types
 */
export type AudioRoute = 'bluetooth' | 'speaker' | 'receiver' | 'headphones' | 'unknown';

/**
 * BluetoothAudio Plugin Interface
 * 
 * Provides native Bluetooth audio routing capabilities for iOS and Android.
 * Used to route audio to Bluetooth headsets during voice conversations.
 */
export interface BluetoothAudioPlugin {
    /**
     * Configures audio session to route to Bluetooth devices
     * @returns Promise resolving to success status
     */
    startBluetoothAudio(): Promise<{ success: boolean }>;

    /**
     * Restores audio session to previous state
     * @returns Promise resolving to success status
     */
    stopBluetoothAudio(): Promise<{ success: boolean }>;

    /**
     * Checks if a Bluetooth audio device is currently connected
     * @returns Promise resolving to connection status
     */
    isBluetoothConnected(): Promise<{ connected: boolean }>;

    /**
     * Enables speaker (speakerphone) output
     * @returns Promise resolving to success status
     */
    enableSpeaker(): Promise<{ success: boolean }>;

    /**
     * Disables speaker output, returns to default routing
     * @returns Promise resolving to success status
     */
    disableSpeaker(): Promise<{ success: boolean }>;

    /**
     * Gets the current audio output route
     * @returns Promise resolving to current audio route
     */
    getCurrentAudioRoute(): Promise<{ route: AudioRoute }>;
}

const BluetoothAudio = registerPlugin<BluetoothAudioPlugin>('BluetoothAudio', {
    web: () => ({
        // Web fallback - no Bluetooth audio routing on web
        startBluetoothAudio: async () => ({ success: false }),
        stopBluetoothAudio: async () => ({ success: false }),
        isBluetoothConnected: async () => ({ connected: false }),
        enableSpeaker: async () => ({ success: false }),
        disableSpeaker: async () => ({ success: false }),
        getCurrentAudioRoute: async () => ({ route: 'unknown' as AudioRoute }),
    }),
});

export default BluetoothAudio;
