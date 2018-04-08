const test = require('ava')
const path = require('path')
const os = require('os')
const readConfig = require('../lib/config')

const scaffold = (name) => path.join(__dirname, 'scaffold', name)

test('sets defaults', t => {
  var cfg = readConfig(scaffold('empty.yml'))

  t.deepEqual(cfg, {
    configPath: scaffold('empty.yml'),
    directory: path.join(os.homedir(), '.homebase'),
    domain: undefined,
    httpMirror: false,
    ports: {http: 80, https: 443},
    letsencrypt: false,
    dashboard: false,
    webapi: false,
    dats: [],
    proxies: [],
    redirects: []
  })
})

test('full config test', t => {
  var cfg = readConfig(scaffold('full.yml'))

  t.deepEqual(cfg, {
    configPath: scaffold('full.yml'),
    directory: '~/.homebase',
    domain: 'foo.bar',
    httpMirror: true,
    ports: {
      http: 80,
      https: 443
    },
    letsencrypt: {
      email: 'bob@foo.com',
      agreeTos: true
    },
    dashboard: {port: 8089},
    webapi: {username: 'robert', password: 'hunter2'},
    dats: [
      {
        url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
        name: 'mysite',
        otherDomains: [
          'mysite.com',
          'my-site.com'
        ]
      },
      {
        url: '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
        name: 'othersite',
        otherDomains: ['othersite.com']
      }
    ],
    proxies: [
      {from: 'mysite.com', to: 'https://mysite.com/'},
      {from: 'foo.bar.edu', to: 'http://localhost:8080/'},
      {from: 'best-site-ever', to: 'http://127.0.0.1:123/'}
    ],
    redirects: [
      {from: 'mysite.com', to: 'https://mysite.com/'},
      {from: 'foo.bar.edu', to: 'http://localhost:8080/'},
      {from: 'best-site-ever', to: 'http://127.0.0.1:123/'}
    ]
  })
})

test('can do (mostly) everything disabled', t => {
  var cfg = readConfig(scaffold('everything-disabled.yml'))

  t.deepEqual(cfg, {
    configPath: scaffold('everything-disabled.yml'),
    directory: path.join(os.homedir(), '.homebase'),
    domain: undefined,
    httpMirror: false,
    ports: {http: 80, https: 443},
    letsencrypt: false,
    dashboard: false,
    webapi: false,
    dats: [],
    proxies: [],
    redirects: []
  })
})