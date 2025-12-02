package com.therai.app;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.media.AudioAttributes;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
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
    private boolean keepRoutingLocked = false;
    private AudioDeviceCallback deviceCallback;

    // Audio focus handling
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;

    // SCO state monitor to auto-recover if system drops SCO
    private final android.content.BroadcastReceiver scoReceiver = new android.content.BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (audioManager == null) return;
            if (!AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED.equals(intent.getAction())) return;
            final int state = intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, AudioManager.SCO_AUDIO_STATE_ERROR);
            Log.d(TAG, "SCO state changed: " + state + " (locked=" + keepRoutingLocked + ")");
            if (keepRoutingLocked && state == AudioManager.SCO_AUDIO_STATE_DISCONNECTED) {
                // Try to re-enable SCO if we are supposed to keep it
                if (audioManager.isBluetoothScoAvailableOffCall()) {
                    Log.w(TAG, "SCO disconnected unexpectedly, attempting re-enable...");
                    try {
                        audioManager.startBluetoothSco();
                        audioManager.setBluetoothScoOn(true);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to re-enable SCO", e);
                    }
                }
            }
        }
    };

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        // Register SCO receiver
        try {
            IntentFilter filter = new IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED);
            getContext().registerReceiver(scoReceiver, filter);
        } catch (Exception e) {
            Log.w(TAG, "Failed to register SCO receiver", e);
        }
        // Prepare focus listener
        focusChangeListener = focusChange -> {
            Log.d(TAG, "Audio focus change: " + focusChange);
            // If focus is lost, we keep routing locked flag. SCO receiver will try to recover if dropped.
        };
        // Device change callback to re-assert communication device on API 31+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            deviceCallback = new AudioDeviceCallback() {
                @Override
                public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                    maybeSetCommunicationDevice();
                }
                @Override
                public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                    maybeSetCommunicationDevice();
                }
            };
            try {
                audioManager.registerAudioDeviceCallback(deviceCallback, null);
            } catch (Exception e) {
                Log.w(TAG, "Failed to register audio device callback", e);
            }
        }
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
            Log.d(TAG, "Current SCO state: " + audioManager.isBluetoothScoOn());

            // Step 1: Set audio mode to IN_COMMUNICATION (phone call mode)
            // This is critical - it tells Android we're doing voice communication
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            
            // Step 2: Turn off speakerphone (required for Bluetooth routing)
            audioManager.setSpeakerphoneOn(false);

            // Step 2.5: Request audio focus for voice communication
            boolean focusGranted = requestAudioFocus();
            Log.d(TAG, "Audio focus granted: " + focusGranted);
            
            // Step 3: Start Bluetooth SCO (Synchronous Connection-Oriented)
            // This forces the switch from A2DP (music) to HFP/HSP (phone call) profile
            if (audioManager.isBluetoothScoAvailableOffCall()) {
                if (!audioManager.isBluetoothScoOn()) {
                    audioManager.startBluetoothSco();
                    audioManager.setBluetoothScoOn(true);
                } else {
                    Log.d(TAG, "Bluetooth SCO already on, skipping start");
                }
                // On API 31+, explicitly pick BT SCO as communication device
                maybeSetCommunicationDevice();
                
                // CRITICAL: Wait for SCO to actually connect
                // startBluetoothSco() is asynchronous - takes 200-500ms
                int maxWaitMs = 1000;
                int waitedMs = 0;
                int checkIntervalMs = 50;
                
                while (waitedMs < maxWaitMs) {
                    if (audioManager.isBluetoothScoOn()) {
                        Log.d(TAG, "Bluetooth SCO connected after " + waitedMs + "ms");
                        break;
                    }
                    try {
                        Thread.sleep(checkIntervalMs);
                        waitedMs += checkIntervalMs;
                    } catch (InterruptedException e) {
                        Log.w(TAG, "Wait interrupted", e);
                        break;
                    }
                }
                
                if (!audioManager.isBluetoothScoOn()) {
                    Log.w(TAG, "Bluetooth SCO did not connect after " + waitedMs + "ms, continuing anyway");
                } else {
                    Log.d(TAG, "Bluetooth SCO ready for recording");
                }
                // Lock routing so receiver can re-assert SCO if dropped
                keepRoutingLocked = true;
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
            keepRoutingLocked = false;

            // Stop Bluetooth SCO
            if (audioManager.isBluetoothScoOn()) {
                audioManager.setBluetoothScoOn(false);
                audioManager.stopBluetoothSco();
            }

            // Restore previous audio state
            audioManager.setSpeakerphoneOn(wasSpeakerphoneOn);
            audioManager.setMode(previousAudioMode);
            abandonAudioFocus();

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
        abandonAudioFocus();
        // Unregister SCO receiver
        try {
            getContext().unregisterReceiver(scoReceiver);
        } catch (Exception e) {
            // ignore
        }
        // Unregister device callback
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && deviceCallback != null) {
            try {
                audioManager.unregisterAudioDeviceCallback(deviceCallback);
            } catch (Exception ignored) {}
            deviceCallback = null;
        }
    }

    private boolean requestAudioFocus() {
        if (audioManager == null) return false;
        if (hasAudioFocus) return true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                        .setAudioAttributes(attrs)
                        .setWillPauseWhenDucked(false)
                        .setOnAudioFocusChangeListener(focusChangeListener)
                        .build();
                int res = audioManager.requestAudioFocus(audioFocusRequest);
                hasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            } else {
                int res = audioManager.requestAudioFocus(
                        focusChangeListener,
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                );
                hasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            }
            return hasAudioFocus;
        } catch (Exception e) {
            Log.w(TAG, "Audio focus request failed", e);
            return false;
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        try {
            if (!hasAudioFocus) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            } else if (focusChangeListener != null) {
                audioManager.abandonAudioFocus(focusChangeListener);
            }
        } catch (Exception e) {
            Log.w(TAG, "Abandon audio focus failed", e);
        } finally {
            hasAudioFocus = false;
        }
    }

    private void maybeSetCommunicationDevice() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
        try {
            AudioDeviceInfo[] inputs = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS);
            AudioDeviceInfo btSco = null;
            for (AudioDeviceInfo dev : inputs) {
                if (dev.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) {
                    btSco = dev; break;
                }
            }
            if (btSco != null) {
                boolean ok = audioManager.setCommunicationDevice(btSco);
                Log.d(TAG, "setCommunicationDevice(BT_SCO) -> " + ok);
            } else {
                Log.d(TAG, "No BT_SCO input device found for setCommunicationDevice");
            }
        } catch (Exception e) {
            Log.w(TAG, "setCommunicationDevice failed", e);
        }
    }
}

