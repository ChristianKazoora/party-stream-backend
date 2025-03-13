const https = require("https");
const fs = require("fs");
const ResponseHandlerDecorator = require("./decorators/ResponseHandlerDecorator");
class VideoHandler {
  constructor() {
    this.MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB buffer size limit
    this.videoPath = {
      link: "",
      redirect: true,
    };
    this.delay = 2000;
    this.retries = 3;
    this.rhd = new ResponseHandlerDecorator(this);
    this.isLocalstream = null;
    this.stream = null;
  }
  setMediaPath(videoPath) {
    this.videoPath = videoPath;
  }
  validateRange(range, contentLength) {
    if (!range || !/^bytes=\d*-\d*$/.test(range)) {
      return null; // Invalid range
    }

    const [start, end] = range.replace(/bytes=/, "").split("-");
    const startInt = parseInt(start, 10);
    const endInt = end ? parseInt(end, 10) : contentLength - 1;

    // Ensure the range is within bounds
    if (
      isNaN(startInt) ||
      startInt < 0 ||
      startInt >= contentLength ||
      (end && (isNaN(endInt) || endInt >= contentLength || endInt < startInt))
    ) {
      return null;
    }

    return `bytes=${startInt}-${endInt}`;
  }

  fetchWithRetry(req, res) {
    return new Promise((reject) => {
      const attempt = (n, contentLength = null) => {
        if (n <= 0) {
          return res.status(503).send("Attempt limit reached");
        }
        // Parse the external URL
        const videoURL = new URL(this.videoPath.link);
        const range = req.headers.range; // Get Range header
        let sanitizedRange = range;

        if (contentLength) {
          sanitizedRange = this.validateRange(range, contentLength);
          if (!sanitizedRange && range) {
            res.setHeader("Content-Range", `bytes */${contentLength}`);
            return res.status(416).send("Range Not Satisfiable");
          }
        }

        const options = {
          hostname: videoURL.hostname,
          path: videoURL.pathname + videoURL.search,
          method: "GET",
          headers: sanitizedRange ? { Range: sanitizedRange } : {}, // Forward Range header
        };

        const externalRequest = https.request(options, (externalRes) => {
          const { statusCode, headers } = externalRes;
          // range &&
          //   console.log(
          //     `Range: ${sanitizedRange} , Status Code: ${statusCode}`
          //   );

          this.rhd.handleResponse(
            statusCode,
            headers,
            res,
            externalRes,
            attempt,
            n
          );
        });

        externalRequest.on("error", (err) => {
          console.error("Error fetching video:", err.message);
          res.status(500).send("Error fetching video");
          reject(err);
        });

        externalRequest.end();
      };
      this.isLocalstream = false;
      attempt(this.retries);
    });
  }

  makeRequest(req, res) {
    const isLocalFile = fs.existsSync(this.videoPath.link);
    if (isLocalFile) {
      this.isLocalstream = true;
      const stat = fs.statSync(this.videoPath.link);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start > end) {
          res.status(416).send("Requested Range Not Satisfiable");
          return;
        }

        const chunksize = end - start + 1;
        this.stream = fs.createReadStream(this.videoPath.link, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        };
        this.rhd.handleResponse(206, head, res, this.stream, null, null, null);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        };
        (this.stream = fs.createReadStream(this.videoPath.link)),
          this.rhd.handleResponse(
            200,
            head,
            res,
            this.stream,
            null,
            null,
            null
          );
      }
    } else {
      this.fetchWithRetry(req, res).catch((err) => {
        console.error("Error in fetchWithRetry:", err);
      });
    }
  }
}

module.exports = VideoHandler;
