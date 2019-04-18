const joinPaths = require('path').join
const express = require('express')
const Dat = require('dat-node')
const chalk = require('chalk')
const pda = require('pauls-dat-api')
const ScopedFS = require('scoped-fs')
const parseRange = require('range-parser')
const mime = require('../mime')
const metrics = require('../metrics')
const directoryListingPage = require('../directory-listing-page')

const DISALLOWED_HTTPS_READS = /^\/.dat(\/|$)/i

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
      res.redirect('dat://' + vhostCfg.hostnames[0] + req.url)
    })
  } else {
    server.use(createHttpMirror(vhostCfg))
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

// internal methods
// =

function createHttpMirror (vhostCfg) {
  return async function (req, res) {
    var respondError = (code, status) => {
      res.status(code)
      res.end(code + ' ' + status)
    }
    var fileReadStream
    var headersSent = false
    var cspHeader = ''

    // validate request
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return respondError(405, 'Method Not Supported')
    }

    // filters
    if (DISALLOWED_HTTPS_READS.test(req.path)) {
      return respondError(404, 'Not found')
    }

    // lookup dat
    var archiveFS = new ScopedFS(vhostCfg.storageDirectory)

    // read the manifest (it's needed in a couple places)
    var manifest
    try { manifest = await pda.readManifest(archiveFS) } catch (e) { manifest = null }

    // read manifest CSP
    if (manifest && manifest.content_security_policy && typeof manifest.content_security_policy === 'string') {
      cspHeader = manifest.content_security_policy
    }

    // lookup entry
    var statusCode = 200
    var entry
    var isFolder = req.path.endsWith('/')
    const tryStat = async (path) => {
      // handle percent-encoded paths
      path = decodeURI(path)
      // abort if we've already found it
      if (entry) return
      // apply the web_root config
      if (manifest && manifest.web_root) {
        if (path) {
          path = joinPaths(manifest.web_root, path)
        } else {
          path = manifest.web_root
        }
      }
      // attempt lookup
      try {
        entry = await pda.stat(archiveFS, path)
        entry.path = path
      } catch (e) {}
    }
    // detect if this is a folder without a trailing slash
    if (!isFolder) {
      await tryStat(req.path)
      if (entry && entry.isDirectory()) {
        res.set({Location: `${req.path || ''}/`})
        return res.status(303).end()
      }
    }
    entry = false
    // do actual lookup
    if (isFolder) {
      await tryStat(req.path + 'index.html')
      await tryStat(req.path + 'index.md')
      await tryStat(req.path)
    } else {
      await tryStat(req.path)
      await tryStat(req.path + '.html') // fallback to .html
    }

    // handle folder
    if (entry && entry.isDirectory()) {
      res.set({
        'Content-Type': 'text/html',
        'Content-Security-Policy': cspHeader,
        'Access-Control-Allow-Origin': '*'
      })
      if (req.method === 'HEAD') {
        return res.status(204).end()
      } else {
        return res.status(200).end(await directoryListingPage(archiveFS, req.path, manifest && manifest.web_root))
      }
    }

    // handle not found
    if (!entry) {
      // check for a fallback page
      if (manifest && manifest.fallback_page) {
        await tryStat(manifest.fallback_page)
      }
      if (!entry) {
        return respondError(404, 'File Not Found')
      }
    }

    // handle range
    res.set('Accept-Ranges', 'bytes')
    var range = req.headers.range && parseRange(entry.size, req.headers.range)
    if (range && range.type === 'bytes') {
      range = range[0] // only handle first range given
      statusCode = 206
      res.set('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + entry.size)
      res.set('Content-Length', range.end - range.start + 1)
    } else {
      if (entry.size) {
        res.set('Content-Length', entry.size)
      }
    }

    // caching if-match (not if range is used)
    const ETag = 'W/block-' + (entry.mtimeMs || +entry.mtime)
    if (statusCode === 200 && req.headers['if-none-match'] === ETag) {
      return res.status(304).end()
    }

    // fetch the entry and stream the response
    fileReadStream = archiveFS.createReadStream(entry.path, range)
    var dataStream = fileReadStream
      .pipe(mime.identifyStream(entry.path, mimeType => {
        // cleanup the timeout now, as bytes have begun to stream

        // send headers, now that we can identify the data
        headersSent = true
        res.set({
          'Content-Type': mimeType,
          'Content-Security-Policy': cspHeader,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60, must-revalidate',
          'ETag': ETag
        })

        if (req.method === 'HEAD') {
          dataStream.destroy() // stop reading data
          res.status(204).end()
        } else {
          res.status(statusCode)
          dataStream.pipe(res)
        }
      }))

    // handle empty files
    fileReadStream.once('end', () => {
      if (!headersSent) {
        res.set({
          'Content-Security-Policy': cspHeader,
          'Access-Control-Allow-Origin': '*'
        })
        res.status(200).end()
      }
    })

    // handle read-stream errors
    fileReadStream.once('error', () => {
      if (!headersSent) respondError(500, 'Failed to read file')
    })
  }
}
