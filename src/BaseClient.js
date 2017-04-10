'use strict';

const {parse, format} = require('url');
const querystring = require('querystring');
const {createJsonClient} = require('restify-clients');
const lodash = require('lodash');
const {GanomedeError} = require('ganomede-errors');

class BaseClient {
  constructor (baseUrl, optionsOverwrites = {}) {
    const {pathPrefix, apiOptions} = BaseClient.parseConstructorOptions(baseUrl, optionsOverwrites);

    this.pathPrefix = pathPrefix;
    this.api = createJsonClient(apiOptions);
  }

  apiCall ({method, path, body = null, qs = null}, callback) {
    const formattedQs = qs ? `?${querystring.stringify(qs)}` : '';
    const fullPath = this.pathPrefix + path + formattedQs;
    const bodySupported = (method === 'post') || (method === 'put');

    if (!bodySupported && (body !== null))
      throw new BaseClient.RequestSpecError('%s does not support body: `%j` passed in, expected `null` (use `qs` param instead)', method, body);

    const args = bodySupported
      ? [fullPath, body]
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

BaseClient.RequestSpecError = class RequestSpecError extends GanomedeError {};

module.exports = BaseClient;
