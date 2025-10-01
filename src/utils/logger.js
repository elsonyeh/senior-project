// Logger utility for environment-aware logging
// In production, only console.error will be shown

const isDevelopment = import.meta.env.DEV;

export const logger = {
  // Always show errors in all environments
  error: (...args) => {
    console.error(...args);
  },

  // Only show warnings in development
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  // Only show info logs in development
  info: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Only show debug logs in development
  debug: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Group logging for better organization (development only)
  group: (label, fn) => {
    if (isDevelopment) {
      console.group(label);
      fn();
      console.groupEnd();
    }
  }
};

export default logger;