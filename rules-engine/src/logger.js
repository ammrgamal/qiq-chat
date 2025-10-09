// JS shim re-exporting the TS implementation for backward compatibility
import logger, { Logger } from './logger.ts';
export { Logger };
export default logger;
