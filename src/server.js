const express = require("express");
const fs = require("fs");
const WebSocket = require("ws");
const debounce = require("lodash.debounce");
const { v4: uuidv4 } = require("uuid"); // Add this line at the top to import uuid
const VideoHandler = require("./video-handler"); // Import VideoHandler
const LinkHandlerDecorator = require("./decorators/LinkHandlerDecorator"); // Import the decorator
const SubtitleHandler = require("./subtitlesHandler");
const dotenv = require("dotenv");
dotenv.config();
const ipAddr = require("ip").address();
const cors = require("cors");
const app = express();
const port = process.env.BACKEND_PORT || 1234;
const address = process.env.BACKEND_ADDRESS;
const WebSocketPort = process.env.BACKEND_WEBSOCKET_PORT || 4321;
let debouncedRequest;
video = new LinkHandlerDecorator(new VideoHandler());
subtitles = new SubtitleHandler();
app.use(cors());
app.use(express.json());

let lastBroadcast = {
  type: null,
  timestamp: 0,
};

let playbackState = {
  isPlaying: false,
  currentPosition: 0, // in seconds
  currentLink: "",
  lastSyncTime: Date.now(),
  subtitleLink: "",
  id: "",
};

const wss = new WebSocket.Server({ port: WebSocketPort });

wss.on("connection", (ws) => {
  ws.id = uuidv4();
  playbackState.id = ws.id;
  playbackState.type = "connection";
  console.log("Client connected with id:", playbackState.id);
  ws.send(JSON.stringify(playbackState));

  ws.on("message", (message) => {
    const event = JSON.parse(message);

    const now = Date.now();
    const timeDiff = now - lastBroadcast.timestamp;

    if (event.type === lastBroadcast.type && timeDiff < 1000) {
      // 1 second threshold
      console.log("Rejected duplicate broadcast:", event.type);
      return;
    }
    console.log("Received message from client:", event);

    if (event.type === "play") {
      playbackState.isPlaying = true;
      playbackState.lastSyncTime = now;
      broadcast({ type: "play", senderId: event.id });
    } else if (event.type === "pause") {
      playbackState.isPlaying = false;
      playbackState.currentPosition +=
        (now - playbackState.lastSyncTime) / 1000;
      playbackState.lastSyncTime = now;
      broadcast({ type: "pause", senderId: event.id });
    } else if (event.type === "seek") {
      playbackState.currentPosition = event.position;
      playbackState.lastSyncTime = now;
      broadcast({ type: "seek", position: event.position, senderId: event.id });
    } else if (event.type === "link") {
      const videoId = uuidv4().substring(0, 8);
      const customEndpoint = `/video/${videoId}`;
      const videoUrl = `${address}${customEndpoint}`;
      playbackState.currentLink = video.setMediaPath(event.link, videoUrl);
      playbackState.currentLink.includes(address)
        ? createVideoEndpoint(customEndpoint)
        : "";
      broadcast({
        type: "link",
        link: playbackState.currentLink,
        senderId: event.id,
      });
    } else if (event.type === "subtitles") {
      const subtitleId = uuidv4().substring(0, 8);
      const customEndpoint = `/subtitles/${subtitleId}`;
      const subtitleUrl = `${address}${customEndpoint}`;
      createSubtitlesEndpoint(customEndpoint);
      playbackState.subtitleLink = subtitleUrl;
      broadcast({
        type: "subtitles",
        link: subtitleUrl,
        senderId: event.id,
      });
      // playbackState.currentSubtitle = ;
    }

    lastBroadcast.type = event.type;
    lastBroadcast.timestamp = now;
  });

  function broadcast(message) {
    wss.clients.forEach((client) => {
      if (
        client.readyState === WebSocket.OPEN &&
        (message.type === "link" ||
          message.type === "subtitles" ||
          client.id !== message.senderId)
      ) {
        client.send(JSON.stringify(message));
      }
    });
  }

  function createVideoEndpoint(endpoint) {
    app.get(endpoint, (req, res) => {
      if (debouncedRequest) {
        debouncedRequest.cancel();
      }

      debouncedRequest = debounce(() => video.makeRequest(req, res), 300);
      debouncedRequest();
    });

    console.log(`Created new video endpoint: ${endpoint}`);
  }
});
function createSubtitlesEndpoint(endpoint) {
  app.get(endpoint, (req, res) => {
    const data = subtitles.getSubtitles();
    res.header("Content-Type", "text/vtt");
    res.send(data);
  });
  console.log(`Created new subtitles endpoint: ${endpoint}`);
}
app.post("/add-subtitles", async (req, res) => {
  subtitles.setSubtitles(req.body);
  res.send("Subtitles added successfully");
});

// app.get("/get-subtitles", (req, res) => {
//   const data = subtitles.getSubtitles();
//   res.header("Content-Type", "text/vtt");
//   res.send(data);
// });

app.listen(port, "0.0.0.0", () => {
  console.log(
    `Server is running on http://0.0.0.0:${port} and http://${ipAddr}:${port}`
  );
});
