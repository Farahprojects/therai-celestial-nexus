#!/usr/bin/env node

/**
 * Script to fix the final edge cases of unsafe console statements
 */

const fs = require('fs');

function getRemainingFiles() {
  try {
    const { execSync } = require('child_process');
    const output = execSync(`grep -r "console\\.\\(error\\|warn\\).*," src/ --include="*.ts" --include="*.tsx" | grep -v safeConsole | cut -d: -f1 | sort | uniq`, { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

function fixEdgeCases(content) {
  let updatedContent = content;

  // Pattern 1: Multiple parameters with error at the end
  // console.warn('message:', var1, var2, error);
  updatedContent = updatedContent.replace(
    /console\.warn\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    (match, message, param1, errorVar) => {
      if (message.includes('safeConsole')) return match;
      // Only fix if the last parameter looks like an error variable
      if (errorVar.match(/(error|Error|err)$/)) {
        return `safeConsoleWarn(${message} ${param1}, ${errorVar})`;
      }
      return match;
    }
  );

  // Pattern 2: Object logging (these are harder to fix automatically, so we'll flag them)
  // console.error('message:', { key: value });
  updatedContent = updatedContent.replace(
    /console\.error\(\s*([^,]+?)\s*,\s*\{\s*([^}]+)\}\s*\)/g,
    (match, message, objectContent) => {
      if (message.includes('safeConsole')) return match;
      // Check if object contains error-related content
      if (objectContent.includes('error') || objectContent.includes('stack') || objectContent.includes('message')) {
        // Replace with a safer version - extract just the message if possible
        return `console.error(${message}, '[REDACTED ERROR OBJECT - Check for sensitive data]')`;
      }
      return match;
    }
  );

  // Pattern 3: Multiple string parameters
  // console.warn('message:', 'string1', 'string2', error);
  updatedContent = updatedContent.replace(
    /console\.warn\(\s*([^,]+?)\s*,\s*('[^']*')\s*,\s*('[^']*')\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    (match, message, str1, str2, errorVar) => {
      if (message.includes('safeConsole')) return match;
      if (errorVar.match(/(error|Error|err)$/)) {
        return `safeConsoleWarn(\`${message.replace(/'/g, '')} \${${str1}} \${${str2}}\`, ${errorVar})`;
      }
      return match;
    }
  );

  return updatedContent;
}

function processFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Fix edge cases
    content = fixEdgeCases(content);

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
  console.log('🎯 Fixing final edge cases...\n');

  const filesToProcess = getRemainingFiles();
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
  const remainingFiles = getRemainingFiles();
  if (remainingFiles.length > 0) {
    console.log(`\n📋 Remaining files require manual review:`);
    remainingFiles.forEach(file => console.log(`   - ${file}`));
    console.log('\nThese files contain complex logging patterns that need manual inspection.');
  } else {
    console.log('\n🎉 All unsafe console statements have been fixed!');
  }
}

// Run the script
if (require.main === module) {
  main();
}
