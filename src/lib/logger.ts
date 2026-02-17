/**
 * Structured Logging System
 *
 * Provides structured, context-aware logging for the entire application.
 * Can be extended to send logs to external services.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  componentName?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  data?: any;
  error?: Error;
  stack?: string;
}

class Logger {
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private context: LogContext = {};
  private minLevel: LogLevel = "debug";
  private isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.LOG_LEVELS[level] >= Logger.LOG_LEVELS[this.minLevel];
  }

  private format(entry: LogEntry): string {
    const { timestamp, level, message, context, data } = entry;
    const contextStr = context ? ` [${JSON.stringify(context)}]` : "";
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}${dataStr}`;
  }

  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case "debug":
        return console.debug;
      case "info":
        return console.info;
      case "warn":
        return console.warn;
      case "error":
        return console.error;
    }
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data,
      error,
      stack: error?.stack,
    };

    const formatted = this.format(entry);
    const consoleMethod = this.getConsoleMethod(level);

    if (error) {
      consoleMethod(formatted, error);
    } else if (data) {
      consoleMethod(formatted, data);
    } else {
      consoleMethod(formatted);
    }

    // Send to external logging service in production
    if (!this.isDev && level === "error") {
      this.sendToService(entry);
    }
  }

  private sendToService(entry: LogEntry) {
    // This can be extended to send logs to Sentry, LogRocket, etc.
    try {
      // TODO: Implement external logging integration
      // fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) });
    } catch (e) {
      // Silently fail to prevent logging from breaking the app
    }
  }

  debug(message: string, data?: any) {
    this.log("debug", message, data);
  }

  info(message: string, data?: any) {
    this.log("info", message, data);
  }

  warn(message: string, data?: any) {
    this.log("warn", message, data);
  }

  error(message: string, error?: Error | any, data?: any) {
    if (error instanceof Error) {
      this.log("error", message, data, error);
    } else {
      this.log("error", message, error);
    }
  }

  group(label: string) {
    console.group(label);
  }

  groupEnd() {
    console.groupEnd();
  }
}

export const logger = new Logger();

// Convenience functions
export const log = {
  debug: (msg: string, data?: any) => logger.debug(msg, data),
  info: (msg: string, data?: any) => logger.info(msg, data),
  warn: (msg: string, data?: any) => logger.warn(msg, data),
  error: (msg: string, error?: Error, data?: any) => logger.error(msg, error, data),
  setContext: (ctx: LogContext) => logger.setContext(ctx),
  clearContext: () => logger.clearContext(),
};

// Activity logger for user actions
export class ActivityLogger {
  constructor(private activityType: string) {}

  log(message: string, metadata?: any) {
    logger.info(`[${this.activityType}] ${message}`, metadata);
  }

  async track<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    logger.debug(`[${this.activityType}] Starting: ${label}`);

    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      logger.info(`[${this.activityType}] Completed: ${label}`, {
        duration: `${duration.toFixed(2)}ms`,
      });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(
        `[${this.activityType}] Failed: ${label}`,
        error instanceof Error ? error : new Error(String(error)),
        { duration: `${duration.toFixed(2)}ms` }
      );
      throw error;
    }
  }
}

// Create activity loggers for common operations
export const activityLoggers = {
  task: new ActivityLogger("TASK"),
  epic: new ActivityLogger("EPIC"),
  agent: new ActivityLogger("AGENT"),
  search: new ActivityLogger("SEARCH"),
  calendar: new ActivityLogger("CALENDAR"),
  memory: new ActivityLogger("MEMORY"),
};
