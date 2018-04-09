var prom = require('prom-client')
var http = require('http')
var responseTime = require('response-time')

var metric = {
  https_hits: new prom.Counter({name: 'app_https_hits', help: 'Number of https requests received', labelNames: ['hostname', 'path']}),
  respTime: new prom.Summary({name: 'app_https_response_time_ms', help: 'Response time in ms', labelNames: ['hostname', 'path']}),
  datUploadSpeed: new prom.Gauge({name: 'app_dat_upload_speed', help: 'Bytes uploaded per second', labelNames: ['dat']}),
  datDownloadSpeed: new prom.Gauge({name: 'app_dat_download_speed', help: 'Bytes downloaded per second', labelNames: ['dat']}),
  datPeers: new prom.Gauge({name: 'app_dat_peers', help: 'Number of peers on the network', labelNames: ['dat']}),
}

module.exports = {hits: hits, respTime: respTime, trackDatStats: trackDatStats, getMetrics: getMetrics}

function hits (vhostCfg) {
  return function (req, res, next) {
    metric.https_hits.inc({hostname: vhostCfg.id, path: req.path})

    next()
  }
}

function respTime (vhostCfg) {
  return responseTime(function (req, res, time) {
    metric.respTime.labels(vhostCfg.id, req.path).observe(time)
  })
}

function trackDatStats (dat, vhostCfg) {
  var stats = dat.trackStats()
  setInterval(function () {
    metric.datUploadSpeed.labels(vhostCfg.id).set(stats.network.uploadSpeed)
    metric.datDownloadSpeed.labels(vhostCfg.id).set(stats.network.downloadSpeed)
    if (typeof stats.peers === 'number') {
      metric.datPeers.labels(vhostCfg.id).set(stats.peers.total || 0)
    }    
  }, 500)
}

function getMetrics () {
  return prom.register.metrics()
}