import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import BluetoothAudio, { AudioRoute } from '@/plugins/bluetooth-audio';
import { safeConsoleError } from '@/utils/safe-logging';
export interface UseAudioRouteReturn {
    currentRoute: AudioRoute;
    isBluetoothAvailable: boolean;
    isSpeakerActive: boolean;
    isBluetoothActive: boolean;
    enableBluetooth: () => Promise<void>;
    enableSpeaker: () => Promise<void>;
    disableAll: () => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * Hook to manage audio routing for conversation mode
 * Provides methods to switch between Bluetooth, Speaker, and default routing
 */
export const useAudioRoute = (): UseAudioRouteReturn => {
    const [currentRoute, setCurrentRoute] = useState<AudioRoute>('unknown');
    const [isBluetoothAvailable, setIsBluetoothAvailable] = useState(false);

    // Detect current audio route
    const detectAudioRoute = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) {
            setCurrentRoute('unknown');
            return;
        }

        try {
            // Get current route
            const routeResult = await BluetoothAudio.getCurrentAudioRoute();
            setCurrentRoute(routeResult.route);

            // Check if Bluetooth is available
            const bluetoothResult = await BluetoothAudio.isBluetoothConnected();
            setIsBluetoothAvailable(bluetoothResult.connected);
        } catch (error) {
            safeConsoleError('[useAudioRoute] Failed to detect audio route:', error);
            setCurrentRoute('unknown');
            setIsBluetoothAvailable(false);
        }
    }, []);

    // Enable Bluetooth audio routing
    const enableBluetooth = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) return;

        try {
            // First ensure speaker is off
            await BluetoothAudio.disableSpeaker();

            // Then enable Bluetooth routing
            await BluetoothAudio.startBluetoothAudio();

            // Wait a bit for route to stabilize
            await new Promise(resolve => setTimeout(resolve, 300));

            // Refresh to get updated route
            await detectAudioRoute();
        } catch (error) {
            safeConsoleError('[useAudioRoute] Failed to enable Bluetooth:', error);
        }
    }, [detectAudioRoute]);

    // Enable speaker output
    const enableSpeaker = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) return;

        try {
            await BluetoothAudio.enableSpeaker();

            // Wait a bit for route to stabilize
            await new Promise(resolve => setTimeout(resolve, 200));

            // Refresh to get updated route
            await detectAudioRoute();
        } catch (error) {
            safeConsoleError('[useAudioRoute] Failed to enable speaker:', error);
        }
    }, [detectAudioRoute]);

    // Disable all routing (return to default)
    const disableAll = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) return;

        try {
            await BluetoothAudio.disableSpeaker();
            await BluetoothAudio.stopBluetoothAudio();

            // Wait a bit for route to stabilize
            await new Promise(resolve => setTimeout(resolve, 200));

            // Refresh to get updated route
            await detectAudioRoute();
        } catch (error) {
            safeConsoleError('[useAudioRoute] Failed to disable routing:', error);
        }
    }, [detectAudioRoute]);

    // Initial detection on mount
    useEffect(() => {
        detectAudioRoute();
    }, [detectAudioRoute]);

    return {
        currentRoute,
        isBluetoothAvailable,
        isSpeakerActive: currentRoute === 'speaker',
        isBluetoothActive: currentRoute === 'bluetooth',
        enableBluetooth,
        enableSpeaker,
        disableAll,
        refresh: detectAudioRoute,
    };
};
