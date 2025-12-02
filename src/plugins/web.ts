// Web implementation of BluetoothAudio plugin (no-op for browsers)
import { WebPlugin } from '@capacitor/core';
import type { BluetoothAudioPlugin } from './BluetoothAudio';

export class BluetoothAudioWeb extends WebPlugin implements BluetoothAudioPlugin {
  async startBluetoothAudio(): Promise<{ success: boolean }> {
    // Web browsers handle audio routing automatically
    // No explicit Bluetooth control needed
    return { success: true };
  }

  async stopBluetoothAudio(): Promise<{ success: boolean }> {
    return { success: true };
  }

  async isBluetoothConnected(): Promise<{ connected: boolean }> {
    // Web API doesn't expose Bluetooth audio connection status
    return { connected: false };
  }
}

