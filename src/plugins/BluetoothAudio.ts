// Capacitor plugin for Bluetooth audio routing
import { registerPlugin } from '@capacitor/core';

export interface BluetoothAudioPlugin {
  /**
   * Start Bluetooth SCO (Synchronous Connection-Oriented) audio routing
   * This forces the device to use Bluetooth headset mic instead of built-in mic
   */
  startBluetoothAudio(): Promise<{ success: boolean }>;
  
  /**
   * Stop Bluetooth SCO audio routing and return to normal audio mode
   */
  stopBluetoothAudio(): Promise<{ success: boolean }>;
  
  /**
   * Check if Bluetooth audio device is connected
   */
  isBluetoothConnected(): Promise<{ connected: boolean }>;
}

const BluetoothAudio = registerPlugin<BluetoothAudioPlugin>('BluetoothAudio', {
  web: () => import('./web').then(m => new m.BluetoothAudioWeb()),
});

export default BluetoothAudio;

