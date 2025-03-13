# Party Stream Backend

This repository contains the backend code for the Party Stream application. The backend is built using Node.js and Express, and it handles video streaming, subtitle management, and WebSocket connections for real-time synchronization.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Dependencies](#dependencies)

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/yourusername/party_stream_backend.git
   cd party_stream_backend
   ```

2. Install the dependencies:
   ```sh
   npm install
   ```

## Usage

To start the server, run:

```sh
npm start
```

The server will be running on `http://0.0.0.0:1234` and WebSocket connections on port `4321`.

## API Endpoints

### Video Streaming

- **GET /video/:videoId**
  - Streams the video specified by `videoId`.

### Subtitles

- **POST /add-subtitles**

  - Adds subtitles to the server.
  - Request body should contain the subtitles data.

- **GET /get-subtitles**
  - Retrieves the current subtitles in VTT format.

## WebSocket Events

### Client to Server

- **play**

  - Starts video playback.

- **pause**

  - Pauses video playback.

- **seek**

  - Seeks to a specific position in the video.
  - Payload: `{ "position": <seconds> }`

- **link**

  - Sets a new video link.
  - Payload: `{ "link": "<video_url>" }`

- **subtitles**
  - Sets a new subtitles link.
  - Payload: `{ "link": "<subtitles_url>" }`

### Server to Client

- **play**

  - Broadcasts play event to all clients.

- **pause**

  - Broadcasts pause event to all clients.

- **seek**

  - Broadcasts seek event to all clients.
  - Payload: `{ "position": <seconds> }`

- **link**
  - Broadcasts new video link to all clients.
  - Payload: `{ "link": "<video_url>" }`

## Dependencies

- [axios](https://www.npmjs.com/package/axios)
- [cors](https://www.npmjs.com/package/cors)
- [express](https://www.npmjs.com/package/express)
- [fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg)
- [ip](https://www.npmjs.com/package/ip)
- [lodash.debounce](https://www.npmjs.com/package/lodash.debounce)
- [uuid](https://www.npmjs.com/package/uuid)
- [websocket](https://www.npmjs.com/package/websocket)
# party-stream-backend
