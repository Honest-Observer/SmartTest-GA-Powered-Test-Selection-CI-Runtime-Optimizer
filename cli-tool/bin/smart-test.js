#!/usr/bin/env node

/**
 * smart-test CLI — Federated Genetic Algorithm Test Impact Analysis
 * 
 * Commands:
 *   smart-test init <API_KEY>     Initialize and run Cold Start baseline
 *   smart-test run                Optimize and run affected tests
 *   smart-test status             Check connection and baseline status
 *   smart-test config             Show current configuration
 *   smart-test help               Show help information
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

import { initCommand } from '../src/init.js';
import { runCommand } from '../src/run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration file locations
const GLOBAL_CONFIG_DIR = join(process.env.HOME || process.env.USERPROFILE || '.', '.smart-test');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'config.json');

function getLocalConfigPath() {
  return join(process.cwd(), '.smart-test', 'config.json');
}

// ASCII art banner
const BANNER = `
╔══════════════════════════════════════════════════╗
║  🧬 smart-test — GA Test Impact Analysis v1.0   ║
║  ─────────────────────────────────────────────   ║
║  Optimize your CI pipeline with genetic algos    ║
╚══════════════════════════════════════════════════╝
`;

const HELP = `
Usage: smart-test <command> [options]

Commands:
  init <API_KEY>    Initialize smart-test with your API key
                    and generate baseline coverage map (Cold Start)

  run               Analyze code changes and run optimized test subset
                    Uses git diff to find changed lines, sends to backend
                    GA optimizer, and runs only the necessary tests

  status            Check backend connection and baseline status

  config            Show current configuration

  help              Show this help message

Options:
  --server <url>    Override backend server URL
                    (default: http://localhost:3001)
  --branch <name>   Override base branch for git diff
                    (default: main)
  --framework <fw>  Override test framework detection
                    (jest, mocha, pytest, vitest)
  --cmd <command>   Override the default test command
                    (e.g., --cmd "npm run test:unit")
  --verbose         Enable verbose logging

Examples:
  $ smart-test init tia_a3f8c2d1e5b7...
  $ smart-test run
  $ smart-test run --branch develop --verbose
  $ smart-test status
`;

/**
 * Load or create configuration
 */
function loadConfig() {
  let config = {};
  
  if (existsSync(GLOBAL_CONFIG_FILE)) {
    try {
      config = { ...JSON.parse(readFileSync(GLOBAL_CONFIG_FILE, 'utf-8')) };
    } catch (e) {}
  }
  
  const localConfigPath = getLocalConfigPath();
  if (existsSync(localConfigPath)) {
    try {
      const local = JSON.parse(readFileSync(localConfigPath, 'utf-8'));
      config = { ...config, ...local };
    } catch (e) {}
  }
  
  return config;
}

function saveConfig(config) {
  // Save API key globally
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
  let globalConfig = {};
  if (existsSync(GLOBAL_CONFIG_FILE)) {
    try { globalConfig = JSON.parse(readFileSync(GLOBAL_CONFIG_FILE, 'utf-8')); } catch (e) {}
  }
  globalConfig.apiKey = config.apiKey || globalConfig.apiKey;
  writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(globalConfig, null, 2));

  // Save repo-specific config locally
  const localConfigPath = getLocalConfigPath();
  const localConfigDir = dirname(localConfigPath);
  if (!existsSync(localConfigDir)) {
    mkdirSync(localConfigDir, { recursive: true });
  }
  
  const localConfig = { ...config };
  delete localConfig.apiKey; // don't commit api key to local repo folder
  
  writeFileSync(localConfigPath, JSON.stringify(localConfig, null, 2));
}

/**
 * Detect test framework from project configuration files
 */
