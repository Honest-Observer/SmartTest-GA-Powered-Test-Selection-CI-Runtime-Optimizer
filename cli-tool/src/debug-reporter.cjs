class CustomReporter {
  onTestResult(test, testResult) {
    if (test.path.includes('order.test.js')) {
      require('fs').writeFileSync('debug-cov.json', JSON.stringify(testResult.coverage));
    }
  }
}
module.exports = CustomReporter;
