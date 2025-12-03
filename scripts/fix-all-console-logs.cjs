#!/usr/bin/env node

/**
 * Comprehensive script to automatically fix ALL unsafe console logging in the codebase
 * Replaces console.error/warn calls that log error objects directly
 * with safe logging utilities that redact sensitive data
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getAllFilesWithUnsafeConsole() {
  try {
    const output = execSync(`grep -r "console\\.\\(error\\|warn\\).*," src/ --include="*.ts" --include="*.tsx" | grep -v safeConsole | cut -d: -f1 | sort | uniq`, { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.log('No more unsafe console statements found');
    return [];
  }
}

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

  // Replace console.error with safeConsoleError - handle various patterns
  // Pattern 1: console.error('message:', error)
  updatedContent = updatedContent.replace(
    /console\.error\(\s*([^,]+?)\s*,\s*([^)]+)\s*\)/g,
    (match, context, errorVar) => {
      // Skip if it's already using safe logging
      if (context.includes('safeConsole')) return match;
      // Skip if errorVar doesn't look like an error variable
      if (!errorVar.trim().match(/^(error|e|err|errorVar)$/)) return match;
      return `safeConsoleError(${context}, ${errorVar})`;
    }
  );

  // Pattern 2: console.error(`template:`, error)
  updatedContent = updatedContent.replace(
    /console\.error\(\s*(`[^`]+`)\s*,\s*([^)]+)\s*\)/g,
    (match, context, errorVar) => {
      if (context.includes('safeConsole')) return match;
      if (!errorVar.trim().match(/^(error|e|err|errorVar)$/)) return match;
      return `safeConsoleError(${context}, ${errorVar})`;
    }
  );

  // Pattern 3: console.error('message: ' + var, error)
  updatedContent = updatedContent.replace(
    /console\.error\(\s*([^,]+?\+\s*[^,]+)\s*,\s*([^)]+)\s*\)/g,
    (match, context, errorVar) => {
      if (context.includes('safeConsole')) return match;
      if (!errorVar.trim().match(/^(error|e|err|errorVar)$/)) return match;
      return `safeConsoleError(${context}, ${errorVar})`;
    }
  );

  // Replace console.warn with safeConsoleWarn - same patterns
  updatedContent = updatedContent.replace(
    /console\.warn\(\s*([^,]+?)\s*,\s*([^)]+)\s*\)/g,
    (match, context, errorVar) => {
      if (context.includes('safeConsole')) return match;
      if (!errorVar.trim().match(/^(error|e|err|errorVar)$/)) return match;
      return `safeConsoleWarn(${context}, ${errorVar})`;
    }
  );

  updatedContent = updatedContent.replace(
    /console\.warn\(\s*(`[^`]+`)\s*,\s*([^)]+)\s*\)/g,
    (match, context, errorVar) => {
      if (context.includes('safeConsole')) return match;
      if (!errorVar.trim().match(/^(error|e|err|errorVar)$/)) return match;
      return `safeConsoleWarn(${context}, ${errorVar})`;
    }
  );

  // Handle console.log statements that might contain sensitive data
  updatedContent = updatedContent.replace(
    /console\.log\(\s*([^,]+?)\s*,\s*([^)]+)\s*\)/g,
    (match, context, data) => {
      if (context.includes('safeConsole')) return match;
      // Check if data contains potential sensitive information
      if (data.includes('user') || data.includes('chat') || data.includes('id') || data.includes('profile') ||
          data.includes('token') || data.includes('key') || data.includes('secret')) {
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
    const originalContent = content;
    content = replaceConsoleErrors(content);

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath}`);
      return true;
    } else {
      console.log(`⚪ No changes needed for ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

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
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
  }
}

function main() {
  console.log('🔒 Starting comprehensive console log security audit and fix...\n');

  let filesToProcess = getAllFilesWithUnsafeConsole();
  let totalProcessed = 0;
  let totalUpdated = 0;

  while (filesToProcess.length > 0) {
    console.log(`\n📁 Processing ${filesToProcess.length} files...`);

    for (const filePath of filesToProcess) {
      if (fs.existsSync(filePath)) {
        const wasUpdated = processFile(filePath);
        totalProcessed++;
        if (wasUpdated) {
          totalUpdated++;
        }
      } else {
        console.log(`⚠️  File not found: ${filePath}`);
      }
    }

    // Clean up unused imports for all processed files
    console.log('\n🧹 Cleaning up unused imports...');
    filesToProcess.forEach(cleanUnusedImports);

    // Check if there are more files to process
    const remainingFiles = getAllFilesWithUnsafeConsole();
    if (remainingFiles.length === 0) {
      break;
    }

    // Avoid infinite loop - if we're not making progress, stop
    if (remainingFiles.length >= filesToProcess.length) {
      console.log('⚠️  No progress made in this iteration. Stopping to avoid infinite loop.');
      console.log('Remaining files:', remainingFiles.slice(0, 10));
      break;
    }

    filesToProcess = remainingFiles;
  }

  console.log('\n✅ Console log security audit completed!');
  console.log(`📊 Summary: ${totalProcessed} files processed, ${totalUpdated} files updated`);

  // Final verification
  const remainingUnsafe = getAllFilesWithUnsafeConsole();
  if (remainingUnsafe.length > 0) {
    console.log(`\n⚠️  ${remainingUnsafe.length} files still have unsafe console statements:`);
    remainingUnsafe.slice(0, 10).forEach(file => console.log(`   - ${file}`));
    if (remainingUnsafe.length > 10) {
      console.log(`   ... and ${remainingUnsafe.length - 10} more`);
    }
  } else {
    console.log('\n🎉 All unsafe console statements have been fixed!');
  }

  console.log('\n🔍 Next steps:');
  console.log('1. Run your tests to ensure functionality is preserved');
  console.log('2. Check any remaining console statements manually');
  console.log('3. Consider adding ESLint rules to prevent future unsafe logging');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processFile, addSafeLoggingImport, replaceConsoleErrors, cleanUnusedImports };
