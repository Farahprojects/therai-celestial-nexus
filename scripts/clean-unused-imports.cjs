#!/usr/bin/env node

/**
 * Script to clean up unused safe logging imports
 */

const fs = require('fs');
const path = require('path');

// Files that were processed
const filesToProcess = [
  'src/contexts/ModalStateContext.tsx',
  'src/contexts/ThreadsContext.tsx',
  'src/contexts/AuthContext.tsx',
  'src/contexts/ModalStateProvider.tsx',
  'src/contexts/ReportModalContext.tsx',
  'src/contexts/NavigationStateContext.tsx',
  'src/core/store.ts',
  'src/features/chat/ChatBox.tsx',
  'src/features/chat/ChatThreadsSidebar.tsx',
  'src/features/chat/ChatController.ts',
  'src/components/sync/ProfileSelectorModal.tsx',
  'src/components/chat/AstroDataForm.tsx',
  'src/components/shared/forms/ProfileSelector.tsx',
  'src/stores/messageStore.ts',
  'src/services/conversations-static.ts',
  'src/features/chat/ConversationOverlay/ConversationOverlay.tsx'
];

function cleanUnusedImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check which safe logging functions are actually used
    const usesError = content.includes('safeConsoleError(');
    const usesWarn = content.includes('safeConsoleWarn(');
    const usesLog = content.includes('safeConsoleLog(');

    // Build the import statement with only used functions
    const imports = [];
    if (usesError) imports.push('safeConsoleError');
    if (usesWarn) imports.push('safeConsoleWarn');
    if (usesLog) imports.push('safeConsoleLog');

    if (imports.length === 0) {
      // Remove the import entirely if none are used
      content = content.replace(/import\s*\{\s*safeConsoleError,\s*safeConsoleWarn,\s*safeConsoleLog\s*\}\s*from\s*'@\/utils\/safe-logging';\s*\n?/g, '');
    } else {
      // Update the import to only include used functions
      const importStatement = `import { ${imports.join(', ')} } from '@/utils/safe-logging';`;
      content = content.replace(/import\s*\{\s*safeConsoleError,\s*safeConsoleWarn,\s*safeConsoleLog\s*\}\s*from\s*'@\/utils\/safe-logging';\s*\n?/g, importStatement + '\n');
    }

    fs.writeFileSync(filePath, content);
    console.log(`✅ Cleaned imports in ${filePath}`);
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
  }
}

function main() {
  console.log('🧹 Cleaning up unused safe logging imports...\n');

  for (const filePath of filesToProcess) {
    if (fs.existsSync(filePath)) {
      cleanUnusedImports(filePath);
    }
  }

  console.log('\n✅ Import cleanup completed!');
}

// Run the script
if (require.main === module) {
  main();
}
