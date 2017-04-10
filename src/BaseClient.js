'use strict';

const ms = require('ms');
const {parse, format} = require('url');
const querystring = require('querystring');
const {createJsonClient} = require('restify-clients');
const lodash = require('lodash');
const {GanomedeError} = require('ganomede-errors');

const SUPPORTED_METHODS = ['get', 'head', 'post', 'put', 'patch', 'delete'];
const SUPPORTS_BODY = ['post', 'put', 'patch'];

class BaseClient {
  constructor (baseUrl, optionsOverwrites = {}) {
    const {pathPrefix, apiOptions} = BaseClient.parseConstructorOptions(baseUrl, optionsOverwrites);

    this.pathPrefix = pathPrefix;
    this.api = createJsonClient(apiOptions);
  }

  _checkArgs ({method, path, headers, body, qs}) {
    const Ctor = BaseClient.RequestSpecError;

    if (!SUPPORTED_METHODS.includes(method))
      throw new Ctor('`method` argument must be one of `%j`, got `%j`', SUPPORTED_METHODS, method);

    if ((typeof path !== 'string') || (path.length < 1))
      throw new Ctor('`path` argument must be non-empty string, got `%j`', path);

    if (!SUPPORTS_BODY.includes(method) && (body !== null))
      throw new Ctor('`%s` does not support body: `%j` passed in, expected `null` (use `qs` param instead)', method, body);
  }

  apiCall ({method, path, headers = {}, body = null, qs = null}, callback) {
    this._checkArgs({method, path, headers, body, qs});

    const formattedQs = qs ? `?${querystring.stringify(qs)}` : '';
    const args = [{
      path: this.pathPrefix + path + formattedQs,
      headers
    }];

    if (body)
      args.push(body);

    return this.api[method](...args, (err, req, res, obj) => {
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
  retry: {
    minTimeout: ms('1 second'),
    maxTimeout: ms('5 seconds'),
    retries: 3
  },

  headers: {
    'accept': 'application/json',
    'accept-encoding': 'gzip,deflate'
  }
};

BaseClient.RequestSpecError = class RequestSpecError extends GanomedeError {};

module.exports = BaseClient;
