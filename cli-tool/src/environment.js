import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Automatically detects the test command from package.json
 * @param {string} cwd - The current working directory
 * @returns {string|null} - The test command (e.g., 'jest', 'react-scripts test', etc.) or null
 */
export function detectTestCommand(cwd) {
  try {
    const pkgPath = join(cwd, 'package.json');
    if (!existsSync(pkgPath)) return null;

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts || !pkg.scripts.test) return null;

    let cmd = pkg.scripts.test;

    // A robust way to invoke a test script with dynamic arguments is to use `npx`
    // with the actual command found in the package.json, OR to parse out environment
    // variables. But simply `npm test --` works universally across npm!
    // However, if the command uses something that does not accept appended arguments
    // (e.g., if they do `jest && eslint`), appending `--coverage` will fail.
    
    // For our GA tool, we need to extract the underlying framework execution.
    if (cmd.includes('react-scripts test')) {
      // CRA interactive by default. Needs CI=true
      return 'cross-env CI=true npm test';
    }
    
    // Default fallback, try to execute the raw script
    return 'npm test';
  } catch (error) {
    return null;
  }
}
