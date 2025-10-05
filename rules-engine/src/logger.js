// logger.js - Simple colorful logging utility for Rules Engine
import chalk from 'chalk';

class Logger {
  constructor(context = 'RulesEngine') {
    this.context = context;
  }

  /**
   * Get formatted timestamp
   * @returns {string} Formatted timestamp
   */
  getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  info(message, data = null) {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.white(message),
      data ? chalk.gray(JSON.stringify(data, null, 2)) : ''
    );
  }

  /**
   * Log success message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  success(message, data = null) {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.green('✓'),
      chalk.white(message),
      data ? chalk.gray(JSON.stringify(data, null, 2)) : ''
    );
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  warn(message, data = null) {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.yellow('⚠'),
      chalk.yellow(message),
      data ? chalk.gray(JSON.stringify(data, null, 2)) : ''
    );
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {Error|any} error - Optional error object or data
   */
  error(message, error = null) {
    console.log(
      chalk.blue(`[${this.getTimestamp()}]`),
      chalk.cyan(`[${this.context}]`),
      chalk.red('✗'),
      chalk.red(message)
    );
    if (error) {
      if (error instanceof Error) {
        console.log(chalk.red(`  Error: ${error.message}`));
        if (error.stack) {
          console.log(chalk.gray(`  Stack: ${error.stack}`));
        }
      } else {
        console.log(chalk.gray(JSON.stringify(error, null, 2)));
      }
    }
  }

  /**
   * Log debug message (only in development)
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  debug(message, data = null) {
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

  /**
   * Create a progress bar logger
   * @param {string} title - Title for the progress bar
   * @returns {Object} Progress bar object
   */
  createProgressBar(title) {
    return {
      title,
      log: (current, total, message = '') => {
        const percent = Math.floor((current / total) * 100);
        const filled = '█'.repeat(Math.floor(percent / 2));
        const empty = '░'.repeat(50 - Math.floor(percent / 2));
        process.stdout.write(
          `\r${chalk.cyan(title)}: [${chalk.green(filled)}${chalk.gray(empty)}] ${chalk.yellow(percent + '%')} ${chalk.white(message)}`
        );
        if (current >= total) {
          console.log(); // New line when complete
        }
      }
    };
  }

  /**
   * Log separator line
   * @param {string} char - Character to use for separator
   */
  separator(char = '=') {
    console.log(chalk.gray(char.repeat(80)));
  }

  /**
   * Log a banner/header
   * @param {string} text - Text to display in banner
   */
  banner(text) {
    this.separator('=');
    console.log(chalk.bold.cyan(`  ${text}`));
    this.separator('=');
  }
}

// Export singleton instance
export default new Logger('RulesEngine');
