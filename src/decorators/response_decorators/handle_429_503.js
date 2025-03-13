function handle_429_503_response(n, attempt, videoHandler, statusCode) {
  statusCode === 429
    ? console.warn(
        `Received 429 Too Many Requests. Retrying in ${videoHandler.delay}ms...`
      )
    : console.warn(
        `Received 503 Service Unavailable. Retrying in ${videoHandler.delay}ms...`
      );
  setTimeout(() => attempt(n - 1), videoHandler.delay);
  videoHandler.delay *= 2;
}
module.exports = handle_429_503_response;
