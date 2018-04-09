const express = require('express')
const chalk = require('chalk')

module.exports.start = function (vhostCfg, config) {
  var server = express()

  server.all('*', function (req, res) {
    res.redirect(vhostCfg.to + req.url)
  })

  // log
  console.log(`${chalk.bold(`Redirecting`)} ${chalk.dim(`from`)} ${vhostCfg.from} ${chalk.dim(`to`)} ${vhostCfg.to}`)

  return server
}

module.exports.stop = function (vhostCfg) {
  // log
  console.log(`${chalk.bold(`Stopped redirecting`)} ${chalk.dim(`from`)} ${vhostCfg.from} ${chalk.dim(`to`)} ${vhostCfg.to}`)
}
