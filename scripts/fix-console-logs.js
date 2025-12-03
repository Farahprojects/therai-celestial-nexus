#!/usr/bin/env node

/**
 * Script to automatically fix unsafe console logging in the codebase
 * Replaces console.error/warn calls that log error objects directly
 * with safe logging utilities that redact sensitive data
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to process
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

function addSafeLoggingImport(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Check if import already exists
  if (content.includes("import { safeConsoleError") || content.includes("import { safeConsoleWarn") || content.includes("import { safeConsoleLog")) {
    return content;
  }

  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import') && line.includes('from')) {
      lastImportIndex = i;
    } else if (lastImportIndex !== -1 && !line.startsWith('//') && line !== '') {
      break;
    }
  }

  if (lastImportIndex === -1) {
    console.log(`No imports found in ${filePath}, skipping`);
    return content;
  }

  // Add the safe logging import after the last import
  const importStatement = "import { safeConsoleError, safeConsoleWarn, safeConsoleLog } from '@/utils/safe-logging';";
  lines.splice(lastImportIndex + 1, 0, importStatement);

  return lines.join('\n');
}

function replaceConsoleErrors(content) {
  let updatedContent = content;

  // Replace console.error with safeConsoleError
  updatedContent = updatedContent.replace(
    /console\.error\(([^,]+),\s*([^)]+)\)/g,
    (match, context, errorVar) => {
      // Skip if it's already using safe logging
      if (context.includes('safeConsole')) return match;
      return `safeConsoleError(${context}, ${errorVar})`;
    }
  );

  // Replace console.warn with safeConsoleWarn
  updatedContent = updatedContent.replace(
    /console\.warn\(([^,]+),\s*([^)]+)\)/g,
    (match, context, errorVar) => {
      // Skip if it's already using safe logging
      if (context.includes('safeConsole')) return match;
      return `safeConsoleWarn(${context}, ${errorVar})`;
    }
  );

  // Replace console.log calls that might contain sensitive data
  updatedContent = updatedContent.replace(
    /console\.log\(([^,]+),\s*([^)]+)\)/g,
    (match, context, data) => {
      // Skip if it's already using safe logging
      if (context.includes('safeConsole')) return match;
      // Check if data contains potential sensitive information
      if (data.includes('user') || data.includes('chat') || data.includes('id') || data.includes('profile')) {
        return `safeConsoleLog(${context}, ${data})`;
      }
      return match; // Keep original if not sensitive
    }
  );

  return updatedContent;
}

function processFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);

    let content = fs.readFileSync(filePath, 'utf8');

    // Add safe logging import if needed
    content = addSafeLoggingImport(filePath);

    // Replace unsafe console statements
    content = replaceConsoleErrors(content);

    // Write back to file
    fs.writeFileSync(filePath, content);

    console.log(`✅ Updated ${filePath}`);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

function main() {
  console.log('🔒 Starting console log security audit and fix...\n');

  for (const filePath of filesToProcess) {
    if (fs.existsSync(filePath)) {
      processFile(filePath);
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  }

  console.log('\n✅ Console log security audit completed!');
  console.log('\nNext steps:');
  console.log('1. Run your tests to ensure functionality is preserved');
  console.log('2. Check remaining console statements manually for any edge cases');
  console.log('3. Consider adding ESLint rules to prevent future unsafe logging');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processFile, addSafeLoggingImport, replaceConsoleErrors };
