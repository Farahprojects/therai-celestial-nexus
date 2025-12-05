#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration Redundancy Analyzer
 * Identifies redundant operations across migration files
 */

class MigrationAnalyzer {
  constructor() {
    this.migrations = [];
    this.operations = {
      policys: new Map(), // policy_name -> [{migration, operation, content}]
      indexs: new Map(),  // index_name -> [{migration, operation, content}]
      columns: new Map(),  // table.column -> [{migration, operation, content}]
      tables: new Map(),   // table_name -> [{migration, operation, content}]
      functions: new Map(), // function_name -> [{migration, operation, content}]
      triggers: new Map(), // trigger_name -> [{migration, operation, content}]
    };
  }

  loadMigrations() {
    const migrationDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Loading ${files.length} migration files...`);

    for (const file of files) {
      const filePath = path.join(migrationDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const migration = {
        file,
        content,
        operations: this.parseOperations(content)
      };
      this.migrations.push(migration);
    }
  }

  parseOperations(content) {
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

  analyzeRedundancies() {
    console.log('\n=== ANALYZING REDUNDANCIES ===\n');

    // Track operations by object
    for (const migration of this.migrations) {
      for (const op of migration.operations) {
        const key = `${op.objectType}:${op.name}`;
        const mapKey = op.objectType.toLowerCase() + 's';
        if (!this.operations[mapKey]) {
          console.log(`Warning: Unknown object type ${mapKey} for operation ${op.type} ${op.objectType}`);
          continue;
        }
        if (!this.operations[mapKey].has(key)) {
          this.operations[mapKey].set(key, []);
        }
        this.operations[mapKey].get(key).push({
          migration: migration.file,
          operation: op.type,
          line: op.line,
          content: op.content
        });
      }
    }

    this.analyzePolicyRedundancies();
    this.analyzeIndexRedundancies();
    this.analyzeColumnRedundancies();
    this.analyzeFunctionRedundancies();
    this.analyzeConsolidationOpportunities();
  }

  analyzePolicyRedundancies() {
    console.log('🔍 POLICY REDUNDANCIES:');
    let redundantPolicies = 0;

    for (const [policyKey, operations] of this.operations.policies) {
      if (operations.length > 1) {
        const createOps = operations.filter(op => op.operation === 'CREATE');
        const dropOps = operations.filter(op => op.operation === 'DROP');

        if (createOps.length > 1) {
          console.log(`  ⚠️  ${policyKey}: Created ${createOps.length} times`);
          createOps.forEach(op => console.log(`     ${op.migration}:${op.line}`));
          redundantPolicies++;
        }

        if (dropOps.length > 0 && createOps.length > 0) {
          console.log(`  🔄 ${policyKey}: Drop-Create cycle (${dropOps.length} drops, ${createOps.length} creates)`);
          redundantPolicies++;
        }
      }
    }

    console.log(`  📊 Total redundant policy patterns: ${redundantPolicies}\n`);
  }

  analyzeIndexRedundancies() {
    console.log('🔍 INDEX REDUNDANCIES:');
    let redundantIndexes = 0;

    for (const [indexKey, operations] of this.operations.indexes) {
      if (operations.length > 1) {
        const createOps = operations.filter(op => op.operation === 'CREATE');
        const dropOps = operations.filter(op => op.operation === 'DROP');

        if (createOps.length > 1) {
          console.log(`  ⚠️  ${indexKey}: Created ${createOps.length} times`);
          createOps.forEach(op => console.log(`     ${op.migration}:${op.line}`));
          redundantIndexes++;
        }

        if (dropOps.length > 0 && createOps.length > 0) {
          console.log(`  🔄 ${indexKey}: Drop-Create cycle (${dropOps.length} drops, ${createOps.length} creates)`);
          redundantIndexes++;
        }
      }
    }

    console.log(`  📊 Total redundant index patterns: ${redundantIndexes}\n`);
  }

  analyzeColumnRedundancies() {
    console.log('🔍 COLUMN REDUNDANCIES:');
    let redundantColumns = 0;

    for (const [columnKey, operations] of this.operations.columns) {
      if (operations.length > 1) {
        const addOps = operations.filter(op => op.operation === 'ADD');
        const dropOps = operations.filter(op => op.operation === 'DROP');

        if (addOps.length > 1) {
          console.log(`  ⚠️  ${columnKey}: Added ${addOps.length} times`);
          addOps.forEach(op => console.log(`     ${op.migration}:${op.line}`));
          redundantColumns++;
        }

        if (dropOps.length > 0 && addOps.length > 0) {
          console.log(`  🔄 ${columnKey}: Drop-Add cycle (${dropOps.length} drops, ${addOps.length} adds)`);
          redundantColumns++;
        }
      }
    }

    console.log(`  📊 Total redundant column patterns: ${redundantColumns}\n`);
  }

  analyzeFunctionRedundancies() {
    console.log('🔍 FUNCTION REDUNDANCIES:');
    let redundantFunctions = 0;

    for (const [functionKey, operations] of this.operations.functions) {
      if (operations.length > 1) {
        const createOps = operations.filter(op => op.operation === 'CREATE');
        const dropOps = operations.filter(op => op.operation === 'DROP');

        if (createOps.length > 1) {
          console.log(`  ⚠️  ${functionKey}: Created ${createOps.length} times`);
          createOps.forEach(op => console.log(`     ${op.migration}:${op.line}`));
          redundantFunctions++;
        }
      }
    }

    console.log(`  📊 Total redundant function patterns: ${redundantFunctions}\n`);
  }

  analyzeConsolidationOpportunities() {
    console.log('🔍 CONSOLIDATION OPPORTUNITIES:');

    // Group migrations by month/feature
    const byMonth = new Map();
    const byFeature = new Map();

    for (const migration of this.migrations) {
      const month = migration.file.substring(0, 6); // YYYYMM
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(migration);

      // Try to infer feature from filename
      const feature = this.inferFeature(migration.file);
      if (!byFeature.has(feature)) byFeature.set(feature, []);
      byFeature.get(feature).push(migration);
    }

    console.log('  📅 Migrations by month:');
    for (const [month, migrations] of byMonth) {
      if (migrations.length > 3) {
        console.log(`     ${month}: ${migrations.length} migrations (consider consolidation)`);
      }
    }

    console.log('\n  🎯 Migrations by feature area:');
    for (const [feature, migrations] of byFeature) {
      if (migrations.length > 5) {
        console.log(`     ${feature}: ${migrations.length} migrations`);
      }
    }

    console.log('\n  🔧 Large migrations (>200 lines):');
    for (const migration of this.migrations) {
      const lines = migration.content.split('\n').length;
      if (lines > 200) {
        console.log(`     ${migration.file}: ${lines} lines`);
      }
    }
  }

  inferFeature(filename) {
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

  generateConsolidationPlan() {
    console.log('\n=== CONSOLIDATION PLAN ===\n');

    // Find migrations that are likely fixes
    const fixMigrations = this.migrations.filter(m =>
      m.file.toLowerCase().includes('fix') ||
      m.file.toLowerCase().includes('update') ||
      m.file.toLowerCase().includes('cleanup')
    );

    console.log(`🔧 Potential fix migrations to consolidate: ${fixMigrations.length}`);
    if (fixMigrations.length > 0) {
      console.log('   These could be merged with their parent features:');
      fixMigrations.slice(0, 10).forEach(m => console.log(`     ${m.file}`));
      if (fixMigrations.length > 10) console.log(`     ... and ${fixMigrations.length - 10} more`);
    }

    // Find same-day migrations
    const sameDayGroups = new Map();
    for (const migration of this.migrations) {
      const day = migration.file.substring(0, 8); // YYYYMMDD
      if (!sameDayGroups.has(day)) sameDayGroups.set(day, []);
      sameDayGroups.get(day).push(migration);
    }

    const multiDayMigrations = Array.from(sameDayGroups.values()).filter(group => group.length > 1);
    console.log(`\n📅 Same-day migration groups: ${multiDayGroups.length}`);
    multiDayMigrations.forEach(group => {
      if (group.length > 1) {
        console.log(`   ${group[0].file.substring(0, 8)}: ${group.length} migrations`);
      }
    });

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   1. Consolidate same-day migrations into single files');
    console.log('   2. Merge fix migrations with their parent features');
    console.log('   3. Group by feature domain for better organization');
    console.log('   4. Create consolidated schema dumps for major features');
  }
}

// Run the analysis
const analyzer = new MigrationAnalyzer();
analyzer.loadMigrations();
analyzer.analyzeRedundancies();
analyzer.generateConsolidationPlan();

console.log('\n=== ANALYSIS COMPLETE ===');
console.log('Run this script again after any consolidation to verify improvements.');
