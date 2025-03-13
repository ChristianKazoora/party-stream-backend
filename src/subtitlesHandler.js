class subtitles {
  constructor() {
    this.subtitlesData = "";
  }
  setSubtitles(subtitlesData) {
    this.subtitlesData = `${subtitlesData["subtitle"]}`;
  }
  getSubtitles() {
    return this.subtitlesData;
  }
  clearSubtitles() {
    this.subtitlesData = "";
  }
}

module.exports = subtitles;
