/**

Homebase config

The main source of truth for homebase's config is the yaml file.
The user can change that yaml during operation and homebase will reload it and run the changes.

The user can also modify the active config using web apis.
In that case, we need to serialize the change back into the yaml file.
So that we change as little as possible, we maintain the values as given by the user ('canonical').
That way, when we write back to the yaml file, we don't write back a bunch of defaults.

The structure of this is the HomebaseConfig classes which wrap canonical.
They use getters to provide computed info and defaults.

NOTE: we should *not* modify config to avoid writing those edits back to the yaml!

*/

const os = require('os')
const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')
const untildify = require('untildify')
const isDomain = require('is-domain-name')
const isOrigin = require('is-http-url')
const _flatten = require('lodash.flatten')
const {ConfigError} = require('./errors')

const DEFAULT_CONFIG_DIRECTORY = path.join(os.homedir(), '.homebase')
const IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)

// exported api
// =

module.exports = class HomebaseConfig {
  constructor (configPath) {
    // where the config is loaded from
    this.configPath = null

    // `canonical` the canonical config
    // - reflects *only* the values that users set
    // - first read from the yaml file
    // - can then be updated by APIs
    // - *may* be slightly massaged so long as it won't annoy users
    this.canonical = {}

    if (configPath) {
      this.readFromFile(configPath)
    }
  }

  readFromFile (configPath) {
    configPath = configPath || this.configPath
    this.configPath = configPath
    var configContents

    // read file
    try {
      configContents = fs.readFileSync(configPath, 'utf8')
    } catch (e) {
      // throw if other than a not-found
      configContents = ''
      if (e.code !== 'ENOENT') {
        console.error('Failed to load config file at', configPath)
        throw e
      }
    }

    // parse
    try {
      this.canonical = yaml.safeLoad(configContents)
    } catch (e) {
      console.error('Failed to parse config file at', configPath)
      throw e
    }
    this.canonical = this.canonical || {}

    // validate
    validate(this.canonical)
  }

  writeToFile (configPath) {
    configPath = configPath || this.configPath
    // TODO
  }

  getVhost (id) {
    return this.allVhosts.find(v => v.id === id)
  }

  isActiveVhost (id) {
    return Boolean(this.getVhost(id))
  }

  get directory () {
    return untildify(this.canonical.directory || DEFAULT_CONFIG_DIRECTORY)
  }

  get domain () {
    if (!IS_DEBUG && !this.canonical.domain) {
      // only fallback to hostname if not debugging, otherwise tests will always fail
      return os.hostname()
    }
    return this.canonical.domain
  }

  get httpMirror () {
    return this.canonical.httpMirror || false
  }

  get ports () {
    var ports = this.canonical.ports || {}
    ports.http = ports.http || 80
    ports.https = ports.https || 443
    return ports
  }

  get letsencrypt () {
    return this.canonical.letsencrypt || false
  }

  get dashboard () {
    return this.canonical.dashboard || false
  }

  get webapi () {
    return this.canonical.webapi || false
  }

  get dats () {
    return this.canonical.dats ? this.canonical.dats.map(v => new HomebaseDatConfig(v, this)) : []
  }

  get proxies () {
    return this.canonical.proxies ? this.canonical.proxies.map(v => new HomebaseProxyConfig(v, this)) : []
  }

  get redirects () {
    return this.canonical.redirects ? this.canonical.redirects.map(v => new HomebaseRedirectConfig(v, this)) : []
  }

  get allVhosts () {
    return this.dats.concat(this.proxies).concat(this.redirects)
  }

  get hostnames () {
    return [this.domain].concat(_flatten(this.allVhosts.map(vhostCfg => vhostCfg.hostnames)))
  }
}

class HomebaseDatConfig {
  constructor (canonical, config) {
    for (var k in canonical) {
      this[k] = canonical[k]
    }
    this.__topDomain = config.domain
    this.__topDirectory = config.directory
  }

  get id () {
    return 'dat-' + this.datKey
  }

  get vhostType () {
    return 'dat'
  }

  get datKey () {
    return getDatKey(this.url)
  }

  get hostnames () {
    return [`${this.name}.${this.__topDomain}`].concat(this.otherDomains || [])
  }

  get storageDirectory () {
    return path.join(this.__topDirectory, this.datKey)
  }
}

class HomebaseProxyConfig {
  constructor (canonical, config) {
    for (var k in canonical) {
      this[k] = canonical[k]
    }
  }

  get id () {
    return 'proxy-' + this.from
  }

  get vhostType () {
    return 'proxy'
  }

  get hostnames () {
    return [this.from]
  }
}

class HomebaseRedirectConfig {
  constructor (canonical, config) {
    for (var k in canonical) {
      this[k] = canonical[k]
    }
  }

  get id () {
    return 'redirect-' + this.from
  }

  get vhostType () {
    return 'redirect'
  }

  get hostnames () {
    return [this.from]
  }
}

// internal methods
// =

