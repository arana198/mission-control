/**
 * Structured Logger Utility
 * Replaces console.log with production-ready logging
 * Uses simple structured format for flexibility
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Formatters for different environments
 */
const formatters = {
  // Development: pretty printed
  development: (entry: LogEntry): string => {
    const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}:`;
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const error = entry.error ? ` ERROR: ${entry.error.message}` : "";
    return `${prefix} ${entry.message}${context}${error}`;
  },

  // Production: JSON lines format for log aggregation
  production: (entry: LogEntry): string => {
    return JSON.stringify(entry);
  },
};

class Logger {
  private isDevelopment = process.env.NODE_ENV !== "production";
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
          }
        : undefined,
    };
  }

  private output(entry: LogEntry): void {
    const formatter = this.isDevelopment
      ? formatters.development
      : formatters.production;

    const formatted = formatter(entry);

    // Use console in all environments (output goes to stdout/stderr)
    if (entry.level === "error") {
      console.error(formatted);
    } else if (entry.level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Debug level - detailed diagnostic information
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      const entry = this.createEntry("debug", message, context);
      this.output(entry);
    }
  }

  /**
   * Info level - general informational messages
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      const entry = this.createEntry("info", message, context);
      this.output(entry);
    }
  }

  /**
   * Warn level - warning messages for potentially problematic situations
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      const entry = this.createEntry("warn", message, context);
      this.output(entry);
    }
  }

  /**
   * Error level - error messages
   */
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      const err = error instanceof Error ? error : new Error(String(error));
      const entry = this.createEntry("error", message, context, err);
      this.output(entry);
    }
  }

  /**
   * Get child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger - logs include parent context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private parentContext: Record<string, unknown>
  ) {}

  private mergeContext(context?: Record<string, unknown>) {
    return { ...this.parentContext, ...context };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    this.parent.error(message, error, this.mergeContext(context));
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string): ChildLogger {
  return logger.child({ module });
}

/**
 * Export types for external use
 */
export type { LogEntry };
