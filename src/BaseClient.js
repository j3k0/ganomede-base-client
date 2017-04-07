'use strict';

const {parse, format} = require('url');
const {createJsonClient} = require('restify-clients');
const lodash = require('lodash');

class BaseClient {
  constructor (baseUrl, optionsOverwrites = {}) {
    const {pathPrefix, apiOptions} = BaseClient.parseConstructorOptions(baseUrl, optionsOverwrites);

    this.pathPrefix = pathPrefix;
    this.api = createJsonClient(apiOptions);
  }

  apiCall (method, path, payloadArg, callbackArg) {
    const fullPath = this.pathPrefix + path;
    const hasPayload = arguments.length === 4;
    const callback = hasPayload ? callbackArg : payloadArg;
    const args = hasPayload
      ? [fullPath, payloadArg]
      : [fullPath];

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

module.exports = BaseClient;
