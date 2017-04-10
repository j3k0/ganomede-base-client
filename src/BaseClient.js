'use strict';

const {parse, format} = require('url');
const querystring = require('querystring');
const {createJsonClient} = require('restify-clients');
const lodash = require('lodash');
const {GanomedeError} = require('ganomede-errors');

const SUPPORTS_BODY = ['post', 'put', 'patch'];

// TODO
const monkeyPatch = (client) => {
  // const originalFn = client._options;

  // client._options = (method, options) => {
  //   console.log('HRHEHEHEH', {method, options})
  //   originalFn.call(client, method, options);
  // };
};

class BaseClient {
  constructor (baseUrl, optionsOverwrites = {}) {
    const {pathPrefix, apiOptions} = BaseClient.parseConstructorOptions(baseUrl, optionsOverwrites);

    this.pathPrefix = pathPrefix;
    this.api = createJsonClient(apiOptions);
    monkeyPatch(this.api);
  }

  apiCall ({method, path, headers = {}, body = null, qs = null}, callback) {
    const formattedQs = qs ? `?${querystring.stringify(qs)}` : '';
    const bodySupported = SUPPORTS_BODY.includes(method);
    const args = [{
      path: this.pathPrefix + path + formattedQs,
      headers
    }];

    if (!bodySupported && (body !== null))
      throw new BaseClient.RequestSpecError('%s does not support body: `%j` passed in, expected `null` (use `qs` param instead)', method, body);

    if (bodySupported)
      args.push(body);

    this.api[method](...args, (err, req, res, obj) => {
      return err
        ? callback(err)
        : callback(null, obj);
    });
  }

  static parseConstructorOptions (baseUrl, optionsOverwrites) {
    const url = parse(baseUrl);

    if (url.hash || (url.pathname !== url.path))
      throw new Error('"Unclean" path is not supported: no query strings, hashes, etc.');

    return {
      pathPrefix: url.pathname.replace(/\/+$/g, ''),
      apiOptions: lodash.merge(
        {url: format({protocol: url.protocol, hostname: url.hostname, port: url.port})},
        BaseClient.defaultOptions,
        optionsOverwrites
      )
    };
  }
}

BaseClient.defaultOptions = {
  // Enable retries in establishing TCP connection
  // (this will not retry on HTTP errors).
  // retry: false,
  headers: {
    'accept': 'application/json',
    'accept-encoding': 'gzip,deflate'
  }
};

BaseClient.RequestSpecError = class RequestSpecError extends GanomedeError {};

module.exports = BaseClient;
