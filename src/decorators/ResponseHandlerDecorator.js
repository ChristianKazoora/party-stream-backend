const handle_206_200 = require("./response_decorators/handle_206_200");
const handle_302 = require("./response_decorators/handle_302");
const handle_416 = require("./response_decorators/handle_416");
const handle_429_503 = require("./response_decorators/handle_429_503");

class ResponseHandlerDecorator {
  constructor(videoHandler) {
    this.videoHandler = videoHandler;
  }

  handleResponse(statusCode, headers, res, externalRes, attempt, n) {
    // console.log(`Status Code: ${statusCode}`);
    if (statusCode === 206 || statusCode === 200) {
      handle_206_200(headers, res, externalRes, statusCode);
    } else if (statusCode === 416) {
      // Handle 416 error (Range Error)
      handle_416(n, headers, attempt);
    } else if (statusCode === 429 || (statusCode === 503 && n > 0)) {
      // Handle 429 error (Rate Limit)
      // Handle 503 error (Service Unavailable)
      handle_429_503(n, attempt, this.videoHandler, statusCode);
    } else if (statusCode === 302) {
      // Handle 302 error (Redirect)
      handle_302(n, headers, attempt, this.videoHandler);
    }
  }
}

module.exports = ResponseHandlerDecorator;
