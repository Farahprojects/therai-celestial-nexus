#!/usr/bin/env node

/**
 * Script to fix the remaining unsafe console statements that use different variable names
 */

const fs = require('fs');
const path = require('path');

function getRemainingUnsafeConsoleFiles() {
  try {
    const { execSync } = require('child_process');
    const output = execSync(`grep -r "console\\.\\(error\\|warn\\).*," src/ --include="*.ts" --include="*.tsx" | grep -v safeConsole | cut -d: -f1 | sort | uniq`, { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

function addSafeLoggingImportIfNeeded(filePath) {
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
    // Try to add at the top if no imports found
    lines.unshift("import { safeConsoleError, safeConsoleWarn, safeConsoleLog } from '@/utils/safe-logging';");
    lines.unshift(""); // Add blank line
  } else {
    // Add the safe logging import after the last import
    const importStatement = "import { safeConsoleError, safeConsoleWarn, safeConsoleLog } from '@/utils/safe-logging';";
    lines.splice(lastImportIndex + 1, 0, importStatement);
  }

  return lines.join('\n');
}

function fixConsoleStatements(content) {
  let updatedContent = content;

  // More comprehensive regex patterns for error/warn logging
  // Pattern: console.error('message:', variableName)
  updatedContent = updatedContent.replace(
    /console\.error\(\s*([^,]+?)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    (match, context, errorVar) => {
      // Skip if it's already using safe logging
      if (context.includes('safeConsole')) return match;
      return `safeConsoleError(${context}, ${errorVar})`;
    }
  );

  // Pattern: console.warn('message:', variableName)
  updatedContent = updatedContent.replace(
    /console\.warn\(\s*([^,]+?)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    (match, context, errorVar) => {
      // Skip if it's already using safe logging
      if (context.includes('safeConsole')) return match;
      return `safeConsoleWarn(${context}, ${errorVar})`;
    }
  );

  // Pattern: console.error(`template:`, variableName)
  updatedContent = updatedContent.replace(
    /console\.error\(\s*(`[^`]+`)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    (match, context, errorVar) => {
      if (context.includes('safeConsole')) return match;
      return `safeConsoleError(${context}, ${errorVar})`;
    }
  );

  // Pattern: console.warn(`template:`, variableName)
  updatedContent = updatedContent.replace(
    /console\.warn\(\s*(`[^`]+`)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    (match, context, errorVar) => {
      if (context.includes('safeConsole')) return match;
      return `safeConsoleWarn(${context}, ${errorVar})`;
    }
  );

  return updatedContent;
}

function cleanUnusedImports(content) {
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
    content = content.replace(/import\s*\{\s*safeConsoleError,\s*safeConsoleWarn,\s*safeConsoleLog\s*\}\s*from\s*'@\/utils\/safe-logging';\s*\n?/g, '');
  } else {
    // Update the import to only include used functions
    const importStatement = `import { ${imports.join(', ')} } from '@/utils/safe-logging';`;
    content = content.replace(/import\s*\{\s*safeConsoleError,\s*safeConsoleWarn,\s*safeConsoleLog\s*\}\s*from\s*'@\/utils\/safe-logging';\s*\n?/g, importStatement + '\n');
  }

  return content;
}

function processFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Add safe logging import if needed
    content = addSafeLoggingImportIfNeeded(filePath);

    // Fix console statements
    content = fixConsoleStatements(content);

    // Clean up unused imports
    content = cleanUnusedImports(content);

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

function main() {
  console.log('🔧 Fixing remaining unsafe console statements...\n');

  const filesToProcess = getRemainingUnsafeConsoleFiles();
  console.log(`Found ${filesToProcess.length} files with remaining unsafe console statements\n`);

  let updatedCount = 0;

  for (const filePath of filesToProcess) {
    if (fs.existsSync(filePath)) {
      const wasUpdated = processFile(filePath);
      if (wasUpdated) {
        updatedCount++;
      }
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  }

  console.log(`\n✅ Processed ${filesToProcess.length} files, updated ${updatedCount} files`);

  // Final check
  const remainingFiles = getRemainingUnsafeConsoleFiles();
  if (remainingFiles.length > 0) {
    console.log(`\n⚠️  Still ${remainingFiles.length} files with unsafe console statements`);
    console.log('These may require manual review for complex logging patterns.');
  } else {
    console.log('\n🎉 All unsafe console statements have been fixed!');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processFile, fixConsoleStatements, cleanUnusedImports };
