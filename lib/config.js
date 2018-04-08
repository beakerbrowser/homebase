const os = require('os')
const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')
const isDomain = require('is-domain-name')
const isOrigin = require('is-http-url')
const {ConfigError} = require('./errors')

const DEFAULT_CONFIG_DIRECTORY = path.join(os.homedir(), '.homebase')

// exported api
// =

module.exports = function readConfig (configPath) {
  var config
  var configContents

  // read file
  try {
    configContents = fs.readFileSync(configPath, 'utf8')
  } catch (e) {
    console.error('Failed to load config file at', configPath)
    throw e
  }

  // parse
  try {
    config = yaml.safeLoad(configContents)
  } catch (e) {
    console.error('Failed to parse config file at', configPath)
    throw e
  }
  config = config || {}

  // validate
  config.configPath = configPath
  if ('directory' in config) check(typeof config.directory === 'string', 'directory must be a string, see https://github.com/beakerbrowser/homebase/tree/master#directory')
  if ('domain' in config) check(typeof config.domain === 'string', 'domain must be a string, see https://github.com/beakerbrowser/homebase/tree/develop#domain')
  if ('httpMirror' in config) check(typeof config.httpMirror === 'boolean', 'httpMirror must be true or false, see https://github.com/beakerbrowser/homebase/tree/develop#httpmirror')
  if ('ports' in config) check(config.ports && typeof config.ports === 'object', 'ports must be an object containing .http and/or .https, see https://github.com/beakerbrowser/homebase/tree/develop#ports')
  if ('ports' in config && 'http' in config.ports) check( typeof config.ports.http === 'number', 'ports.http must be a number, see https://github.com/beakerbrowser/homebase/tree/develop#portshttp')
  if ('ports' in config && 'https' in config.ports) check(typeof config.ports.https === 'number', 'ports.https must be a number, see https://github.com/beakerbrowser/homebase/tree/develop#portshttp')
  if ('letsencrypt' in config) check(typeof config.letsencrypt === 'object' || config.letsencrypt === false, 'letsencrypt must be an object or false, see https://github.com/beakerbrowser/homebase/tree/develop#letsencrypt')
  if (config.letsencrypt) check(typeof config.letsencrypt.email === 'string', 'letsencrypt.email must be specified, see https://github.com/beakerbrowser/homebase/tree/develop#letsencryptemail')
  if (config.letsencrypt) check(config.letsencrypt.agreeTos === true, 'letsencrypt.agreeTos must be true (you must agree to the Lets Encrypt terms of service) see https://letsencrypt.org/repository/')
  if ('dashboard' in config) check(typeof config.dashboard === 'object' || config.dashboard === false, 'dashboard must be an object or false, see https://github.com/beakerbrowser/homebase/tree/develop#dashboard')
  if (config.dashboard && 'port' in config.dashboard) check(typeof config.dashboard.port === 'number', 'dashboard.port must be a number, see https://github.com/beakerbrowser/homebase/tree/develop#dashboardport')
  if ('webapi' in config) check(typeof config.webapi === 'object' || config.webapi === false, 'webapi must be an object or false, see https://github.com/beakerbrowser/homebase/tree/develop#webapi')
  if (config.webapi) check(typeof config.webapi.username === 'string', 'webapi.username must be specified, see https://github.com/beakerbrowser/homebase/tree/develop#webapiusername')
  if (config.webapi) check(typeof config.webapi.password === 'string', 'webapi.password must be specified, see https://github.com/beakerbrowser/homebase/tree/develop#webapipassword')
  if (config.dats) {
    config.dats = Array.isArray(config.dats) ? config.dats : [config.dats]
    config.dats.forEach(dat => {
      dat.otherDomains = (!dat.otherDomains || Array.isArray(dat.otherDomains)) ? dat.otherDomains : [dat.otherDomains]
      check(dat && typeof dat === 'object', 'dats.* must be an object, see https://github.com/beakerbrowser/homebase/tree/develop#dats', dat)
      check(isDatUrl(dat.url), 'dats.*.url must be a valid dat url, see https://github.com/beakerbrowser/homebase/tree/develop#datsurl', dat.url)
      check(typeof dat.name === 'string', 'dats.*.name must be specified, see https://github.com/beakerbrowser/homebase/tree/develop#datsname', dat.name)
      if (dat.otherDomains) {
        dat.otherDomains.forEach(domain => {
          check(isDomain(domain), 'dats.*.otherDomains.* must be domain names, see https://github.com/beakerbrowser/homebase/tree/develop#datsotherdomains', domain)
        })
      }
    })
  }
  if (config.proxies) {
    config.proxies = Array.isArray(config.proxies) ? config.proxies : [config.proxies]
    config.proxies.forEach(proxy => {
      check(isDomain(proxy.from), 'proxies.*.from must be a domain name, see https://github.com/beakerbrowser/homebase/tree/develop#proxiesfrom', proxy.from)
      check(isOrigin(proxy.to), 'proxies.*.to must be a target origin, see https://github.com/beakerbrowser/homebase/tree/develop#proxiesto', proxy.to)
    })
  }
  if (config.redirects) {
    config.redirects = Array.isArray(config.redirects) ? config.redirects : [config.redirects]
    config.redirects.forEach(redirect => {
      check(isDomain(redirect.from), 'redirects.*.from must be a domain name, see https://github.com/beakerbrowser/homebase/tree/develop#redirectsfrom', redirect.from)
      check(isOrigin(redirect.to), 'redirects.*.to must be a target origin, see https://github.com/beakerbrowser/homebase/tree/develop#redirectsto', redirect.to)
    })
  }

  // defaults
  config.directory = config.directory || DEFAULT_CONFIG_DIRECTORY
  config.domain = config.domain || undefined
  config.httpMirror = config.httpMirror || false
  config.ports = config.ports || {}
  config.ports.http = config.ports.http || 80
  config.ports.https = config.ports.https || 443
  config.letsencrypt = config.letsencrypt || false
  config.dashboard = config.dashboard || false
  config.webapi = config.webapi || false
  config.dats = config.dats || []
  config.proxies = config.proxies || []
  config.redirects = config.redirects || []

  return config
}

// internal helpers
// =

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
