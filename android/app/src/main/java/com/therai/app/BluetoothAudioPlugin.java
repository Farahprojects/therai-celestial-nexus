package com.therai.app;

import android.content.Context;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "BluetoothAudio")
public class BluetoothAudioPlugin extends Plugin {
    private static final String TAG = "BluetoothAudioPlugin";
    private AudioManager audioManager;
    private int previousAudioMode = AudioManager.MODE_NORMAL;
    private boolean wasSpeakerphoneOn = false;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void startBluetoothAudio(PluginCall call) {
        try {
            if (audioManager == null) {
                call.reject("AudioManager not available");
                return;
            }

            // Save current audio state
            previousAudioMode = audioManager.getMode();
            wasSpeakerphoneOn = audioManager.isSpeakerphoneOn();

            Log.d(TAG, "Starting Bluetooth audio routing");
            Log.d(TAG, "Previous mode: " + previousAudioMode);
            Log.d(TAG, "Bluetooth SCO available: " + audioManager.isBluetoothScoAvailableOffCall());

            // Step 1: Set audio mode to IN_COMMUNICATION (phone call mode)
            // This is critical - it tells Android we're doing voice communication
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            
            // Step 2: Turn off speakerphone (required for Bluetooth routing)
            audioManager.setSpeakerphoneOn(false);
            
            // Step 3: Start Bluetooth SCO (Synchronous Connection-Oriented)
            // This forces the switch from A2DP (music) to HFP/HSP (phone call) profile
            if (audioManager.isBluetoothScoAvailableOffCall()) {
                audioManager.startBluetoothSco();
                audioManager.setBluetoothScoOn(true);
                Log.d(TAG, "Bluetooth SCO started successfully");
            } else {
                Log.w(TAG, "Bluetooth SCO not available, continuing anyway");
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error starting Bluetooth audio", e);
            call.reject("Failed to start Bluetooth audio: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopBluetoothAudio(PluginCall call) {
        try {
            if (audioManager == null) {
                call.reject("AudioManager not available");
                return;
            }

            Log.d(TAG, "Stopping Bluetooth audio routing");

            // Stop Bluetooth SCO
            if (audioManager.isBluetoothScoOn()) {
                audioManager.setBluetoothScoOn(false);
                audioManager.stopBluetoothSco();
            }

            // Restore previous audio state
            audioManager.setSpeakerphoneOn(wasSpeakerphoneOn);
            audioManager.setMode(previousAudioMode);

            Log.d(TAG, "Bluetooth audio stopped, restored to mode: " + previousAudioMode);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error stopping Bluetooth audio", e);
            call.reject("Failed to stop Bluetooth audio: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isBluetoothConnected(PluginCall call) {
        try {
            if (audioManager == null) {
                call.reject("AudioManager not available");
                return;
            }

            boolean connected = false;
            
            // Check if Bluetooth audio device is connected
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Modern API (Android 6.0+)
                android.media.AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                for (android.media.AudioDeviceInfo device : devices) {
                    if (device.getType() == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        device.getType() == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) {
                        connected = true;
                        Log.d(TAG, "Bluetooth audio device detected: " + device.getProductName());
                        break;
                    }
                }
            } else {
                // Fallback for older Android versions
                connected = audioManager.isBluetoothScoAvailableOffCall();
            }

            JSObject ret = new JSObject();
            ret.put("connected", connected);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking Bluetooth connection", e);
            call.reject("Failed to check Bluetooth connection: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        // Clean up when plugin is destroyed
        if (audioManager != null && audioManager.isBluetoothScoOn()) {
            audioManager.setBluetoothScoOn(false);
            audioManager.stopBluetoothSco();
            audioManager.setMode(AudioManager.MODE_NORMAL);
        }
    }
}

