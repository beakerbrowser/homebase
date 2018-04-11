const path = require('path')
const http = require('http')
const fs = require('fs')
const express = require('express')
const vhost = require('vhost')
const greenlockExpress = require('greenlock-express')
const mkdirp = require('mkdirp')
const figures = require('figures')
const chalk = require('chalk')
const metrics = require('./metrics')
const webapi = require('./webapi')
const approveDomains = require('./lets-encrypt').approveDomains
const vhostMethods = {
  dat: require('./vhosts/dat'),
  proxy: require('./vhosts/proxy'),
  redirect: require('./vhosts/redirect')
}
const packageJson = require('../package.json')

// constants
// =

const IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)
const ENABLED = chalk.green(figures.tick + ' enabled')
const DISABLED = chalk.red(figures.cross + ' disabled')
const BULLET = chalk.dim(figures.play)

// globals
// =

var app
var metricsServer

// exported api
// =

exports.start = function (config, cb) {
  var server

  // ensure the data dirs exist
  mkdirp.sync(config.directory)
  config.dats.forEach(dat => mkdirp.sync(dat.storageDirectory))

  // log
  console.log(`
${chalk.bold(`== Homebase ${packageJson.version} ==`)}

 ${BULLET} Hostname:     ${config.domain}
 ${BULLET} Directory:    ${config.directory}
 ${BULLET} Ports:        ${config.ports.http} ${chalk.dim('(HTTP)')} ${config.ports.https} ${chalk.dim('(HTTPS)')}
 ${BULLET} HTTP mirror:  ${config.httpMirror ? ENABLED : DISABLED}
 ${BULLET} Lets Encrypt: ${config.letsencrypt ? ENABLED : DISABLED}
 ${BULLET} Dashboard:    ${config.dashboard ? ENABLED : DISABLED}
 ${BULLET} WebAPI:       ${config.webapi ? ENABLED : DISABLED}
`)

  // create server app
  app = express()
  app.activeVhostCfgs = [] // used to track active vhosts
  exports.configure(config)

  app.use((err, req, res, next) => {
    console.log(err)
    res.status(500).end()
  })

  // start server
  if (config.letsencrypt) {
    server = greenlockExpress.create({
      server: IS_DEBUG ? 'staging' : 'https://acme-v01.api.letsencrypt.org/directory',
      debug: IS_DEBUG,
      approveDomains: approveDomains(config),
      store: require('le-store-certbot').create({
        configDir: path.join(config.directory, 'letsencrypt', 'etc'),
        workDir: path.join(config.directory, 'letsencrypt', 'var', 'lib'),
        logsDir: path.join(config.directory, 'letsencrypt', 'var', 'log')
      }),
      app: app
    }).listen(config.ports.http, config.ports.https)
  } else {
    server = http.createServer(app)
    server.listen(config.ports.http)
  }
  server.on('error', function (err) {
    if (err.code === 'EACCES') {
      console.error(chalk.red(`ERROR: Failed to bind to ${chalk.bold(`port ${err.port}`)} (EACCES)

Make sure the ${chalk.bold(`port is not in use`)} and that you ${chalk.bold(`have permission`)} to use it.
See ${chalk.underline(`https://github.com/beakerbrowser/homebase/tree/master#port-setup`)}`))
      process.exit(1)
    }
    throw err
  })
  if (cb) {
    server.once('listening', cb)
  }

  // watch the config file for changes
  var prevTime = 0
  var watcher = fs.watch(config.configPath, function () {
    fs.lstat(config.configPath, function (_, st) {
      var now = Date.now()
      if (now - prevTime > 100) {
        console.log(`\nDetected change to ${config.configPath}, reloading...\n`)
        config.readFromFile()
        exports.configure(config)
      }
      prevTime = now
    })
  })

  return {
    config,
    close: cb => {
      watcher.close()
      server.close(cb)
    }
  }
}

exports.configure = function (config) {
  // disable all removed vhosts
  app.activeVhostCfgs.forEach(vhostCfg => {
    if (!config.isActiveVhost(vhostCfg.checksum)) {
      removeVhost(vhostCfg, config)
    }
  })

  // enable all new vhosts
  config.allVhosts.forEach(vhostCfg => {
    let vhostChecksum = vhostCfg.checksum
    if (!app.activeVhostCfgs.find(v => v.checksum === vhostChecksum)) {
      addVhost(vhostCfg, config)
    }
  })

  // web api
  unuse(/*TODO*/)
  if (config.webapi) {
    app.use(webapi.create(config))
  }

  // metrics server
  if (metricsServer) {
    metricsServer.close()
    metricsServer = null
  }
  if (config.dashboard) {
    metricsServer = http.createServer((req, res) => res.end(metrics.getMetrics()))
    metricsServer.listen(config.dashboard.port)
  }
}

// internal methods
// =

function addVhost (vhostCfg, config) {
  // add to active vhosts
  var vhostServer = vhostMethods[vhostCfg.vhostType].start(vhostCfg, config)
  vhostCfg.hostnames.forEach(hostname => app.use(vhost(hostname, vhostServer)))

  // add to tracking list
  app.activeVhostCfgs.push(vhostCfg)
}

function removeVhost (vhostCfg, config) {
  // remove from active vhosts
  vhostMethods[vhostCfg.vhostType].stop(vhostCfg, config)
  unuse(/*TODO*/)

  // remove from tracking list
  let vhostChecksum = vhostCfg.checksum
  app.activeVhostCfgs = app.activeVhostCfgs.filter(v => v.checksum !== vhostChecksum)
}

function unuse () {
  // TODO
}
