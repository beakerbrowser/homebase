const fs = require('fs')
const tempy = require('tempy')
const request = require('request-promise-native')
const {start} = require('../lib/server.js')
const {HomebaseConfig} = require('../lib/config')

var portCounter = 10000

exports.createServer = function (configData) {
  var configPath = tempy.file({extension: 'yml'})
  fs.writeFileSync(configPath, configData)

  var config = new HomebaseConfig(configPath)
  config.canonical.ports = {
    http: ++portCounter,
    https: ++portCounter
  }

  var server = start(config)
  server.req = request.defaults({
    baseUrl: `http://127.0.0.1:${config.ports.http}`,
    resolveWithFullResponse: true,
    simple: false
  })

  return server
}
