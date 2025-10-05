// logger.js - Logging utility for enrichment engine
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFile() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `enrichment-${date}.log`);
  }

  writeToFile(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data || {}
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.getLogFile(), logLine);
  }

  info(message, data) {
    console.log(chalk.blue('ℹ'), message);
    this.writeToFile('INFO', message, data);
  }

  success(message, data) {
    console.log(chalk.green('✓'), message);
    this.writeToFile('SUCCESS', message, data);
  }

  warn(message, data) {
    console.log(chalk.yellow('⚠'), message);
    this.writeToFile('WARN', message, data);
  }

  error(message, error) {
    console.log(chalk.red('✗'), message);
    if (error) {
      console.log(chalk.red('  '), error.message || error);
    }
    this.writeToFile('ERROR', message, { error: error?.message || error });
  }

  debug(message, data) {
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.gray('⋯'), message);
      this.writeToFile('DEBUG', message, data);
    }
  }

  banner(title) {
    const border = '━'.repeat(60);
    console.log(chalk.cyan(`\n${border}`));
    console.log(chalk.cyan.bold(`  ${title}`));
    console.log(chalk.cyan(`${border}\n`));
  }

  section(title) {
    console.log(chalk.magenta(`\n── ${title} ──\n`));
  }

  table(data) {
    console.table(data);
  }

  progress(current, total, message) {
    const percentage = Math.round((current / total) * 100);
    console.log(chalk.cyan(`[${current}/${total}] ${percentage}%`), message);
  }
}

// Export singleton instance
export default new Logger();
