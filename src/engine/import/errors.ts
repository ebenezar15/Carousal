/** An import failure with a message that is safe to show to the user as-is. */
export class ImportError extends Error {
  constructor(
    public userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = 'ImportError';
  }
}
