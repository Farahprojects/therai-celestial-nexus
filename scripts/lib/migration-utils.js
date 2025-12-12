import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Shared utilities for migration analysis scripts
 */

/**
 * Load migration files from the supabase/migrations directory
 * @param {Object} options - Options for loading migrations
 * @param {boolean} options.includeOperations - Whether to parse operations (for detailed analysis)
 * @param {boolean} options.includeMetadata - Whether to include file metadata (lines, size)
 * @returns {Array} Array of migration objects
 */
export function loadMigrations(options = {}) {
  const { includeOperations = false, includeMetadata = false } = options;

  const migrationDir = path.join(__dirname, '..', '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Loading ${files.length} migration files...`);

  const migrations = [];

  for (const file of files) {
    const filePath = path.join(migrationDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const migration = {
      file,
      content
    };

    if (includeMetadata) {
      migration.lines = content.split('\n').length;
      migration.size = content.length;
    }

    if (includeOperations) {
      migration.operations = parseOperations(content);
    }

    migrations.push(migration);
  }

  return migrations;
}

/**
 * Parse SQL operations from migration content
 * @param {string} content - The migration file content
 * @returns {Array} Array of parsed operations
 */
export function parseOperations(content) {
  const operations = [];
  const lines = content.split('\n');

  // Track table context throughout the migration
  let currentTableContext = null;
  let statementBuffer = [];
  let inMultiLineStatement = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip comments
    if (line.startsWith('--')) continue;
    if (!line) continue;

    // Handle multi-line statements (statements ending with semicolons)
    if (!inMultiLineStatement && !line.includes(';')) {
      // Single line statement
      processLine(line, i);
    } else {
      // Multi-line statement handling
      statementBuffer.push(line);
      if (line.includes(';')) {
        // End of multi-line statement
        const fullStatement = statementBuffer.join(' ').replace(/;$/, '');
        processLine(fullStatement, i - statementBuffer.length + 1);
        statementBuffer = [];
        inMultiLineStatement = false;
      } else {
        inMultiLineStatement = true;
      }
    }
  }

  function processLine(line, lineNumber) {
    // Update table context for ALTER TABLE statements
    const alterTableMatch = line.match(/ALTER\s+TABLE\s+(?:ONLY\s+)?["`]?(\w+)["`]?/i);
    if (alterTableMatch) {
      currentTableContext = alterTableMatch[1];
    }

    // Update table context for CREATE TABLE statements
    const createTableMatch = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (createTableMatch) {
      currentTableContext = createTableMatch[1];
    }

    // Parse different types of operations

    // Policy operations
    const policyMatch = line.match(/(CREATE|DROP)\s+POLICY\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (policyMatch) {
      operations.push({
        type: policyMatch[1].toUpperCase(),
        objectType: 'POLICY',
        name: policyMatch[2],
        line: lineNumber + 1,
        content: line
      });
      return;
    }

    // Index operations
    const indexMatch = line.match(/(CREATE|DROP)\s+INDEX\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (indexMatch) {
      operations.push({
        type: indexMatch[1].toUpperCase(),
        objectType: 'INDEX',
        name: indexMatch[2],
        line: lineNumber + 1,
        content: line
      });
      return;
    }

    // Table operations
    const tableMatch = line.match(/(CREATE|DROP|ALTER)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (tableMatch) {
      operations.push({
        type: tableMatch[1].toUpperCase(),
        objectType: 'TABLE',
        name: tableMatch[2],
        line: lineNumber + 1,
        content: line
      });
      return;
    }

    // Function operations
    const functionMatch = line.match(/(CREATE|DROP)\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+["`]?(\w+)["`]?/i);
    if (functionMatch) {
      operations.push({
        type: functionMatch[1].toUpperCase(),
        objectType: 'FUNCTION',
        name: functionMatch[2],
        line: lineNumber + 1,
        content: line
      });
      return;
    }

    // Trigger operations
    const triggerMatch = line.match(/(CREATE|DROP)\s+TRIGGER\s+["`]?(\w+)["`]?/i);
    if (triggerMatch) {
      operations.push({
        type: triggerMatch[1].toUpperCase(),
        objectType: 'TRIGGER',
        name: triggerMatch[2],
        line: lineNumber + 1,
        content: line
      });
      return;
    }

    // Column operations within ALTER TABLE context
    const columnMatch = line.match(/(ADD|DROP)\s+COLUMN\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (columnMatch && currentTableContext) {
      operations.push({
        type: columnMatch[1].toUpperCase(),
        objectType: 'COLUMN',
        name: `${currentTableContext}.${columnMatch[2]}`,
        line: lineNumber + 1,
        content: line
      });
      return;
    }
  }

  return operations;
}

/**
 * Infer the feature category from a migration filename
 * @param {string} filename - The migration filename
 * @returns {string} The inferred feature category
 */
export function inferFeature(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('folder') || lower.includes('chat')) return 'chat_folders';
  if (lower.includes('message') || lower.includes('conversation')) return 'messaging';
  if (lower.includes('feature') || lower.includes('usage') || lower.includes('limit')) return 'billing_limits';
  if (lower.includes('voice') || lower.includes('audio')) return 'voice_audio';
  if (lower.includes('image') || lower.includes('generation')) return 'image_generation';
  if (lower.includes('profile') || lower.includes('user')) return 'user_profiles';
  if (lower.includes('rls') || lower.includes('policy') || lower.includes('security')) return 'security_rls';
  if (lower.includes('memory') || lower.includes('insight')) return 'memory_insights';
  if (lower.includes('payment') || lower.includes('stripe') || lower.includes('credit')) return 'payments';
  return 'other';
}