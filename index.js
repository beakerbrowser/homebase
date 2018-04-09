#!/usr/bin/env node
const os = require('os')
const path = require('path')
const fs = require('fs')
const HomebaseConfig = require('./lib/config')
const server = require('./lib/server')

const defaultConfigPath = process.env.HOMEBASE_CONFIG || path.join(os.homedir(), '.homebase.yml')

const argv = require('yargs')
  .usage('homebase - Start a homebase server')
  .option('config', {
    describe: 'Path to the config file. If no path is given, the path to the config is looked up in the HOMEBASE_CONFIG environment variable. If this is not set, the config will be read from the default path ~/.homebase.yml.',
    default: defaultConfigPath,
  })
  .argv

// read config and start the server
var config = new HomebaseConfig(argv.config)
server.start(config)

// watch the config file for changes
var prev = null
var prevTime = 0
fs.watch(argv.config, function () {
  fs.lstat(argv.config, function (_, st) {
    var now = Date.now()
    if (now - prevTime > 2000) {
      console.log(`\nDetected change to ${argv.config}, reloading...\n`)
      config.readFromFile()
      server.configure(config)
    }
    prevTime = now
    prev = st
  })
})