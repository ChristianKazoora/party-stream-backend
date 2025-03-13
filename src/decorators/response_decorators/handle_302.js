function handle_302_esponse(n, headers, attempt, videoHandler) {
  videoHandler.videoPath = headers.location;
  attempt(n - 1);
}

module.exports = handle_302_esponse;
