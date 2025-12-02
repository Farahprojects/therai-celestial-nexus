import Foundation
import Capacitor
import AVFoundation

@objc(BluetoothAudioPlugin)
public class BluetoothAudioPlugin: CAPPlugin {
    private let TAG = "BluetoothAudioPlugin"
    private var previousCategory: AVAudioSession.Category?
    private var previousMode: AVAudioSession.Mode?
    private var previousOptions: AVAudioSession.CategoryOptions?
    
    @objc func startBluetoothAudio(_ call: CAPPluginCall) {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            // Save current audio session state
            previousCategory = audioSession.category
            previousMode = audioSession.mode
            previousOptions = audioSession.categoryOptions
            
            print("[\(TAG)] Starting Bluetooth audio routing")
            print("[\(TAG)] Previous category: \(previousCategory?.rawValue ?? "unknown")")
            print("[\(TAG)] Available inputs: \(audioSession.availableInputs?.map { $0.portName } ?? [])")
            
            // Step 1: Set category to playAndRecord (required for simultaneous input/output)
            // Step 2: Set mode to voiceChat (optimized for voice communication)
            // Step 3: Add allowBluetooth option (enables Bluetooth routing)
            // NOTE: Do NOT default to speaker to avoid route oscillation when using headsets
            // For stability: prefer HFP (call profile) only; avoid A2DP switches during conversation
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
            
            // Step 5: Activate the audio session
            try audioSession.setActive(true, options: [])
            
            // Step 6: Explicitly route to Bluetooth if available
            if let bluetoothInput = audioSession.availableInputs?.first(where: { 
                $0.portType == .bluetoothHFP || $0.portType == .bluetoothA2DP 
            }) {
                try audioSession.setPreferredInput(bluetoothInput)
                print("[\(TAG)] Bluetooth input explicitly selected: \(bluetoothInput.portName)")
            } else {
                print("[\(TAG)] No Bluetooth input found, but configuration applied")
            }
            
            print("[\(TAG)] Bluetooth audio routing configured successfully")
            print("[\(TAG)] Current route: \(audioSession.currentRoute.inputs.map { $0.portName })")
            
            call.resolve(["success": true])
            
        } catch {
            print("[\(TAG)] Error starting Bluetooth audio: \(error.localizedDescription)")
            call.reject("Failed to start Bluetooth audio: \(error.localizedDescription)")
        }
    }
    
    @objc func stopBluetoothAudio(_ call: CAPPluginCall) {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            print("[\(TAG)] Stopping Bluetooth audio routing")
            
            // Restore previous audio session configuration
            if let category = previousCategory,
               let mode = previousMode,
               let options = previousOptions {
                try audioSession.setCategory(category, mode: mode, options: options)
                print("[\(TAG)] Restored previous category: \(category.rawValue)")
            } else {
                // Default fallback: restore to playback mode
                try audioSession.setCategory(.playback, mode: .default, options: [])
                print("[\(TAG)] Restored to default playback mode")
            }
            
            // Deactivate audio session
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
            
            print("[\(TAG)] Bluetooth audio routing stopped")
            
            call.resolve(["success": true])
            
        } catch {
            print("[\(TAG)] Error stopping Bluetooth audio: \(error.localizedDescription)")
            call.reject("Failed to stop Bluetooth audio: \(error.localizedDescription)")
        }
    }
    
    
    @objc func enableSpeaker(_ call: CAPPluginCall) {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            print("[\(TAG)] Enabling speaker output")
            
            // Set category with defaultToSpeaker option
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
            try audioSession.setActive(true, options: [])
            
            print("[\(TAG)] Speaker output enabled successfully")
            call.resolve(["success": true])
            
        } catch {
            print("[\(TAG)] Error enabling speaker: \(error.localizedDescription)")
            call.reject("Failed to enable speaker: \(error.localizedDescription)")
        }
    }
    
    @objc func disableSpeaker(_ call: CAPPluginCall) {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            print("[\(TAG)] Disabling speaker output, returning to default")
            
            // Remove defaultToSpeaker option, keep Bluetooth available
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
            try audioSession.setActive(true, options: [])
            
            print("[\(TAG)] Speaker output disabled")
            call.resolve(["success": true])
            
        } catch {
            print("[\(TAG)] Error disabling speaker: \(error.localizedDescription)")
            call.reject("Failed to disable speaker: \(error.localizedDescription)")
        }
    }
    
    @objc func getCurrentAudioRoute(_ call: CAPPluginCall) {
        let audioSession = AVAudioSession.sharedInstance()
        
        // Check current output route
        let currentRoute = audioSession.currentRoute
        let outputs = currentRoute.outputs
        
        var route = "unknown"
        
        if let output = outputs.first {
            switch output.portType {
            case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE:
                route = "bluetooth"
            case .builtInSpeaker:
                route = "speaker"
            case .builtInReceiver:
                route = "receiver"
            case .headphones, .headsetMic:
                route = "headphones"
            default:
                route = "unknown"
            }
            
            print("[\(TAG)] Current audio route: \(route) (port: \(output.portName))")
        }
        
        call.resolve(["route": route])
    }
}

