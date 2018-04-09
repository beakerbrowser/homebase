const express = require('express')
const chalk = require('chalk')
const proxy = require('http-proxy').createProxyServer()

module.exports.start = function (vhostCfg, config) {
  var server = express()

  server.all('*', function (req, res) {
    proxy.web(req, res, {target: vhostCfg.to})
  })

  // log
  console.log(`${chalk.bold(`Proxying`)} ${chalk.dim(`from`)} ${vhostCfg.from} ${chalk.dim(`to`)} ${vhostCfg.to}`)

  return server
}

module.exports.stop = function (vhostCfg) {
  // log
  console.log(`${chalk.bold(`Stopped proxying`)} ${chalk.dim(`from`)} ${vhostCfg.from} ${chalk.dim(`to`)} ${vhostCfg.to}`)
}