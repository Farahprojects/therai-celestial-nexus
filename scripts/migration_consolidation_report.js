#!/usr/bin/env node

import { loadMigrations, inferFeature } from './lib/migration-utils.js';

/**
 * Simple Migration Consolidation Report
 * Provides actionable insights for reducing 139 migration files
 */

class ConsolidationReporter {
  constructor() {
    this.migrations = [];
  }

  loadMigrations() {
    this.migrations = loadMigrations({ includeMetadata: true });
  }

  analyzePatterns() {
    console.log('🔍 PATTERNS IDENTIFIED:\n');

    // 1. Same-day migrations
    const sameDayGroups = this.groupByDay();
    console.log('📅 SAME-DAY MIGRATIONS:');
    console.log(`   Groups found: ${sameDayGroups.length}`);
    sameDayGroups.forEach(group => {
      if (group.length > 1) {
        const totalLines = group.reduce((sum, m) => sum + m.lines, 0);
        console.log(`   ${group[0].file.substring(0, 8)}: ${group.length} files (${totalLines} lines)`);
      }
    });

    // 2. Fix migrations
    const fixMigrations = this.migrations.filter(m =>
      m.file.toLowerCase().includes('fix') ||
      m.file.toLowerCase().includes('update') ||
      m.file.toLowerCase().includes('cleanup')
    );
    console.log(`\n🔧 FIX MIGRATIONS: ${fixMigrations.length}`);
    console.log('   These often fix issues from recent migrations');

    // 3. Large migrations
    const largeMigrations = this.migrations.filter(m => m.lines > 200);
    console.log(`\n📏 LARGE MIGRATIONS (>200 lines): ${largeMigrations.length}`);
    largeMigrations.slice(0, 5).forEach(m => {
      console.log(`   ${m.file}: ${m.lines} lines`);
    });

    // 4. Feature-based grouping
    const featureGroups = this.groupByFeature();
    console.log('\n🎯 FEATURE GROUPING:');
    Object.entries(featureGroups)
      .filter(([_, migrations]) => migrations.length > 3)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([feature, migrations]) => {
        console.log(`   ${feature}: ${migrations.length} migrations`);
      });
  }

  groupByDay() {
    const groups = new Map();
    this.migrations.forEach(migration => {
      const day = migration.file.substring(0, 8);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(migration);
    });
    return Array.from(groups.values()).filter(group => group.length > 1);
  }

  groupByFeature() {
    const features = {};
    this.migrations.forEach(migration => {
      const feature = inferFeature(migration.file);
      if (!features[feature]) features[feature] = [];
      features[feature].push(migration);
    });
    return features;
  }


  generateRecommendations() {
    console.log('\n💡 CONSOLIDATION RECOMMENDATIONS:\n');

    const sameDayGroups = this.groupByDay();
    const fixMigrations = this.migrations.filter(m =>
      m.file.toLowerCase().includes('fix') ||
      m.file.toLowerCase().includes('update') ||
      m.file.toLowerCase().includes('cleanup')
    );
    const largeMigrations = this.migrations.filter(m => m.lines > 200);

    console.log('1. 📅 SAME-DAY CONSOLIDATION:');
    console.log(`   - ${sameDayGroups.length} groups of same-day migrations`);
    console.log('   - Merge into single files per day');
    console.log(`   - Potential reduction: ${sameDayGroups.reduce((sum, group) => sum + group.length - 1, 0)} files`);

    console.log('\n2. 🔧 FIX MIGRATION CONSOLIDATION:');
    console.log(`   - ${fixMigrations.length} fix/update/cleanup migrations`);
    console.log('   - Merge with their parent feature migrations');
    console.log('   - Review if fixes are still needed');

    console.log('\n3. 📏 LARGE MIGRATION BREAKDOWN:');
    console.log(`   - ${largeMigrations.length} migrations over 200 lines`);
    console.log('   - Split into logical sub-migrations');
    console.log('   - Or keep as comprehensive feature migrations');

    console.log('\n4. 🎯 FEATURE-BASED GROUPING:');
    const featureGroups = this.groupByFeature();
    const largeFeatures = Object.entries(featureGroups)
      .filter(([_, migrations]) => migrations.length > 5)
      .sort((a, b) => b[1].length - a[1].length);

    largeFeatures.forEach(([feature, migrations]) => {
      console.log(`   - ${feature}: ${migrations.length} migrations → consolidate into ${Math.ceil(migrations.length / 3)} files`);
    });

    const totalReduction = sameDayGroups.reduce((sum, group) => sum + group.length - 1, 0) +
                          Math.floor(fixMigrations.length * 0.7) +
                          Math.floor(largeFeatures.reduce((sum, [_, m]) => sum + m.length, 0) * 0.6);

    console.log(`\n📊 ESTIMATED REDUCTION: ${totalReduction} files (${Math.round(totalReduction / this.migrations.length * 100)}%)`);
    console.log(`   New total: ${this.migrations.length - totalReduction} migration files`);
  }

  identifySpecificRedundancies() {
    console.log('\n🔍 SPECIFIC REDUNDANCY PATTERNS:\n');

    // Look for DROP POLICY followed by CREATE POLICY patterns
    const policyChanges = [];
    this.migrations.forEach(migration => {
      const content = migration.content.toLowerCase();
      const drops = (content.match(/drop policy/g) || []).length;
      const creates = (content.match(/create policy/g) || []).length;

      if (drops > 0 && creates > 0) {
        policyChanges.push({
          file: migration.file,
          drops,
          creates,
          lines: migration.lines
        });
      }
    });

    console.log(`POLICY RECREATION PATTERNS: ${policyChanges.length} migrations`);
    policyChanges.slice(0, 5).forEach(p => {
      console.log(`   ${p.file}: ${p.drops} drops, ${p.creates} creates (${p.lines} lines)`);
    });

    // Look for folder-related fixes (we know this was an issue)
    const folderFixes = this.migrations.filter(m =>
      m.file.toLowerCase().includes('folder') &&
      (m.file.toLowerCase().includes('fix') || m.file.toLowerCase().includes('update'))
    );

    console.log(`\nFOLDER-SHARING FIXES: ${folderFixes.length} migrations`);
    console.log('   (This indicates iterative development that could be consolidated)');
  }
}

// Run the report
const reporter = new ConsolidationReporter();
reporter.loadMigrations();
reporter.analyzePatterns();
reporter.identifySpecificRedundancies();
reporter.generateRecommendations();

console.log('\n=== REPORT COMPLETE ===');
console.log('Next steps:');
console.log('1. Review same-day migrations for consolidation');
console.log('2. Audit fix migrations to see if still needed');
console.log('3. Consider feature-based migration bundling');
