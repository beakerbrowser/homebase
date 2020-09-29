const express = require('express')
const HyperspaceClient = require('hyperspace/client')
const HyperspaceServer = require('hyperspace/server')
const hyperdrive = require('hyperdrive')
const chalk = require('chalk')
const parseRange = require('range-parser')
const mime = require('../mime')
const metrics = require('../metrics')
const directoryListingPage = require('../hyperdrive-directory-listing-page')

var hserver
var hclient
var hcorestore
var activeHyperdrives = {}

module.exports.start = async function (vhostCfg, config) {
  var server = express()

  await startHyperspace(config)

  // start the dat
  if (!activeHyperdrives[vhostCfg.id]) {
    activeHyperdrives[vhostCfg.id] = await loadDrive(vhostCfg.hyperdriveKey)
  }

  // setup the server routes
  server.use(metrics.hits(vhostCfg))
  server.use(metrics.respTime(vhostCfg))
  if (config.httpMirror) {
    server.use(createHttpMirror(vhostCfg))
  }

  // log
  console.log(`${chalk.bold(`Serving`)}\n  ${vhostCfg.url}`)
  if (vhostCfg.hostnames.length) {
    console.log(`  ${chalk.dim(`at`)} ${vhostCfg.hostnames.join(', ')}`)
  }

  return server
}

module.exports.stop = async function (vhostCfg) {
  if (activeHyperdrives[vhostCfg.id]) {
    await activeHyperdrives[vhostCfg.id].promises.close()
    activeHyperdrives[vhostCfg.id] = null
  }

  // log
  console.log(`${chalk.bold(`Stopped serving`)} ${vhostCfg.url}`)
}

// internal methods
// =

var startHyperspacePromise
function startHyperspace (config) {
  if (!startHyperspacePromise) {
    startHyperspacePromise = _startHyperspace(config)
  }
  return startHyperspacePromise
}

async function _startHyperspace (config) {
  const cleanup = async () => {
    console.log('Shutting down hyperspace, please wait...')
    if (hclient) await hclient.close()
    if (hserver) await hserver.close()
  }
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)

  hserver = new HyperspaceServer({
    host: 'homebase',
    storage: config.hyperspaceDirectory
  })
  await hserver.ready()

  hclient = new HyperspaceClient({ host: 'homebase' })
  await hclient.ready()
  hcorestore = hclient.corestore()
}

async function loadDrive (key) {
  const drive = hyperdrive(hcorestore, Buffer.from(key, 'hex'), {sparse: false, extension: false})
  await drive.promises.ready()
  await hclient.network.configure(drive.discoveryKey, { announce: true, lookup: true, flush: true })
  return drive
}

function createHttpMirror (vhostCfg) {
  return async function (req, res) {
    var respondError = (code, status) => {
      res.status(code)
      res.end(code + ' ' + status)
    }
    const respondRedirect = (url) => {
      res.redirect(url)
    }
    var cspHeader = ''

    // validate request
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return respondError(405, 'Method Not Supported')
    }

    var drive = activeHyperdrives[vhostCfg.id]
    if (!drive) {
      return respondError(500, 'Hyperdrive not loaded')
    }

    // parse path
    var filepath = req.path
    if (!filepath) filepath = '/'
    if (filepath.indexOf('?') !== -1) filepath = filepath.slice(0, filepath.indexOf('?')) // strip off any query params
    var hasTrailingSlash = filepath.endsWith('/')

    // read the manifest (it's needed in a couple places)
    var manifest
    try { manifest = JSON.parse(await drive.promises.readFile('index.json')) } catch (e) { manifest = null }

    // read manifest CSP
    if (manifest && manifest.csp && typeof manifest.csp === 'string') {
      cspHeader = manifest.csp
    }

    // lookup entry
    var headers = {}
    var entry = await resolvePath(drive, filepath, hasTrailingSlash, req.headers.accept || req.headers.Accept)

    // handle folder
    if (entry && entry.isDirectory()) {
      // make sure there's a trailing slash
      if (!hasTrailingSlash) {
        return respondRedirect(`${filepath || ''}/`)
      }

      // directory listing
      res.set({
        'Content-Type': 'text/html',
        'Content-Security-Policy': cspHeader,
        'Allow-CSP-From': '*',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      })
      if (req.method === 'HEAD') {
        return res.status(204).end()
      } else {
        return res.status(200).end(await directoryListingPage(drive, filepath))
      }
    }

    if (!entry) {
      return respondError(404, 'File Not Found')
    }

    // handle .goto redirects
    if (entry.path.endsWith('.goto') && entry.metadata.href) {
      try {
        let u = new URL(entry.metadata.href) // make sure it's a valid url
        return respondRedirect(entry.metadata.href)
      } catch (e) {
        // pass through
      }
    }

    // handle range
    headers['Accept-Ranges'] = 'bytes'
    var length
    var range = req.headers.Range || req.headers.range
    if (range) range = parseRange(entry.size, range)
    if (range && range.type === 'bytes') {
      range = range[0] // only handle first range given
      statusCode = 206
      length = (range.end - range.start + 1)
      headers['Content-Length'] = '' + length
      headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + entry.size
    } else {
      if (entry.size) {
        length = entry.size
        headers['Content-Length'] = '' + length
      }
    }

    Object.assign(headers, {
      'Content-Security-Policy': cspHeader,
      'Access-Control-Allow-Origin': '*',
      'Allow-CSP-From': '*',
      'Cache-Control': 'no-cache'
    })

    var mimeType = mime.identify(entry.path)
    headers['Content-Type'] = mimeType
    res.set(headers)
    if (req.method === 'HEAD') {
      res.status(204)
      res.end()
    } else {
      res.status(200)
      drive.createReadStream(entry.path, range).pipe(res)
    }
  }
}

function acceptHeaderExtensions (accept) {
  var exts = []
  var parts = (accept || '').split(',')
  if (parts.includes('text/html') || (parts.length === 1 && parts[0] === '*/*')) exts = exts.concat(['.html', '.md'])
  if (parts.includes('text/css')) exts.push('.css')
  if (parts.includes('image/*') || parts.includes('image/apng')) exts = exts.concat(['.png', '.jpg', '.jpeg', '.gif'])
  return exts
}

async function resolvePath (drive, filepath, hasTrailingSlash, acceptHeader) {
  // lookup entry
  var entry
  const tryStat = async (path) => {
    // abort if we've already found it
    if (entry) return
    // attempt lookup
    try {
      entry = await drive.promises.stat(path)
      entry.path = path
    } catch (e) {}
  }

  // do lookup
  if (hasTrailingSlash) {
    await tryStat(filepath + 'index.html')
    await tryStat(filepath + 'index.md')
    await tryStat(filepath)
  } else {
    await tryStat(filepath)
    for (let ext of acceptHeaderExtensions(acceptHeader)) {
      // fallback to different requested headers
      await tryStat(filepath + ext)
    }
    if (entry && entry.isDirectory()) {
      // unexpected directory, give the .html fallback a chance
      let dirEntry = entry
      entry = null
      await tryStat(filepath + '.html') // fallback to .html
      if (dirEntry && !entry) {
        // no .html fallback found, stick with directory that we found
        entry = dirEntry
      }
    }
  }

  return entry
}