const dropbox = require("./link_decorators/dropbox");
const youtube = require("./link_decorators/youtube");
const localFile = require("./link_decorators/localFile");

class LinkHandlerDecorator {
  constructor(videoHandler) {
    this.videoHandler = videoHandler;
  }

  setMediaPath(videoPath, genarateLink) {
    let linkData = { link: videoPath, redirect: false };
    if (videoPath.includes("dropbox.com")) {
      linkData = dropbox(videoPath);
    } else if (videoPath.includes("youtube.com")) {
      linkData = youtube(videoPath);
    } else if (videoPath.includes("file://")) {
      linkData = localFile(videoPath);
    }

    if (linkData.redirect) {
      return linkData.link;
    } else {
      this.videoHandler.setMediaPath(linkData);
      return genarateLink;
    }
  }

  makeRequest(req, res) {
    this.videoHandler.makeRequest(req, res);
  }
}

module.exports = LinkHandlerDecorator;
