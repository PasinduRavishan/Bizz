#!/usr/bin/env node
/**
 * Build script to generate .deploy.js files from TypeScript sources
 *
 * Bitcoin Computer requires pure JavaScript files without imports for deployment.
 * This script compiles TypeScript and removes:
 * 1. Import statements
 * 2. Property declarations (TypeScript compiled output)
 * 3. Comments and source map references
 * to create deployment-ready files in the deploy/ folder.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contractsDir = join(__dirname, '..');
const distDir = join(contractsDir, 'dist');
const deployDir = join(contractsDir, 'deploy');

// Ensure deploy directory exists
mkdirSync(deployDir, { recursive: true });

// List of contract files to process
const contracts = ['Quiz', 'QuizAttempt', 'PrizeSwap', 'Payment', 'AnswerProof', 'SeatToken', 'SeatAccess', 'SeatRedemption'];

console.log('🔨 Building deployment files from TypeScript sources...\n');

contracts.forEach(contractName => {
  try {
    // Read the compiled JavaScript from dist/
    const distPath = join(distDir, `${contractName}.js`);
    let content = readFileSync(distPath, 'utf-8');

    // Remove all import statements
    content = content.replace(/^\s*import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');

    // Remove source map comments
    content = content.replace(/^\/\/# sourceMappingURL=.*$/gm, '');

    // Remove @ts-expect-error comments
    content = content.replace(/^\s*\/\/\s*@ts-expect-error.*$/gm, '');

    // Remove TypeScript version comments
    content = content.replace(/^\s*\/\/\s*TypeScript version.*$/gm, '');
    content = content.replace(/^\s*\/\/\s*Bitcoin Computer requires.*$/gm, '');
    content = content.replace(/^\s*\/\/\s*For deployment.*$/gm, '');

    // CRITICAL: Remove property declarations inside classes
    // These are lines like: "    _id;" or "    teacher;" (with indentation)
    // But NOT lines like: "this._id = ..." (assignments)
    // Pattern: whitespace + identifier + semicolon + end of line
    content = content.replace(/^(\s+)([a-zA-Z_$][a-zA-Z0-9_$]*);$/gm, '');

    // Remove comment lines (but keep comments inside code)
    content = content.replace(/^\s*\/\/.*$/gm, '');

    // Remove multiple consecutive empty lines
    content = content.replace(/\n\n+/g, '\n\n');

    // Remove empty lines at the beginning
    content = content.replace(/^\s*\n/gm, '');

    // Add header comment
    const header = `// Deployment-ready ${contractName} contract (no imports, Contract is available in Bitcoin Computer context)\n// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY\n// Edit the TypeScript file in src/${contractName}.ts instead\n\n`;

    content = header + content;

    // Write to deploy/ folder with .deploy.js extension
    const deployPath = join(deployDir, `${contractName}.deploy.js`);
    writeFileSync(deployPath, content, 'utf-8');

    console.log(`✅ ${contractName}.deploy.js`);
  } catch (error) {
    console.error(`❌ Failed to process ${contractName}:`, error.message);
    process.exit(1);
  }
});

console.log('\n✨ All deployment files generated successfully!');
console.log(`📁 Location: ${deployDir}\n`);
