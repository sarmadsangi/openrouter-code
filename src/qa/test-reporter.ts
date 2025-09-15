import * as fs from 'fs';
import * as path from 'path';
import { QAResult, TestCaseResult } from './qa-agent';

export interface ReportOptions {
  format: 'console' | 'html' | 'json';
  outputPath?: string;
  includeScreenshots?: boolean;
}

export class TestReporter {
  async generateReport(qaResult: QAResult, options: ReportOptions): Promise<string> {
    switch (options.format) {
      case 'html':
        return await this.generateHTMLReport(qaResult, options);
      case 'json':
        return await this.generateJSONReport(qaResult, options);
      case 'console':
      default:
        return this.generateConsoleReport(qaResult);
    }
  }

  private generateConsoleReport(qaResult: QAResult): string {
    let report = `\\n🧪 QA Validation Report\\n`;
    report += `${'='.repeat(50)}\\n`;
    report += `Status: ${qaResult.success ? '✅ PASSED' : '❌ FAILED'}\\n`;
    report += `Tests Run: ${qaResult.testsRun}\\n`;
    report += `Tests Passed: ${qaResult.testsPassed}\\n`;
    report += `Tests Failed: ${qaResult.testsFailed}\\n`;
    report += `\\n`;

    // Test Results
    report += `📋 Test Results:\\n`;
    qaResult.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      report += `${index + 1}. ${status} ${result.testCase.name} (${result.duration}ms)\\n`;
      
      if (!result.success) {
        report += `   Error: ${result.error}\\n`;
      }
      
      // Show failed steps
      const failedSteps = result.steps.filter(s => !s.success);
      if (failedSteps.length > 0) {
        report += `   Failed Steps:\\n`;
        failedSteps.forEach(step => {
          report += `   - ${step.step.description}: ${step.error}\\n`;
        });
      }
    });

    // Recommendations
    if (qaResult.recommendations && qaResult.recommendations.length > 0) {
      report += `\\n💡 Recommendations:\\n`;
      qaResult.recommendations.forEach(rec => {
        report += `- ${rec}\\n`;
      });
    }

    report += `\\n📝 Summary:\\n${qaResult.summary}`;
    
    return report;
  }

  private async generateHTMLReport(qaResult: QAResult, options: ReportOptions): Promise<string> {
    const timestamp = new Date().toISOString();
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QA Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .test-result { margin: 15px 0; padding: 15px; border-radius: 6px; border-left: 4px solid; }
        .test-passed { background: #d4edda; border-color: #28a745; }
        .test-failed { background: #f8d7da; border-color: #dc3545; }
        .test-steps { margin-top: 10px; }
        .step { margin: 5px 0; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; }
        .step-failed { background: rgba(220,53,69,0.1); }
        .screenshot { max-width: 300px; margin: 10px 0; border-radius: 4px; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 QA Validation Report</h1>
            <p>Generated on ${timestamp}</p>
            <h2 class="${qaResult.success ? 'status-passed' : 'status-failed'}">
                ${qaResult.success ? '✅ All Tests Passed' : '❌ Some Tests Failed'}
            </h2>
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>Tests Run</h3>
                <p style="font-size: 2em; margin: 0;">${qaResult.testsRun}</p>
            </div>
            <div class="stat-card">
                <h3>Tests Passed</h3>
                <p style="font-size: 2em; margin: 0; color: #28a745;">${qaResult.testsPassed}</p>
            </div>
            <div class="stat-card">
                <h3>Tests Failed</h3>
                <p style="font-size: 2em; margin: 0; color: #dc3545;">${qaResult.testsFailed}</p>
            </div>
        </div>`;

    // Test Results
    html += `<h2>📋 Test Results</h2>`;
    
    qaResult.testResults.forEach((result, index) => {
      const cssClass = result.success ? 'test-passed' : 'test-failed';
      const statusIcon = result.success ? '✅' : '❌';
      
      html += `<div class="test-result ${cssClass}">
        <h3>${statusIcon} ${result.testCase.name} (${result.duration}ms)</h3>
        <p><strong>Description:</strong> ${result.testCase.description}</p>`;
      
      if (result.error) {
        html += `<p><strong>Error:</strong> ${result.error}</p>`;
      }
      
      // Show test steps
      html += `<div class="test-steps">
        <h4>Test Steps:</h4>`;
      
      result.steps.forEach(step => {
        const stepClass = step.success ? '' : 'step-failed';
        const stepIcon = step.success ? '✅' : '❌';
        html += `<div class="step ${stepClass}">
          ${stepIcon} ${step.step.description} (${step.duration}ms)
          ${step.error ? `<br><em>Error: ${step.error}</em>` : ''}
        </div>`;
      });
      
      html += `</div>`;
      
      // Screenshots
      if (options.includeScreenshots && result.screenshots.length > 0) {
        html += `<h4>Screenshots:</h4>`;
        result.screenshots.forEach(screenshot => {
          html += `<img src="${screenshot}" alt="Test Screenshot" class="screenshot">`;
        });
      }
      
      html += `</div>`;
    });

    // Recommendations
    if (qaResult.recommendations && qaResult.recommendations.length > 0) {
      html += `<div class="recommendations">
        <h2>💡 Recommendations</h2>
        <ul>`;
      qaResult.recommendations.forEach(rec => {
        html += `<li>${rec}</li>`;
      });
      html += `</ul></div>`;
    }

    // Summary
    html += `<div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
      <h2>📝 Summary</h2>
      <pre style="white-space: pre-wrap;">${qaResult.summary}</pre>
    </div>`;

    html += `</div></body></html>`;

    // Save to file if output path specified
    if (options.outputPath) {
      const outputPath = path.resolve(options.outputPath);
      const dir = path.dirname(outputPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, html);
      console.log(`HTML report saved to: ${outputPath}`);
    }

    return html;
  }

  private async generateJSONReport(qaResult: QAResult, options: ReportOptions): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      ...qaResult
    };

    const jsonReport = JSON.stringify(report, null, 2);

    // Save to file if output path specified
    if (options.outputPath) {
      const outputPath = path.resolve(options.outputPath);
      const dir = path.dirname(outputPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, jsonReport);
      console.log(`JSON report saved to: ${outputPath}`);
    }

    return jsonReport;
  }
}