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
const EventEmitter = require('events')
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

class HomebaseConfig {
  constructor (configPath = false) {
    this.events = new EventEmitter()

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

  readFromFile (configPath = false) {
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

    this.events.emit('read-config')
  }

  writeToFile (configPath = false) {
    configPath = configPath || this.configPath
    fs.writeFileSync(configPath, yaml.safeDump(this.canonical, {skipInvalid: true}))
    this.events.emit('wrote-config')
  }

  addDat (datCfg) {
    // make sure it doesnt already exist
    var datKey = getDatKey(datCfg.url)
    var oldDatCfg = this.canonical.dats.find(d => getDatKey(d.url) === datKey)
    if (oldDatCfg) return
    // add
    this.canonical.dats.push(datCfg)
    // write
    this.writeToFile()
  }

  updateDat (datKey, datCfg) {
    // find the old dat
    var oldDatCfg = this.canonical.dats.find(d => getDatKey(d.url) === datKey)
    if (!oldDatCfg) return
    // update
    oldDatCfg.url = datCfg.url
    if (datCfg.domains) {
      oldDatCfg.domains = datCfg.domains
    } else {
      delete oldDatCfg.domains
    }
    // write
    this.writeToFile()
  }

  removeDat (datKey) {
    // remove
    this.canonical.dats = this.canonical.dats.filter(d => getDatKey(d.url) !== datKey)
    // write
    this.writeToFile()
  }

  get directory () {
    return untildify(this.canonical.directory || DEFAULT_CONFIG_DIRECTORY)
  }

  get hyperspaceDirectory () {
    return path.join(this.directory, 'hyperspace')
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

  get webapiDomain () {
    return this.webapi ? this.webapi.domain : false
  }

  get hyperdrives () {
    return this.canonical.hyperdrives ? this.canonical.hyperdrives.map(v => new HomebaseHyperdriveConfig(v, this)) : []
  }

  get proxies () {
    return this.canonical.proxies ? this.canonical.proxies.map(v => new HomebaseProxyConfig(v, this)) : []
  }

  get redirects () {
    return this.canonical.redirects ? this.canonical.redirects.map(v => new HomebaseRedirectConfig(v, this)) : []
  }

  get allVhosts () {
    return this.hyperdrives.concat(this.proxies).concat(this.redirects)
  }

  get hostnames () {
    return _flatten(this.allVhosts.map(vhostCfg => vhostCfg.hostnames)).filter(Boolean)
  }
}

class HomebaseHyperdriveConfig {
  constructor (canonical, config) {
    for (var k in canonical) {
      this[k] = canonical[k]
    }
    this.config = config
  }

  get id () {
    return 'hyperdrive-' + this.hyperdriveKey
  }

  get vhostType () {
    return 'hyperdrive'
  }

  get hyperdriveKey () {
    return getHyperdriveKey(this.url)
  }

  get hostnames () {
    return this.domains || []
  }

  get additionalUrls () {
    var urls = []
    this.hostnames.forEach(hostname => {
      if (this.config.httpMirror) {
        urls.push('https://' + hostname)
      }
    })
    return urls
  }

  get storageDirectory () {
    return path.join(this.config.directory, this.hyperdriveKey)
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

function getHyperdriveKey (url) {
  return /^(hyper:\/\/)?([0-9a-f]{64})\/?$/i.exec(url)[2]
}

function validateHyperdriveCfg (hyperdrive, config) {
  // regular attributes
  check(hyperdrive && typeof hyperdrive === 'object', 'hyperdrives.* must be an object, see https://github.com/beakerbrowser/homebase/tree/master#hyperdrives', hyperdrive)
  hyperdrive.domains = (!hyperdrive.domains || Array.isArray(hyperdrive.domains)) ? hyperdrive.domains : [hyperdrive.domains]
  check(isHyperdriveUrl(hyperdrive.url), 'hyperdrives.*.url must be a valid hyperdrive url, see https://github.com/beakerbrowser/homebase/tree/master#hyperdrivesurl', hyperdrive.url, 'invalidUrl')

  // aliases
  if (hyperdrive.domain && !hyperdrive.domains) {
    hyperdrive.domains = hyperdrive.domain
    delete hyperdrive.domain
    hyperdrive.domains = Array.isArray(hyperdrive.domains) ? hyperdrive.domains : [hyperdrive.domains]
  }

  // regular attributes
  if (hyperdrive.domains) {
    hyperdrive.domains.forEach(domain => {
      check(isDomain(domain), 'hyperdrives.*.domains.* must be domain names, see https://github.com/beakerbrowser/homebase/tree/master#hyperdrivesdomains', domain, 'invalidDomain')
    })
  }
}

module.exports = {
  HomebaseConfig,
  HomebaseProxyConfig,
  HomebaseRedirectConfig
}

// internal methods
// =

function validate (config) {
  // deprecated attributes
  if ('domain' in config) {
    console.log('FYI, the domain attribute in your homebase.yml was deprecated in v2.0.0. See https://github.com/beakerbrowser/homebase/tree/master#v200')
    check(typeof config.domain === 'string', 'domain must be a string, see https://github.com/beakerbrowser/homebase/tree/master#domain')
    if (config.webapi && !config.webapi.domain) {
      config.webapi.domain = config.domain
    }
  }

  if ('directory' in config) check(typeof config.directory === 'string', 'directory must be a string, see https://github.com/beakerbrowser/homebase/tree/master#directory')
  if ('httpMirror' in config) check(typeof config.httpMirror === 'boolean', 'httpMirror must be true or false, see https://github.com/beakerbrowser/homebase/tree/master#httpmirror')
  if ('ports' in config) check(config.ports && typeof config.ports === 'object', 'ports must be an object containing .http and/or .https, see https://github.com/beakerbrowser/homebase/tree/master#ports')
  if ('ports' in config && 'http' in config.ports) check(typeof config.ports.http === 'number', 'ports.http must be a number, see https://github.com/beakerbrowser/homebase/tree/master#portshttp')
  if ('ports' in config && 'https' in config.ports) check(typeof config.ports.https === 'number', 'ports.https must be a number, see https://github.com/beakerbrowser/homebase/tree/master#portshttp')
  if ('letsencrypt' in config) check(typeof config.letsencrypt === 'object' || config.letsencrypt === false, 'letsencrypt must be an object or false, see https://github.com/beakerbrowser/homebase/tree/master#letsencrypt')
  if (config.letsencrypt) check(typeof config.letsencrypt.email === 'string', 'letsencrypt.email must be specified, see https://github.com/beakerbrowser/homebase/tree/master#letsencryptemail')
  if (config.letsencrypt) check(config.letsencrypt.agreeTos === true, 'letsencrypt.agreeTos must be true (you must agree to the Lets Encrypt terms of service) see https://github.com/beakerbrowser/homebase/tree/master#letsencryptagreetos')
  if ('dashboard' in config) check(typeof config.dashboard === 'object' || config.dashboard === false, 'dashboard must be an object or false, see https://github.com/beakerbrowser/homebase/tree/master#dashboard')
  if (config.dashboard && 'port' in config.dashboard) check(typeof config.dashboard.port === 'number', 'dashboard.port must be a number, see https://github.com/beakerbrowser/homebase/tree/master#dashboardport')
  if ('webapi' in config) check(typeof config.webapi === 'object' || config.webapi === false, 'webapi must be an object or false, see https://github.com/beakerbrowser/homebase/tree/master#webapi')
  if (config.webapi) check(typeof config.webapi.username === 'string', 'webapi.username must be specified, see https://github.com/beakerbrowser/homebase/tree/master#webapiusername')
  if (config.webapi) check(typeof config.webapi.password === 'string', 'webapi.password must be specified, see https://github.com/beakerbrowser/homebase/tree/master#webapipassword')
  if (config.webapi) check(!config.webapi.domain || typeof config.webapi.domain === 'string', 'webapi.domain must be a string, see https://github.com/beakerbrowser/homebase/tree/master#webapidomain')
  if (config.hyperdrives) {
    config.hyperdrives = Array.isArray(config.hyperdrives) ? config.hyperdrives : [config.hyperdrives]
    config.hyperdrives.forEach(hyperdriveCfg => validateHyperdriveCfg(hyperdriveCfg, config))
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
  if (config.letsencrypt && config.webapi) {
    check(typeof config.webapi.domain === 'string', 'webapi.domain must be specified if using letsencrypt, see https://github.com/beakerbrowser/homebase/tree/master#webapidomain')
  }
}

function check (assertion, error, value, errorKey) {
  if (!assertion) {
    var err = new ConfigError(error)
    err.value = value
    if (errorKey) {
      err[errorKey] = true
    }
    throw err
  }
}

function isHyperdriveUrl (str) {
  if (typeof str !== 'string') return false
  return /^(hyper:\/\/)?([0-9a-f]{64})\/?$/i.test(str)
}
