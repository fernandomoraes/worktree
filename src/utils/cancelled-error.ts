/**
 * Thrown when someone escapes out of a prompt. The prompt has already said so
 * on screen, so the entry point exits quietly instead of reporting an error.
 */
export class CancelledError extends Error {
  constructor() {
    super('Cancelled by user.');
    this.name = 'CancelledError';
  }
}
