import pino from 'pino';

const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info', // Default to 'info', configurable via env
};

// Conditionally use pino-pretty in development
if (process.env.NODE_ENV !== 'production') {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard', // Use system's locale for time
      ignore: 'pid,hostname', // Don't show pid and hostname
    },
  };
}

const logger = pino(loggerOptions);

export default logger;