function validate (config) {
  if ('directory' in config) check(typeof config.directory === 'string', 'directory must be a string, see https://github.com/beakerbrowser/homebase/tree/master#directory')
  if ('domain' in config) check(typeof config.domain === 'string', 'domain must be a string, see https://github.com/beakerbrowser/homebase/tree/master#domain')
  if ('httpMirror' in config) check(typeof config.httpMirror === 'boolean', 'httpMirror must be true or false, see https://github.com/beakerbrowser/homebase/tree/master#httpmirror')
  if ('ports' in config) check(config.ports && typeof config.ports === 'object', 'ports must be an object containing .http and/or .https, see https://github.com/beakerbrowser/homebase/tree/master#ports')
  if ('ports' in config && 'http' in config.ports) check( typeof config.ports.http === 'number', 'ports.http must be a number, see https://github.com/beakerbrowser/homebase/tree/master#portshttp')
  if ('ports' in config && 'https' in config.ports) check(typeof config.ports.https === 'number', 'ports.https must be a number, see https://github.com/beakerbrowser/homebase/tree/master#portshttp')
  if ('letsencrypt' in config) check(typeof config.letsencrypt === 'object' || config.letsencrypt === false, 'letsencrypt must be an object or false, see https://github.com/beakerbrowser/homebase/tree/master#letsencrypt')
  if (config.letsencrypt) check(typeof config.letsencrypt.email === 'string', 'letsencrypt.email must be specified, see https://github.com/beakerbrowser/homebase/tree/master#letsencryptemail')
  if (config.letsencrypt) check(config.letsencrypt.agreeTos === true, 'letsencrypt.agreeTos must be true (you must agree to the Lets Encrypt terms of service) see https://letsencrypt.org/repository/')
  if ('dashboard' in config) check(typeof config.dashboard === 'object' || config.dashboard === false, 'dashboard must be an object or false, see https://github.com/beakerbrowser/homebase/tree/master#dashboard')
  if (config.dashboard && 'port' in config.dashboard) check(typeof config.dashboard.port === 'number', 'dashboard.port must be a number, see https://github.com/beakerbrowser/homebase/tree/master#dashboardport')
  if ('webapi' in config) check(typeof config.webapi === 'object' || config.webapi === false, 'webapi must be an object or false, see https://github.com/beakerbrowser/homebase/tree/master#webapi')
  if (config.webapi) check(typeof config.webapi.username === 'string', 'webapi.username must be specified, see https://github.com/beakerbrowser/homebase/tree/master#webapiusername')
  if (config.webapi) check(typeof config.webapi.password === 'string', 'webapi.password must be specified, see https://github.com/beakerbrowser/homebase/tree/master#webapipassword')
  if (config.dats) {
    config.dats = Array.isArray(config.dats) ? config.dats : [config.dats]
    config.dats.forEach(dat => {
      dat.otherDomains = (!dat.otherDomains || Array.isArray(dat.otherDomains)) ? dat.otherDomains : [dat.otherDomains]
      check(dat && typeof dat === 'object', 'dats.* must be an object, see https://github.com/beakerbrowser/homebase/tree/master#dats', dat)
      check(isDatUrl(dat.url), 'dats.*.url must be a valid dat url, see https://github.com/beakerbrowser/homebase/tree/master#datsurl', dat.url)
      check(typeof dat.name === 'string', 'dats.*.name must be specified, see https://github.com/beakerbrowser/homebase/tree/master#datsname', dat.name)
      if (dat.otherDomains) {
        dat.otherDomains.forEach(domain => {
          check(isDomain(domain), 'dats.*.otherDomains.* must be domain names, see https://github.com/beakerbrowser/homebase/tree/master#datsotherdomains', domain)
        })
      }
    })
  }
  if (config.proxies) {
    config.proxies = Array.isArray(config.proxies) ? config.proxies : [config.proxies]
    config.proxies.forEach(proxy => {
      check(isDomain(proxy.from), 'proxies.*.from must be a domain name, see https://github.com/beakerbrowser/homebase/tree/master#proxiesfrom', proxy.from)
      check(isOrigin(proxy.to), 'proxies.*.to must be a target origin, see https://github.com/beakerbrowser/homebase/tree/master#proxiesto', proxy.to)
    })
  }
  if (config.redirects) {
    config.redirects = Array.isArray(config.redirects) ? config.redirects : [config.redirects]
    config.redirects.forEach(redirect => {
      check(isDomain(redirect.from), 'redirects.*.from must be a domain name, see https://github.com/beakerbrowser/homebase/tree/master#redirectsfrom', redirect.from)
      check(isOrigin(redirect.to), 'redirects.*.to must be a target origin, see https://github.com/beakerbrowser/homebase/tree/master#redirectsto', redirect.to)

      // remove trailing slash
      redirect.to = redirect.to.replace(/\/$/, '')
    })
  }
}

function check (assertion, error, value) {
  if (!assertion) {
    var err = new ConfigError(error)
    err.value = value
    throw err
  }
}

function isDatUrl (str) {
  if (typeof str !== 'string') return false
  return /^(dat:\/\/)?([0-9a-f]{64})\/?$/i.test(str)
}

function getDatKey (url) {
  return /^(dat:\/\/)?([0-9a-f]{64})\/?$/i.exec(url)[2]
}