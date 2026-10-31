/** Error carrying an HTTP status; its message is safe to show to clients. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
