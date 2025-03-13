const handle_206_200 = require("./response_decorators/handle_206_200");
const handle_302 = require("./response_decorators/handle_302");
const handle_416 = require("./response_decorators/handle_416");
const handle_429_503 = require("./response_decorators/handle_429_503");

class ResponseHandlerDecorator {
  constructor(videoHandler) {
    this.videoHandler = videoHandler;
  }

  handleResponse(
    statusCode,
    headers,
    res,
    externalRes,
    attempt,
    n,
    contentLength = null
  ) {
    if (statusCode === 206 || statusCode === 200) {
      handle_206_200(headers, res, externalRes, statusCode);
    } else if (statusCode === 416) {
      // Get content length from various headers
      let actualLength = contentLength;
      if (!actualLength && headers["x-goog-stored-content-length"]) {
        actualLength = parseInt(headers["x-goog-stored-content-length"], 10);
      } else if (!actualLength && headers["content-range"]) {
        const match = /\/(\d+)$/.exec(headers["content-range"]);
        if (match) {
          actualLength = parseInt(match[1], 10);
        }
      }

      if (!isNaN(actualLength) && actualLength > 0) {
        console.warn(`Retrying with corrected length: ${actualLength}`);
        attempt(n, actualLength);
      } else {
        console.error("Failed to retrieve content length for 416 error");
        res.status(416).send("Range Not Satisfiable");
      }
    } else if (statusCode === 429 || (statusCode === 503 && n > 0)) {
      handle_429_503(n, attempt, this.videoHandler, statusCode);
    } else if (statusCode === 302) {
      handle_302(n, headers, attempt, this.videoHandler);
    } else {
      console.warn(`Unhandled status code: ${statusCode}`);
      res.status(statusCode).send(`Server returned ${statusCode}`);
    }
  }
}

module.exports = ResponseHandlerDecorator;
