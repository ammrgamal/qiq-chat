// logger.ts - Typed colorful logging utility for Rules Engine
import chalk from 'chalk';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  data?: string;
}

export interface ProgressBar {
  title: string;
  log: (current: number, total: number, message?: string) => void;
}

class Logger {
  context: string;
  logFilePath: string;
  enableFileLogging: boolean;
  constructor(context = 'RulesEngine') {
    this.context = context;
    this.logFilePath = join(__dirname, '../logs/rules-engine.log');
    this.enableFileLogging = true;
    const logsDir = dirname(this.logFilePath);
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  }

  private writeToFile(level: string, message: string, data: unknown = null) {
    if (!this.enableFileLogging) return;
    try {
      const logEntry: LogEntry = {
        timestamp: this.getTimestamp(),
        level,
        context: this.context,
        message,
        data: data ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined
      };
      appendFileSync(this.logFilePath, JSON.stringify(logEntry) + '\n');
    } catch (error: any) {
      // fallback console error but don't throw
      console.error('Failed to write to log file:', error?.message || error);
    }
  }

  getTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  info(message: string, data: unknown = null): void {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.white(message),
      data ? chalk.gray(JSON.stringify(data, null, 2)) : ''
    );
    this.writeToFile('INFO', message, data);
  }

  success(message: string, data: unknown = null): void {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.green('✓'),
      chalk.white(message),
      data ? chalk.gray(JSON.stringify(data, null, 2)) : ''
    );
    this.writeToFile('SUCCESS', message, data);
  }

  warn(message: string, data: unknown = null): void {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.yellow('⚠'),
      chalk.yellow(message),
      data ? chalk.gray(JSON.stringify(data, null, 2)) : ''
    );
    this.writeToFile('WARN', message, data);
  }

  error(message: string, error: unknown = null): void {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.red('✗'),
      chalk.red(message)
    );
    if (error) {
      if (error instanceof Error) {
        console.log(chalk.red(`  Error: ${error.message}`));
        if (error.stack) console.log(chalk.gray(`  Stack: ${error.stack}`));
      } else {
        console.log(chalk.gray(JSON.stringify(error, null, 2)));
      }
    }
    this.writeToFile('ERROR', message, error);
  }

  debug(message: string, data: unknown = null): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        chalk.blue(`[${this.getTimestamp()}]`),
        chalk.cyan(`[${this.context}]`),
        chalk.magenta('DEBUG:'),
        chalk.white(message),
        data ? chalk.gray(JSON.stringify(data, null, 2)) : ''
      );
    }
  }

  createProgressBar(title: string): ProgressBar {
    return {
      title,
      log: (current: number, total: number, message = '') => {
        const percent = Math.floor((current / total) * 100);
        const filled = '█'.repeat(Math.floor(percent / 2));
        const empty = '░'.repeat(50 - Math.floor(percent / 2));
        process.stdout.write(`\r${chalk.cyan(title)}: [${chalk.green(filled)}${chalk.gray(empty)}] ${chalk.yellow(percent + '%')} ${chalk.white(message)}`);
        if (current >= total) console.log();
      }
    };
  }

  separator(char = '='): void { console.log(chalk.gray(char.repeat(80))); }

  banner(text: string): void {
    this.separator('=');
    console.log(chalk.bold.cyan(`  ${text}`));
    this.separator('=');
  }

  step(number: number, text: string): void {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.bold.yellow(`Step ${number}:`),
      chalk.white(text)
    );
  }
}

const logger = new Logger('RulesEngine');
export default logger;
export { Logger };