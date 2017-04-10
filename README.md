# ganomede-errors

Simple wrapper around [`restify.JsonClient`](http://restify.com/#jsonclient) to
start with when writing own API Clients. Changes:

  - single `request()`-like method (`#apiCall({method, path, body, headers, qs})`), meaning:
    - base urls;
    - per request headers;
    - easier query string;
  - supports path prefixes (useful if you want to have something like `/api/v1` in front of all requests).

## Basic Usage

Import `BaseClient` and define higher-level APIs.


``` js
const BaseClient = require('ganomede-base-client');

class MyApi extends BaseClient {
  constructor ({hostname = 'my-api.example.org', version = 1, apiKey}) {
    super(
      `https://${hostname}/version-${version}`,  // base url
      {headers: {'X-API-Key': apiKey}}           // more options
    );
  }

  ping (callback) {
    // Will issue HTTP GET to
    // https://my-api.example.org/version-1/ping?check-auth=1
    //
    // Callback will contain JSON response (if any, otherwise empty object),
    // see restify docs for more details at:
    // https://github.com/restify/clients
    //
    // `call` is what restify methods return (like #get(), #post(), etc.).
    const call = this.apiCall(
      {method: 'get', path: '/ping', qs: {'check-auth': 1}},
      callback
    );
  }
}
```

## Custom defaults

Some defaults are changed from those of restify:

  - up to 3 attempts on establishing TCP connections
    with exponential timeout between 1 and 5 seconds;
  - default headers:
    - `accept` of `application/json`;
    - `accept-encoding` of `gzip,deflate`.
