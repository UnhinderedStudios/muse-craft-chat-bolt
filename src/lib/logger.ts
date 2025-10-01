type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = import.meta.env.DEV;

  debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    console.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }

  log(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.log(message, ...args);
    }
  }
}

export const logger = new Logger();
