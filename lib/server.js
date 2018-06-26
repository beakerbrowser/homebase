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
var activeRouter
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

 ${BULLET} Directory:    ${config.directory}
 ${BULLET} Ports:        ${config.ports.http} ${chalk.dim('(HTTP)')} ${config.ports.https} ${chalk.dim('(HTTPS)')}
 ${BULLET} HTTP mirror:  ${config.httpMirror ? ENABLED : DISABLED}
 ${BULLET} Lets Encrypt: ${config.letsencrypt ? ENABLED : DISABLED}
 ${BULLET} Dashboard:    ${config.dashboard ? ENABLED : DISABLED}
 ${BULLET} WebAPI:       ${config.webapi ? ENABLED : DISABLED} ${config.webapi ? config.webapi.domain : ''}
`)

  // create server app
  app = express()
  exports.configure(config)
  app.use(function (req, res, next) {
    activeRouter(req, res, next)
  })
  app.use((err, req, res, next) => {
    console.log(err)
    res.status(500).end()
  })

  // start server
  if (config.letsencrypt) {
    server = greenlockExpress.create({
      server: IS_DEBUG ? 'https://acme-staging-v02.api.letsencrypt.org/directory' : 'https://acme-v02.api.letsencrypt.org/directory',
      version: 'v02',
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
  var watcher
  if (config.configPath) {
    var prevTime = 0
    watcher = fs.watch(config.configPath, function () {
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
  }

  return {
    config,
    close: cb => {
      if (watcher) watcher.close()
      server.close(cb)
    }
  }
}

exports.configure = function (config) {
  // create a new router
  activeRouter = express.Router()

  // add vhosts
  config.allVhosts.forEach(vhostCfg => {
    var vhostServer = vhostMethods[vhostCfg.vhostType].start(vhostCfg, config)
    vhostCfg.hostnames.forEach(hostname => activeRouter.use(vhost(hostname, vhostServer)))
  })

  // add web api
  if (config.webapi) {
    activeRouter.use(webapi.create(config))
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

