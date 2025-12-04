import React, { useEffect } from 'react';
import { Bluetooth, Volume2 } from 'lucide-react';
import { useAudioRoute } from '@/hooks/useAudioRoute';
import { useIsNativeApp } from '@/hooks/use-native-app';

/**
 * Audio routing control buttons for conversation mode
 * Shows Bluetooth and Speaker toggle buttons in top-right corner
 * Only renders on native iOS/Android apps
 */
export const AudioRouteControls: React.FC = () => {
    const isNative = useIsNativeApp();
    const {
        isBluetoothAvailable,
        isSpeakerActive,
        isBluetoothActive,
        enableBluetooth,
        enableSpeaker,
        refresh,
    } = useAudioRoute();

    // Refresh audio route periodically during conversation (only on native)
    useEffect(() => {
        if (!isNative) return;
        
        const interval = setInterval(() => {
            refresh();
        }, 3000);

        return () => clearInterval(interval);
    }, [refresh, isNative]);

    // Only render on native iOS/Android apps
    if (!isNative) {
        return null;
    }

    const handleBluetoothToggle = async () => {
        if (isBluetoothActive) {
            // Already on Bluetooth, do nothing (or could disable to default)
            return;
        }
        await enableBluetooth();
    };

    const handleSpeakerToggle = async () => {
        if (isSpeakerActive) {
            // Already on speaker, do nothing (or could disable to default)
            return;
        }
        await enableSpeaker();
    };

    return (
        <div className="absolute top-4 right-4 flex gap-2 z-10">
            {/* Bluetooth Button */}
            <button
                onClick={handleBluetoothToggle}
                disabled={!isBluetoothAvailable}
                className={`
          w-10 h-10 rounded-full flex items-center justify-center transition-all
          ${isBluetoothActive
                        ? 'bg-blue-100 shadow-md'
                        : 'bg-white/80 hover:bg-white/100'
                    }
          ${!isBluetoothAvailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        `}
                aria-label={isBluetoothActive ? 'Bluetooth active' : 'Switch to Bluetooth'}
            >
                <Bluetooth
                    className={`w-5 h-5 ${isBluetoothActive ? 'text-blue-600' : 'text-gray-600'}`}
                />
            </button>

            {/* Speaker Button */}
            <button
                onClick={handleSpeakerToggle}
                className={`
          w-10 h-10 rounded-full flex items-center justify-center transition-all
          ${isSpeakerActive
                        ? 'bg-orange-100 shadow-md'
                        : 'bg-white/80 hover:bg-white/100'
                    }
          cursor-pointer
        `}
                aria-label={isSpeakerActive ? 'Speaker active' : 'Switch to speaker'}
            >
                <Volume2
                    className={`w-5 h-5 ${isSpeakerActive ? 'text-orange-600' : 'text-gray-600'}`}
                />
            </button>
        </div>
    );
};
