'use strict';

const url = require('url');
const {JsonClient} = require('restify-clients');
const BaseClient = require('../src/BaseClient');
const fixtures = require('./fixtures');

describe('BaseClient', () => {
  before(fixtures.startServer);
  after(fixtures.stopServer);

  it('new BaseClient()', () => {
    const client = new BaseClient('https://127.0.0.1:3000/a/b/c');
    expect(client).to.be.instanceof(BaseClient);
    expect(client.api).to.be.instanceof(JsonClient);
    expect(client.api.url).to.be.eql(url.parse('https://127.0.0.1:3000'));
    expect(client.pathPrefix).to.equal('/a/b/c');
  });

  describe('#apiCall()', () => {
    it('prefixes path and expands query string', (done) => {
      const client = new BaseClient('https://127.0.0.1:3000/api/v1');
      td.replace(client.api, 'get', td.function());

      td.when(client.api.get(td.matchers.contains({path: '/api/v1/resource?arg=is%20nice'}), td.callback))
        .thenCallback(null, {}, {}, {result: true});

      client.apiCall({method: 'get', path: '/resource', qs: {arg: 'is nice'}}, (err, obj) => {
        expect(err).to.be.null;
        expect(obj).to.eql({result: true});
        done();
      });
    });

    it('passes in headers specified', (done) => {
      const client = new BaseClient('https://127.0.0.1:3000/api/v1');
      td.replace(client.api, 'get', td.function());

      td.when(client.api.get(td.matchers.contains({headers: {'X-Tra': 'header'}}), td.callback))
        .thenCallback(null, {}, {}, {ok: true});

      client.apiCall({method: 'get', path: '/', headers: {'X-Tra': 'header'}}, done);
    });

    describe('GET', () => {
      it('throws if body is not null', () => {
        const client = new BaseClient('https://localhost');
        const call = () => client.apiCall({method: 'get', body: 'something'});
        expect(call).to.throw(BaseClient.RequestSpecError, 'does not support body');
      });
    });

    describe('POST', () => {
      it('supports body', (done) => {
        const client = new BaseClient('https://127.0.0.1:3000/api/v1');
        td.replace(client.api, 'post', td.function());

        td.when(client.api.post(td.matchers.contains({path: '/api/v1/resource'}), {payload: true}, td.callback))
          .thenCallback(null, {}, {}, {result: true});

        client.apiCall({method: 'post', path: '/resource', body: {payload: true}}, (err, obj) => {
          expect(err).to.be.null;
          expect(obj).to.eql({result: true});
          done();
        });
      });
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
        const {retry} = f('https://host/', {retry: {tries: 3}}).apiOptions;
        expect(retry).to.eql({tries: 3});
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
