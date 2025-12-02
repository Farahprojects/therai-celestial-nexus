#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BluetoothAudioPlugin, "BluetoothAudio",
           CAP_PLUGIN_METHOD(startBluetoothAudio, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopBluetoothAudio, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isBluetoothConnected, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(enableSpeaker, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disableSpeaker, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getCurrentAudioRoute, CAPPluginReturnPromise);)
