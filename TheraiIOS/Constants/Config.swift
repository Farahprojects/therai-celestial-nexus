//
//  Config.swift
//  TheraiIOS
//
//  Created by Peter Farrah on 27/9/2025.
//
//  SECURITY: Sensitive credentials are loaded from Config.local.swift which is not tracked by git.
//  See Config.local.swift.example for setup instructions.
//

import Foundation

// Default ConfigLocal implementation (will be overridden by Config.local.swift if it exists)
// This allows the code to compile even if Config.local.swift doesn't exist yet
struct ConfigLocal {
    static let supabaseUrl = "https://api.therai.co"
    static let supabaseAnonKey = "YOUR_ANON_KEY_HERE"
    static let googleClientId = "YOUR_GOOGLE_CLIENT_ID_HERE"
    static let appleClientId = "co.scai.TheraiIOS"
}

struct Config {
    // Load from Config.local.swift if available, otherwise use defaults
    // Note: Config.local.swift should be created from Config.local.swift.example
    // and added to .gitignore
    
    // Supabase Configuration
    // In release builds, Config.local.swift is required
    // In debug builds, falls back to defaults if Config.local.swift doesn't exist
    static let supabaseUrl: String = {
        let localUrl = ConfigLocal.supabaseUrl
        #if DEBUG
        // In debug, allow default URL if local config not set
        if localUrl == "https://api.therai.co" || localUrl.isEmpty {
            return "https://api.therai.co"
        }
        return localUrl
        #else
        // Release mode: require Config.local.swift with valid values
        if localUrl.isEmpty || localUrl == "YOUR_SUPABASE_URL_HERE" {
            fatalError("Config.local.swift is required for release builds. Please copy Config.local.swift.example to Config.local.swift and fill in your credentials.")
        }
        return localUrl
        #endif
    }()
    
    static let supabaseAnonKey: String = {
        let localKey = ConfigLocal.supabaseAnonKey
        #if DEBUG
        // In debug, require local config
        if localKey.isEmpty || localKey == "YOUR_ANON_KEY_HERE" {
            fatalError("Missing supabaseAnonKey in Config.local.swift. Please copy Config.local.swift.example to Config.local.swift and fill in your credentials.")
        }
        return localKey
        #else
        // Release mode: require Config.local.swift
        if localKey.isEmpty || localKey == "YOUR_ANON_KEY_HERE" {
            fatalError("Config.local.swift is required for release builds. Please copy Config.local.swift.example to Config.local.swift and fill in your credentials.")
        }
        return localKey
        #endif
    }()
    
    // OAuth Configuration
    static let googleClientId: String = {
        let localId = ConfigLocal.googleClientId
        #if DEBUG
        // In debug, allow default if local config not set
        if localId.isEmpty || localId == "YOUR_GOOGLE_CLIENT_ID_HERE" {
            return "706959873059-ilu0j4usjtfuehp4h3l06snknbcnd2f4.apps.googleusercontent.com"
        }
        return localId
        #else
        // Release mode: require Config.local.swift
        if localId.isEmpty || localId == "YOUR_GOOGLE_CLIENT_ID_HERE" {
            fatalError("Config.local.swift is required for release builds. Please copy Config.local.swift.example to Config.local.swift and fill in your credentials.")
        }
        return localId
        #endif
    }()
    
    static let appleClientId = ConfigLocal.appleClientId
    
    // API Endpoints
    static let baseApiUrl = "https://api.therai.co"
    static let chatEndpoint = "/api/chat"
    static let threadsEndpoint = "/api/threads"
}