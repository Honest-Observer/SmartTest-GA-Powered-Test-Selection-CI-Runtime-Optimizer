/**
 * Git Diff Parser
 * 
 * Executes `git diff` and parses the unified diff format
 * to extract modified file paths and specific line numbers.
 */

import { execSync } from 'node:child_process';

/**
 * Extract modified files and line numbers from git diff.
 * 
 * @param {string} baseBranch - Base branch to diff against (e.g., 'main')
 * @param {string} cwd - Working directory (repository root)
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Map<string, number[]>} Map of filePath -> modified line numbers
 */
export function parseGitDiff(baseBranch = 'main', cwd = process.cwd(), verbose = false) {
  const diffMatrix = new Map();

  // Try multiple diff strategies
  let diffOutput = '';

  try {
    // Strategy 1: Diff against base branch
    diffOutput = execSync(`git diff ${baseBranch}...HEAD`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    try {
      // Strategy 2: Diff against base branch (simpler form)
      diffOutput = execSync(`git diff ${baseBranch}`, {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch {
      try {
        // Strategy 3: Diff of unstaged changes
        diffOutput = execSync('git diff', {
          cwd,
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
      } catch {
        // Strategy 4: Diff of staged changes
        diffOutput = execSync('git diff --cached', {
          cwd,
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
      }
    }
  }

  if (!diffOutput.trim()) {
    // Also check for staged changes if no unstaged changes found
    try {
      const stagedDiff = execSync('git diff --cached', {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      if (stagedDiff.trim()) {
        diffOutput = stagedDiff;
      }
    } catch { /* ignore */ }
  }

  if (!diffOutput.trim()) {
    if (verbose) console.log('  ℹ️  No changes detected in git diff');
    return diffMatrix;
  }

  // Parse unified diff format
  // File headers:  diff --git a/path/to/file b/path/to/file
  // Chunk headers: @@ -oldStart,oldCount +newStart,newCount @@
  // Added lines:   + content
  // Removed lines: - content

  const FILE_HEADER_REGEX = /^diff --git a\/(.+?) b\/(.+)$/;
  const CHUNK_HEADER_REGEX = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

  const lines = diffOutput.split('\n');
  let currentFile = null;
  let currentLineNum = 0;

  for (const line of lines) {
    // Check for new file header
    const fileMatch = line.match(FILE_HEADER_REGEX);
    if (fileMatch) {
      currentFile = fileMatch[2]; // Use the 'b' path (new file path)

      // Skip non-source files
      if (isIgnoredFile(currentFile)) {
        currentFile = null;
        continue;
      }

      if (!diffMatrix.has(currentFile)) {
        diffMatrix.set(currentFile, []);
      }
      continue;
    }

    // Check for chunk header
    const chunkMatch = line.match(CHUNK_HEADER_REGEX);
    if (chunkMatch && currentFile) {
      currentLineNum = parseInt(chunkMatch[1], 10);
      continue;
    }

    // Track line numbers for added/modified lines
    if (currentFile && currentLineNum > 0) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // Added or modified line
        diffMatrix.get(currentFile).push(currentLineNum);
        currentLineNum++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        // Removed line — don't increment newLineNum
        // (removed lines don't exist in the new file)
      } else if (!line.startsWith('\\')) {
        // Context line (unchanged)
        currentLineNum++;
      }
    }
  }

  // Remove empty entries
  for (const [file, lines] of diffMatrix) {
    if (lines.length === 0) {
      diffMatrix.delete(file);
    }
  }

  if (verbose) {
    console.log(`  📊 Diff analysis:`);
    console.log(`     Files changed: ${diffMatrix.size}`);
    let totalLines = 0;
    for (const [file, lines] of diffMatrix) {
      totalLines += lines.length;
      console.log(`     • ${file}: ${lines.length} lines modified`);
    }
    console.log(`     Total lines modified: ${totalLines}`);
  }

  return diffMatrix;
}

/**
 * Check if a file should be ignored in diff analysis
 */
function isIgnoredFile(filePath) {
  const ignoredPatterns = [
    /\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /\.min\.(js|css)$/,
    /\.map$/,
    /\.d\.ts$/,
    /node_modules\//,
    /dist\//,
    /build\//,
    /coverage\//,
    /\.git\//,
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
    /\.env/,
    /README\.md$/i,
    /CHANGELOG\.md$/i,
    /LICENSE/i,
  ];

  return ignoredPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Get summary of diff for telemetry
 */
export function getDiffSummary(diffMatrix) {
  let totalLines = 0;
  for (const lines of diffMatrix.values()) {
    totalLines += lines.length;
  }

  return {
    filesChanged: diffMatrix.size,
    linesChanged: totalLines,
    files: Array.from(diffMatrix.keys()),
  };
}
