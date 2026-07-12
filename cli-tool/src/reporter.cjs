/**
 * Custom Jest Reporter for smart-test TIA (CommonJS)
 * 
 * Captures the exact line-by-line coverage for each individual test file.
 * This is executed in the Jest runner process during `smart-test init`.
 */

const fs = require('fs');
const path = require('path');

class SmartTestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.coverageMap = {};
  }

  onTestResult(test, testResult, aggregatedResult) {
    const testPath = test.path;
    // Make test path relative to the root directory
    const testRelative = path.relative(this._globalConfig.rootDir, testPath).replace(/\\/g, '/');

    if (testResult.coverage) {
      const coveredFiles = {};
      
      for (const [sourcePath, fileCoverage] of Object.entries(testResult.coverage)) {
        const sourceRelative = path.relative(this._globalConfig.rootDir, sourcePath).replace(/\\/g, '/');

        // Skip node_modules or files outside of root
        if (sourceRelative.startsWith('..') || sourceRelative.includes('node_modules')) {
          continue;
        }
        const linesSet = new Set();
        
        // 1. Find all lines that belong to unexecuted functions
        const unexecutedFunctionLines = new Set();
        if (fileCoverage.f && fileCoverage.fnMap) {
          for (const [fnId, count] of Object.entries(fileCoverage.f)) {
            if (count === 0 && fileCoverage.fnMap[fnId]) {
              const fn = fileCoverage.fnMap[fnId];
              const startLine = fn.loc ? fn.loc.start.line : (fn.decl ? fn.decl.start.line : null);
              const endLine = fn.loc ? fn.loc.end.line : (fn.decl ? fn.decl.end.line : null);
              if (startLine !== null && endLine !== null) {
                for (let line = startLine; line <= endLine; line++) {
                  unexecutedFunctionLines.add(line);
                }
              }
            }
          }
        }

        // 2. Add executed statements, but filter out lines that belong to unexecuted functions
        if (fileCoverage.s) {
          for (const [stmtId, count] of Object.entries(fileCoverage.s)) {
            if (count > 0 && fileCoverage.statementMap[stmtId]) {
              const stmt = fileCoverage.statementMap[stmtId];
              for (let line = stmt.start.line; line <= stmt.end.line; line++) {
                if (!unexecutedFunctionLines.has(line)) {
                  linesSet.add(line);
                }
              }
            }
          }
        }
        
        const lines = Array.from(linesSet);

        if (lines.length > 0) {
          coveredFiles[sourceRelative] = lines.sort((a, b) => a - b);
        }
      }

      this.coverageMap[testRelative] = {
        coveredFiles,
        estimatedTime: parseFloat((testResult.perfStats.runtime / 1000).toFixed(2)) || 1.0,
      };
    }
  }

  onRunComplete(contexts, results) {
    const outputDir = path.join(this._globalConfig.rootDir, '.smart-test');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(outputDir, 'coverage-map-raw.json'),
      JSON.stringify(this.coverageMap, null, 2)
    );
  }
}

module.exports = SmartTestReporter;