function detectFramework() {
  const cwd = process.cwd();

  if (existsSync(join(cwd, 'jest.config.js')) || existsSync(join(cwd, 'jest.config.ts'))) {
    return 'jest';
  }

  // Check package.json for jest config
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.jest || pkg.scripts?.test?.includes('jest')) return 'jest';
      if (pkg.scripts?.test?.includes('vitest')) return 'vitest';
      if (pkg.scripts?.test?.includes('mocha')) return 'mocha';
    } catch { /* ignore */ }
  }

  if (existsSync(join(cwd, 'vitest.config.js')) || existsSync(join(cwd, 'vitest.config.ts'))) {
    return 'vitest';
  }
  if (existsSync(join(cwd, '.mocharc.yml')) || existsSync(join(cwd, '.mocharc.json'))) {
    return 'mocha';
  }
  if (existsSync(join(cwd, 'pytest.ini')) || existsSync(join(cwd, 'setup.cfg'))) {
    return 'pytest';
  }

  return 'jest'; // default
}

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
  const parsed = {
    command: args[0],
    positional: [],
    flags: {},
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      // Check if next arg is a value (not a flag)
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed.flags[key] = args[i + 1];
        i++;
      } else {
        parsed.flags[key] = true;
      }
    } else {
      parsed.positional.push(args[i]);
    }
  }

  return parsed;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    console.log(BANNER);
    console.log(HELP);
    process.exit(0);
  }

  const parsed = parseArgs(args);
  const config = loadConfig();
  const verbose = parsed.flags.verbose || false;

  // Override config with CLI flags
  const serverUrl = parsed.flags.server || config.serverUrl || 'http://localhost:3001';
  const baseBranch = parsed.flags.branch || config.baseBranch || 'main';
  const framework = parsed.flags.framework || config.framework || detectFramework();
  const testCommandOverride = parsed.flags.cmd || config.testCommand || null;

  const context = {
    config,
    saveConfig,
    serverUrl,
    baseBranch,
    framework,
    testCommandOverride,
    verbose,
    cwd: process.cwd(),
  };

  switch (parsed.command) {
    case 'init': {
      const apiKey = parsed.positional[0];
      if (!apiKey) {
        console.error('\n❌ Error: API key is required.');
        console.error('   Usage: smart-test init <API_KEY>\n');
        console.error('   Get your API key from the TIA Optimizer Dashboard.\n');
        process.exit(1);
      }
      console.log(BANNER);
      await initCommand(apiKey, context);
      break;
    }

    case 'run': {
      if (!config.apiKey) {
        console.error('\n❌ Error: Not initialized. Run `smart-test init <API_KEY>` first.\n');
        process.exit(1);
      }
      await runCommand(context);
      break;
    }

    case 'status': {
      console.log(BANNER);
      console.log('  Configuration:');
      console.log(`    API Key:     ${config.apiKey ? config.apiKey.substring(0, 12) + '...' : 'Not set'}`);
      console.log(`    Server:      ${serverUrl}`);
      console.log(`    Framework:   ${framework}`);
      console.log(`    Base Branch: ${baseBranch}`);
      console.log(`    Repo ID:     ${config.repoId || 'Not set'}`);
      console.log(`    Baseline:    ${config.baselineHash ? '✅ Present' : '❌ Missing'}`);
      console.log();

      // Check server connection
      try {
        const response = await fetch(`${serverUrl}/api/v1/health`);
        const data = await response.json();
        console.log(`  Server Status: ✅ ${data.status} (uptime: ${data.uptime}s)`);
      } catch {
        console.log('  Server Status: ❌ Unreachable');
      }
      console.log();
      break;
    }

    case 'config': {
      console.log(BANNER);
      console.log('  Current Configuration:\n');
      console.log(JSON.stringify(config, null, 2));
      console.log(`\n  Global config: ${GLOBAL_CONFIG_FILE}`);
      console.log(`  Local config:  ${getLocalConfigPath()}\n`);
      break;
    }

    default:
      console.error(`\n❌ Unknown command: ${parsed.command}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  if (process.env.DEBUG) console.error(error.stack);
  process.exit(1);
});
