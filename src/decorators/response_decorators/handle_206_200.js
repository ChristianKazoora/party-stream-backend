const e = require("express");

function handle_206_200_Response(headers, res, externalRes, statusCode) {
  const filteredHeaders = { ...headers };
  delete filteredHeaders["content-disposition"];
  res.writeHead(statusCode, filteredHeaders);
  externalRes.pipe(res);
}

module.exports = handle_206_200_Response;
