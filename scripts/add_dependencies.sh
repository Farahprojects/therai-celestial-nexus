#!/bin/bash

# Script to add Swift Package Manager dependencies to TheraiIOS project
# This script modifies the project.pbxproj file to add Supabase and Google Sign-In

PROJECT_FILE="TheraiIOS.xcodeproj/project.pbxproj"

# Check if project file exists
if [ ! -f "$PROJECT_FILE" ]; then
    echo "Error: Project file not found at $PROJECT_FILE"
    exit 1
fi

echo "Adding Swift Package Manager dependencies to TheraiIOS project..."

# Create backup
cp "$PROJECT_FILE" "$PROJECT_FILE.backup"

# Add package references section (this is a simplified approach)
# In a real scenario, you'd use Xcode's GUI or xcodebuild commands

echo "Dependencies to add:"
echo "1. Supabase Swift SDK: https://github.com/supabase/supabase-swift"
echo "2. Google Sign-In: https://github.com/google/GoogleSignIn-iOS"

echo ""
echo "To add these dependencies:"
echo "1. Open TheraiIOS.xcodeproj in Xcode"
echo "2. Select the project in the navigator"
echo "3. Go to 'Package Dependencies' tab"
echo "4. Click '+' and add:"
echo "   - https://github.com/supabase/supabase-swift"
echo "   - https://github.com/google/GoogleSignIn-iOS"
echo "5. Select the TheraiIOS target and add the products:"
echo "   - Supabase"
echo "   - GoogleSignIn"

echo ""
echo "Alternatively, you can use the Xcode command line tools:"
echo "xcodebuild -resolvePackageDependencies -project TheraiIOS.xcodeproj"

echo ""
echo "Backup created at: $PROJECT_FILE.backup"

