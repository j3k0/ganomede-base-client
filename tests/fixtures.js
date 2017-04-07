'use strict';

const http = require('http');

const server = http.createServer((req, res) => {

});

module.exports = {
  server,
  startServer (cb) { server.listen(cb); },
  stopServer (cb) { server.close(cb); }
};
