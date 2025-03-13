function handle_416_Response(n, headers, attempt) {
  const actualLength = parseInt(headers["x-goog-stored-content-length"], 10);
  if (!isNaN(actualLength)) {
    console.warn(`Retrying with corrected length: ${actualLength}`);
    attempt(n, actualLength); // Retry with the corrected content length
  } else {
    console.error("Failed to retrieve content length for 416 error");
    res.status(416).send("Range Not Satisfiable");
  }
}

module.exports = handle_416_Response;
