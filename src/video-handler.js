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
    // Add these properties to cache content information per video URL
    this.contentCache = new Map(); // Will store {url: {contentLength, etagValue}}
  }
  setMediaPath(videoPath) {
    this.videoPath = videoPath;
  }
  validateRange(range, contentLength) {
    // If no range provided, return null
    if (!range) {
      return null;
    }

    // Parse the range header
    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!rangeMatch) {
      console.warn(`Invalid range format: ${range}`);
      return null;
    }

    // Extract start and end from the range
    let [, startStr, endStr] = rangeMatch;
    let start = startStr ? parseInt(startStr, 10) : 0;
    let end = endStr
      ? parseInt(endStr, 10)
      : contentLength
        ? contentLength - 1
        : undefined;

    // If content length is unknown, return the original range
    if (contentLength === null || contentLength === undefined) {
      return range;
    }

    // Adjust values to be within bounds
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= contentLength) end = contentLength - 1;
    if (start < 0) start = 0;

    // Check if this is a valid range
    if (start > end || start >= contentLength) {
      console.warn(
        `Invalid range: start=${start}, end=${end}, contentLength=${contentLength}`
      );
      return null;
    }

    console.log(`Sanitized range: bytes=${start}-${end}/${contentLength}`);
    return `bytes=${start}-${end}`;
  }
  discoverContentLength(url) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "HEAD",
        headers: {
          Accept: "*/*",
          "Accept-Language": "en_US",
          "User-Agent": "VLC/3.0.21 LibVLC/3.0.21",
          Range: "bytes=0-",
        },
      };
      console.log("discoverContentLengthOptions", options);
      const headRequest = https.request(options, (res) => {
        if (res.statusCode === 200 || res.statusCode === 206) {
          const contentLength = parseInt(res.headers["content-length"], 10);
          const etagValue = res.headers["etag"]; // lowercase is standard for HTTP headers

          if (!isNaN(contentLength)) {
            resolve({ contentLength, etagValue });
          } else {
            console.warn(
              "Could not determine content length from HEAD request"
            );
            resolve({ contentLength: null, etagValue: null });
          }
        } else if (res.statusCode === 302 && res.headers.location) {
          // Follow redirect
          this.discoverContentLength(new URL(res.headers.location))
            .then(resolve)
            .catch(reject);
        } else {
          console.warn(`HEAD request failed with status: ${res.statusCode}`);
          resolve({ contentLength: null, etagValue: null });
        }
      });

      headRequest.on("error", (err) => {
        console.error("Error in HEAD request:", err.message);
        resolve({ contentLength: null, etagValue: null });
      });

      headRequest.end();
    });
  }
  fetchWithRetry(req, res) {
    // console.log("Request headers:", req.headers);

    return new Promise((resolve, reject) => {
      let knownContentLength = null;
      let etagValue = null;
      const videoURL = new URL(this.videoPath.link);
      const urlString = videoURL.toString();
      // Check if we already have cached content info for this URL
      if (this.contentCache.has(urlString)) {
        const cachedInfo = this.contentCache.get(urlString);
        knownContentLength = cachedInfo.contentLength;
        etagValue = cachedInfo.etagValue;
        console.log(
          `Using cached content info: length=${knownContentLength}, etag=${etagValue}`
        );
      }
      const attempt = async (n, contentLength = null) => {
        if (n <= 0) {
          return res.status(503).send("Attempt limit reached");
        }

        try {
          const range = req.headers.range;
          // Handle requests without Range header (like Postman)
          if (!range) {
            console.log(
              "No Range header provided - sending Accept-Ranges response"
            );
            if (knownContentLength === null) {
              try {
                const discover = await this.discoverContentLength(videoURL);
                knownContentLength = discover?.contentLength || null;
                etagValue = discover?.etagValue || null;
                // Cache the discovered values
                this.contentCache.set(urlString, {
                  contentLength: knownContentLength,
                  etagValue,
                });
              } catch (err) {
                console.error("Error discovering content length:", err);
              }
            }
            return res
              .status(200)
              .header({
                "Accept-Ranges": "bytes",
                "Content-Length": knownContentLength || 0,
                "Content-Type": "video/mp4",
                "X-Content-Info":
                  "Use Range header for streaming (e.g., 'Range: bytes=0-1048576')",
              })
              .send("Use Range header for proper video streaming");
          }
          // console.log(
          //   `Attempt ${this.retries - n + 1}/${this.retries} - Range: ${range}`
          // );

          // If we don't know content length yet, try to discover it
          if (etagValue === null && knownContentLength === null && range) {
            try {
              const discover = await this.discoverContentLength(videoURL);
              knownContentLength = discover?.contentLength || null;
              etagValue = discover?.etagValue || null;
              console.log(`Discovered content length: ${knownContentLength}`);
              console.log(`Discovered etag value: ${etagValue}`);

              // Cache the discovered values for future requests
              this.contentCache.set(urlString, {
                contentLength: knownContentLength,
                etagValue,
              });
            } catch (err) {
              console.error("Error discovering content length:", err);
            }
          }

          // Use the best content length we have
          const effectiveContentLength = contentLength || knownContentLength;

          // Validate the range with the content length we have
          let sanitizedRange = range;
          if (effectiveContentLength && range) {
            sanitizedRange = this.validateRange(range, effectiveContentLength);
            if (!sanitizedRange) {
              res.setHeader(
                "Content-Range",
                `bytes */${effectiveContentLength}`
              );
              return res.status(416).send("Range Not Satisfiable");
            }
          }

          const options = {
            hostname: videoURL.hostname,
            path: videoURL.pathname + videoURL.search,
            method: "GET",
            headers: {
              Accept: "*/*",
              "Accept-Language": "en_US",
              "User-Agent": "VLC/3.0.21 LibVLC/3.0.21",
            },
          };

          // Add conditional headers
          if (etagValue) {
            options.headers["If-Match"] = etagValue;
          }

          if (sanitizedRange) {
            options.headers["Range"] = sanitizedRange;
          } else if (effectiveContentLength) {
            options.headers["Range"] = `bytes=0-${effectiveContentLength - 1}`;
          }
          console.log("Options:", options);

          const externalRequest = https.request(options, (externalRes) => {
            const { statusCode, headers } = externalRes;
            console.log("External response headers:", headers);
            // Check for content length in response headers
            if (headers["content-length"] && !knownContentLength) {
              knownContentLength = parseInt(headers["content-length"], 10);
            }

            this.rhd.handleResponse(
              statusCode,
              headers,
              res,
              externalRes,
              attempt,
              n,
              knownContentLength
            );
          });

          externalRequest.on("error", (err) => {
            console.error("Error fetching video:", err.message);
            res.status(500).send("Error fetching video");
            reject(err);
          });

          externalRequest.end();
        } catch (error) {
          console.error("Error in fetch attempt:", error);
          res.status(500).send("Internal server error");
          reject(error);
        }
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
