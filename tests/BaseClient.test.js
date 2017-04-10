'use strict';

const url = require('url');
const crypto = require('crypto');
const async = require('async');
const {JsonClient} = require('restify-clients');
const BaseClient = require('../src/BaseClient');
const fixtures = require('./fixtures');

describe('BaseClient', () => {
  it('new BaseClient()', () => {
    const client = new BaseClient('https://127.0.0.1:3000/a/b/c');
    expect(client).to.be.instanceof(BaseClient);
    expect(client.api).to.be.instanceof(JsonClient);
    expect(client.api.url).to.be.eql(url.parse('https://127.0.0.1:3000'));
    expect(client.pathPrefix).to.equal('/a/b/c');
  });

  describe('#apiCall()', () => {
    before(fixtures.startServer);
    after(fixtures.stopServer);

    const testApiCall = (options, assertFn, done) => {
      const {address, port} = fixtures.server.address();
      const client = new BaseClient(`http://${address}:${port}/test-prefix/v1`);

      client.apiCall(options, (err, reply) => {
        assertFn(err, reply);
        done();
      });
    };

    const nonCallable = () => { throw new Error('Must not be called'); };

    it('throws on missing method or path', () => {
      const client = new BaseClient('http://localhost');
      const call = ({method, path} = {}) => () => client.apiCall({method, path}, nonCallable);

      expect(call({path: '/'})).to.throw(
        BaseClient.RequestSpecError,
        /^`method` argument must be one of/
      );

      expect(call({method: 'oops', path: '/'})).to.throw(
        BaseClient.RequestSpecError,
        /^`method` argument must be one of/
      );

      expect(call({method: 'get'})).to.throw(
        BaseClient.RequestSpecError,
        /^`path` argument must be non-empty string/
      );
    });

    it('prefixes path', (done) => {
      testApiCall({method: 'get', path: '/resource'}, (err, reply) => {
        expect(err).to.be.null;
        expect(reply.path).to.equal('/test-prefix/v1/resource');
      }, done);
    });

    it('appends query string', (done) => {
      testApiCall({method: 'get', path: '/resource', qs: {yes: 'please!'}}, (err, reply) => {
        expect(err).to.be.null;
        expect(reply.query).to.eql({yes: 'please!'});
      }, done);
    });

    it('passes in headers specified', (done) => {
      testApiCall(
        {method: 'get', path: '/', headers: {'X-Tra': 'Stuff'}},
        (err, reply) => {
          expect(err).to.be.null;
          expect(reply.headers).to.contain({'x-tra': 'Stuff'});
          expect(reply.headers).to.not.eql({'x-tra': 'Stuff'});
        },
        done
      );
    });

    it('errors on non-200 codes', (done) => {
      testApiCall(
        {method: 'post', path: '/custom', body: {status: 404}},
        (err, reply) => expect(err).to.be.instanceof(Error),
        done
      );
    });

    it('retries to establish TCP connection with back off', (done) => {
      const bytes = crypto.randomBytes(16).toString('hex');
      const host = `${bytes}.some-wierd-unresovable-host.non-existent-tld`;
      const client = new BaseClient(`http://${host}:${18476}/`, {
        retry: {
          minTimeout: 1,
          maxTimeout: 50
        }
      });

      let nTries = 0;

      const call = client.apiCall({method: 'get', path: '/'}, (err, reply) => {
        expect(err).to.be.instanceof(Error);
        expect(err.code).to.equal('ENOTFOUND');
        expect(nTries).to.eql(3);
        done();
      });

      call.on('attempt', () => ++nTries);
    });

    it('GET, HEAD and DELETE throw if body is not null', () => {
      const client = new BaseClient('https://localhost');
      const call = (method) => () => client.apiCall({method, path: '/', body: 'oops'}, nonCallable);
      const test = (method) => expect(call(method)).to.throw(
        BaseClient.RequestSpecError,
        `\`${method}\` does not support body`
      );

      test('get');
      test('head');
      test('delete');
    });

    it('POST, PUT and PATCH support bodies', (done) => {
      const bodyRef = {some: 'nice', json: ['body', {'that is': 'not quite trivial'}, true]};
      const test = (method, cb) => testApiCall(
        {method, path: '/', body: bodyRef},
        (err, reply) => {
          expect(err).to.be.null;
          expect(reply.method).to.equal(method);
          expect(reply.body).to.eql(bodyRef);
        },
        cb
      );

      async.each(['post', 'put', 'patch'], test, done);
    });
  });

  describe('.parseConstructorOptions()', () => {
    const f = BaseClient.parseConstructorOptions;
    const bound = (...args) => () => BaseClient.parseConstructorOptions(...args);

    describe('pathPrefix', () => {
      it('correctly parses path prefix brom baseUrl correct', () => {
        expect(f('https://example.com').pathPrefix).to.equal('');
        expect(f('https://example.com/a').pathPrefix).to.equal('/a');
        expect(f('https://example.com/a/b').pathPrefix).to.equal('/a/b');
      });

      it('removes trailing slashes', () => {
        expect(f('https://example.com/').pathPrefix).to.equal('');
        expect(f('https://example.com///').pathPrefix).to.equal('');
        expect(f('https://example.com/a/').pathPrefix).to.equal('/a');
        expect(f('https://example.com/a/b/').pathPrefix).to.equal('/a/b');
      });

      it('throws on pathes with QS, hash, etc.', () => {
        expect(bound('http://host?q=s')).to.throw(Error, /^"Unclean" path is not supported/);
        expect(bound('http://host#hsh')).to.throw(Error, /^"Unclean" path is not supported/);
      });

      it('throws on invalid baseUrl', () => {
        expect(bound()).to.throw(TypeError, /^Parameter "url"/);
        expect(bound(null)).to.throw(TypeError, /^Parameter "url"/);
        expect(bound(42)).to.throw(TypeError, /^Parameter "url"/);
      });
    });

    describe('apiOptions', () => {
      it('uses defaults correctly', () => {
        expect(f('https://host').apiOptions).to.eql(Object.assign(
          {},
          BaseClient.defaultOptions,
          {url: 'https://host'}
        ));
      });

      it('url becomse protocol + hostname + port', () => {
        const actual = f('https://host/prefix').apiOptions;
        expect(actual).to.have.property('url', 'https://host');
      });

      it('options are extendable', () => {
        const actual = f('https://host', {something: true}).apiOptions;
        expect(actual).to.have.property('something', true);
      });

      it('options are overwritable', () => {
        const {retry} = f('https://host/', {retry: {retries: 5}}).apiOptions;
        expect(retry).to.eql({
          minTimeout: 1e3,
          maxTimeout: 5e3,
          retries: 5
        });
      });

      it('headers are merged', () => {
        const {headers} = f('https://host', {headers: {
          'accept-encoding': 'utf8',
          'X-More': 'Stuff'
        }}).apiOptions;

        expect(headers).to.have.property('accept-encoding', 'utf8');
        expect(headers).to.have.property('X-More', 'Stuff');
      });
    });
  });
});
