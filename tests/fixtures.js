'use strict';

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);

app.use(bodyParser.json());

// If we hit `/custom` endpoint, do what body says.
app.use((req, res, next) => {
  if (!req.path.endsWith('/custom'))
    return next();

  if (req.body.hasOwnProperty('status'))
    res.status(req.body.status);

  next();
});

// Otherwise, just echo all the request info back as JSON.
app.use((req, res, next) => res.json({
  method: req.method.toLowerCase(),
  url: req.url,
  originalUrl: req.originalUrl,
  path: req.path,
  query: req.query,
  headers: req.headers,
  body: req.body,
}));

// Lower keep alive, so server closes nicely after tests are done.
server.on('connection', (socket) => socket.setTimeout(100));

module.exports = {
  server,
  startServer (cb) { server.listen(process.env.TEST_PORT || 3000, '127.0.0.1', cb); },
  stopServer (cb) { server.close(cb); }
};
