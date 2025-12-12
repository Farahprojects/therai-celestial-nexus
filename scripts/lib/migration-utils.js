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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('--')) continue;

    // Extract CREATE/DROP/ALTER operations
    const createMatch = line.match(/(CREATE|DROP|ALTER)\s+(POLICY|INDEX|TABLE|FUNCTION|TRIGGER)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (createMatch) {
      operations.push({
        type: createMatch[1].toUpperCase(),
        objectType: createMatch[2].toUpperCase(),
        name: createMatch[3],
        line: i + 1,
        content: line
      });
      continue;
    }

    // Column operations
    const columnMatch = line.match(/(ADD|DROP)\s+COLUMN\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?(\w+)["`]?/i);
    if (columnMatch) {
      // Try to find table name from context
      let tableName = 'unknown';
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j].trim();
        const tableMatch = prevLine.match(/ALTER\s+TABLE\s+(?:ONLY\s+)?["`]?(\w+)["`]?/i);
        if (tableMatch) {
          tableName = tableMatch[1];
          break;
        }
      }
      operations.push({
        type: columnMatch[1].toUpperCase(),
        objectType: 'COLUMN',
        name: `${tableName}.${columnMatch[2]}`,
        line: i + 1,
        content: line
      });
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