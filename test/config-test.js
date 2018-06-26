const test = require('ava')
const path = require('path')
const os = require('os')
const {HomebaseConfig} = require('../lib/config')

const scaffold = (name) => path.join(__dirname, 'scaffold', name)
const DATADIR = path.join(os.homedir(), '.homebase')

test('empty config', t => {
  var cfg = new HomebaseConfig(scaffold('empty.yml'))

  t.deepEqual(cfg.canonical, {})
  t.deepEqual(cfg.configPath, scaffold('empty.yml'))
  t.deepEqual(cfg.directory, DATADIR)
  t.deepEqual(cfg.httpMirror, false)
  t.deepEqual(cfg.ports, {http: 80, https: 443})
  t.deepEqual(cfg.letsencrypt, false)
  t.deepEqual(cfg.dashboard, false)
  t.deepEqual(cfg.webapi, false)
  t.deepEqual(cfg.dats, [])
  t.deepEqual(cfg.proxies, [])
  t.deepEqual(cfg.redirects, [])
  t.deepEqual(cfg.hostnames, [])
})

test('full config test', t => {
  var cfg = new HomebaseConfig(scaffold('full.yml'))

  t.deepEqual(cfg.canonical, {
    directory: '~/.homebase',
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
    webapi: {domain: 'foo.bar', username: 'robert', password: 'hunter2'},
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
      {from: 'myproxy.com', to: 'https://mysite.com/'},
      {from: 'foo.proxy.edu', to: 'http://localhost:8080/'},
      {from: 'best-proxy-ever', to: 'http://127.0.0.1:123/'}
    ],
    redirects: [
      {from: 'myredirect.com', to: 'https://mysite.com'},
      {from: 'foo.redirect.edu', to: 'http://localhost:8080'},
      {from: 'best-redirect-ever', to: 'http://127.0.0.1:123'}
    ]
  })

  t.deepEqual(cfg.configPath, scaffold('full.yml'))
  t.deepEqual(cfg.directory, DATADIR)
  t.deepEqual(cfg.httpMirror, true)
  t.deepEqual(cfg.ports, {
    http: 80,
    https: 443
  })
  t.deepEqual(cfg.letsencrypt, {
    email: 'bob@foo.com',
    agreeTos: true
  })
  t.deepEqual(cfg.dashboard, {port: 8089})
  t.deepEqual(cfg.webapi, {username: 'robert', password: 'hunter2', domain: 'foo.bar'})
  t.deepEqual(extractDatCfg(cfg.dats[0]), {
    id: 'dat-1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03',
    vhostType: 'dat',
    url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
    name: 'mysite',
    otherDomains: [
      'mysite.com',
      'my-site.com'
    ],
    hostnames: ['mysite.foo.bar', 'mysite.com', 'my-site.com'],
    datKey: '1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03',
    storageDirectory: path.join(DATADIR, '1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03')
  })
  t.deepEqual(extractDatCfg(cfg.dats[1]), {
    id: 'dat-868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    vhostType: 'dat',
    url: '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    name: 'othersite',
    otherDomains: ['othersite.com'],
    hostnames: ['othersite.foo.bar', 'othersite.com'],
    datKey: '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    storageDirectory: path.join(DATADIR, '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f')
  })
  t.deepEqual(cfg.proxies.map(extractProxyCfg), [
    {id: 'proxy-myproxy.com', vhostType: 'proxy', hostnames: ['myproxy.com'], from: 'myproxy.com', to: 'https://mysite.com/'},
    {id: 'proxy-foo.proxy.edu', vhostType: 'proxy', hostnames: ['foo.proxy.edu'], from: 'foo.proxy.edu', to: 'http://localhost:8080/'},
    {id: 'proxy-best-proxy-ever', vhostType: 'proxy', hostnames: ['best-proxy-ever'], from: 'best-proxy-ever', to: 'http://127.0.0.1:123/'}
  ])
  t.deepEqual(cfg.redirects.map(extractRedirectCfg), [
    {id: 'redirect-myredirect.com', vhostType: 'redirect', hostnames: ['myredirect.com'], from: 'myredirect.com', to: 'https://mysite.com'},
    {id: 'redirect-foo.redirect.edu', vhostType: 'redirect', hostnames: ['foo.redirect.edu'], from: 'foo.redirect.edu', to: 'http://localhost:8080'},
    {id: 'redirect-best-redirect-ever', vhostType: 'redirect', hostnames: ['best-redirect-ever'], from: 'best-redirect-ever', to: 'http://127.0.0.1:123'}
  ])
  t.deepEqual(cfg.hostnames, ['foo.bar', 'mysite.foo.bar', 'mysite.com', 'my-site.com', 'othersite.foo.bar', 'othersite.com', 'myproxy.com', 'foo.proxy.edu', 'best-proxy-ever', 'myredirect.com', 'foo.redirect.edu', 'best-redirect-ever'])
})

test('can do (mostly) everything disabled', t => {
  var cfg = new HomebaseConfig(scaffold('everything-disabled.yml'))

  t.deepEqual(cfg.canonical, {
    httpMirror: false,
    letsencrypt: false,
    dashboard: false,
    webapi: false
  })
  t.deepEqual(cfg.configPath, scaffold('everything-disabled.yml'))
  t.deepEqual(cfg.directory, DATADIR)
  t.deepEqual(cfg.httpMirror, false)
  t.deepEqual(cfg.ports, {http: 80, https: 443})
  t.deepEqual(cfg.letsencrypt, false)
  t.deepEqual(cfg.dashboard, false)
  t.deepEqual(cfg.webapi, false)
  t.deepEqual(cfg.dats, [])
  t.deepEqual(cfg.proxies, [])
  t.deepEqual(cfg.redirects, [])
  t.deepEqual(cfg.hostnames, [])
})

function extractDatCfg (cfg) {
  return {
    id: cfg.id,
    vhostType: cfg.vhostType,
    hostnames: cfg.hostnames,
    datKey: cfg.datKey,
    storageDirectory: cfg.storageDirectory,
    url: cfg.url,
    name: cfg.name,
    otherDomains: cfg.otherDomains
  }
}

function extractProxyCfg (cfg) {
  return {
    id: cfg.id,
    vhostType: cfg.vhostType,
    hostnames: cfg.hostnames,
    from: cfg.from,
    to: cfg.to
  }
}

function extractRedirectCfg (cfg) {
  return {
    id: cfg.id,
    vhostType: cfg.vhostType,
    hostnames: cfg.hostnames,
    from: cfg.from,
    to: cfg.to
  }
}
