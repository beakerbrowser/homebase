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
  t.deepEqual(cfg.dashboard, false)
  t.deepEqual(cfg.hyperdrives, [])
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
    dashboard: {port: 8089},
    hyperdrives: [
      {
        url: 'hyper://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
        domains: [
          'mysite.com',
          'my-site.com'
        ]
      },
      {
        url: '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
        domains: ['othersite.com']
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
  t.deepEqual(cfg.dashboard, {port: 8089})
  t.deepEqual(extractHyperdriveCfg(cfg.hyperdrives[0]), {
    id: 'hyperdrive-1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03',
    vhostType: 'hyperdrive',
    url: 'hyper://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
    domains: [
      'mysite.com',
      'my-site.com'
    ],
    hostnames: ['mysite.com', 'my-site.com'],
    hyperdriveKey: '1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03'
  })
  t.deepEqual(extractHyperdriveCfg(cfg.hyperdrives[1]), {
    id: 'hyperdrive-868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    vhostType: 'hyperdrive',
    url: '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    domains: ['othersite.com'],
    hostnames: ['othersite.com'],
    hyperdriveKey: '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f'
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
  t.deepEqual(cfg.hostnames.slice().sort(), ['mysite.com', 'my-site.com', 'othersite.com', 'myproxy.com', 'foo.proxy.edu', 'best-proxy-ever', 'myredirect.com', 'foo.redirect.edu', 'best-redirect-ever'].sort())
})

test('can do (mostly) everything disabled', t => {
  var cfg = new HomebaseConfig(scaffold('everything-disabled.yml'))

  t.deepEqual(cfg.canonical, {
    httpMirror: false,
    dashboard: false,
  })
  t.deepEqual(cfg.configPath, scaffold('everything-disabled.yml'))
  t.deepEqual(cfg.directory, DATADIR)
  t.deepEqual(cfg.httpMirror, false)
  t.deepEqual(cfg.ports, {http: 80, https: 443})
  t.deepEqual(cfg.dashboard, false)
  t.deepEqual(cfg.hyperdrives, [])
  t.deepEqual(cfg.proxies, [])
  t.deepEqual(cfg.redirects, [])
  t.deepEqual(cfg.hostnames, [])
})

function extractHyperdriveCfg (cfg) {
  return {
    id: cfg.id,
    vhostType: cfg.vhostType,
    hostnames: cfg.hostnames,
    hyperdriveKey: cfg.hyperdriveKey,
    url: cfg.url,
    domains: cfg.domains
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
