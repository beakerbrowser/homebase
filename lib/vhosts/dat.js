const express = require('express')
const serveDir = require('serve-index')
const Dat = require('dat-node')
const chalk = require('chalk')
const metrics = require('../metrics')

var activeDats = {}

module.exports.start = function (vhostCfg, config) {
  var server = express()

  // start the dat
  if (!activeDats[vhostCfg.id]) {
    Dat(vhostCfg.storageDirectory, {key: vhostCfg.datKey}, (err, dat) => {
      if (err) {
        throw err
      }
      dat.joinNetwork()
      activeDats[vhostCfg.id] = dat
      metrics.trackDatStats(dat, vhostCfg)
    })
  }

  // setup the server routes
  server.use(metrics.hits(vhostCfg))
  server.use(metrics.respTime(vhostCfg))
  server.get('/.well-known/dat', function (req, res) {
    res.status(200).end('dat://' + vhostCfg.datKey + '/\nTTL=3600')
  })
  if (!config.httpMirror) {
    server.get('*', function (req, res) {
      res.redirect('dat://' + site.hostname + req.url)
    })
  } else {
    server.use(express.static(vhostCfg.storageDirectory, {extensions: ['html', 'htm']}))
    server.use(serveDir(vhostCfg.storageDirectory, {icons: true}));
  }

  // log
  console.log(`${chalk.bold(`Serving`)}
  ${vhostCfg.url}
  ${chalk.dim(`at`)} ${vhostCfg.hostnames.join(', ')}`)

  return server
}

module.exports.stop = function (vhostCfg) {
  if (activeDats[vhostCfg.id]) {
    activeDats[vhostCfg.id].close()
    activeDats[vhostCfg.id] = null
  }

  // log
  console.log(`${chalk.bold(`Stopped serving`)} ${vhostCfg.url}`)
}