const crypto = require('crypto')
const express = require('express')
const bodyParser = require('http-body-parser').express
const {validateDatCfg, getDatKey} = require('./config')

var sessions = new Set()

module.exports.create = function (config) {
  var server = express()
  server.use(bodyParser({enableTypes: ['json']}))

  // jeff sessions management
  // =

  function validateSession (req, res, next) {
    var auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer ')) {
      let sessionToken = auth.slice('Bearer '.length)
      if (sessions.has(sessionToken)) {
        // session is valid
        res.locals.sessionToken = sessionToken
        return next()
      }
    }
    // invalid session
    res.status(401).json({message: 'You must sign in to access this resource.'})
  }

  // routes
  // =

  server.get('/.well-known/psa', (req, res) => {
    res.json({
      PSA: 1,
      title: 'My Pinning Service',
      description: 'Keep your Dats online!',
      links: [{
        rel: 'https://archive.org/services/purl/purl/datprotocol/spec/pinning-service-account-api',
        title: 'User accounts API',
        href: '/v1/accounts'
      }, {
        rel: 'https://archive.org/services/purl/purl/datprotocol/spec/pinning-service-dats-api',
        title: 'Dat pinning API',
        href: '/v1/dats'
      }]
    })
  })

  server.post('/v1/accounts/login', (req, res) => {
    if (!(req.body.username === config.webapi.username && req.body.password === config.webapi.password)) {
      return res.status(403).json({message: 'Invalid username or password.'})
    }
    let sessionToken = crypto.randomBytes(32).toString('base64')
    sessions.add(sessionToken)
    res.json({sessionToken})
  })

  server.post('/v1/accounts/logout', validateSession, (req, res) => {
    sessions.delete(res.locals.sessionToken)
    res.status(200).end()
  })

  server.get('/v1/accounts/account', validateSession, (req, res) => {
    res.json({
      username: config.webapi.username
    })
  })

  server.get('/v1/dats', validateSession, (req, res) => {
    res.json({
      items: config.dats.map(datCfg => ({
        url: `dat://${datCfg.datKey}/`,
        name: datCfg.name,
        additionalUrls: datCfg.additionalUrls
      }))
    })
  })

  server.post('/v1/dats/add', validateSession, (req, res) => {
    // extract config
    var datCfg = {url: req.body.url}
    if (req.body.name) datCfg.name = req.body.name
    if (req.body.domains) datCfg.domains = req.body.domains

    // validate
    try {
      validateDatCfg(datCfg)
    } catch (e) {
      let message = 'There were errors in your request.'
      if (e.invalidUrl) message = `Invalid Dat url (${e.value}). Must provide the url of the Dat you wish to pin.`
      if (e.invalidName) message = `Invalid name (${e.value}). Must provide a name for the Dat.`
      if (e.invalidDomain) message = `Invalid domain (${e.value}).`
      return res.status(422).json({message})
    }

    // add to config
    config.addDat(datCfg)
    res.status(200).end()
  })

  server.post('/v1/dats/remove', validateSession, (req, res) => {
    // validate
    var datKey
    try {
      datKey = getDatKey(req.body.url)
      if (!datKey) throw new Error()
    } catch (e) {
      res.status(422).json({message: `Invalid Dat url (${req.body.url}). Must provide the url of the Dat you wish to unpin.`})
    }

    // remove from config
    config.removeDat(datKey)
    res.status(200).end()
  })

  server.get('/v1/dats/item/:key', validateSession, (req, res) => {
    var datCfg = config.dats.find(d => d.datKey === req.params.key)
    if (!datCfg) {
      return res.status(404).json({message: 'Dat not found'})
    }
    return res.json({
      url: `dat://${datCfg.datKey}/`,
      name: datCfg.name,
      additionalUrls: datCfg.additionalUrls
    })
  })

  server.post('/v1/dats/item/:key', validateSession, (req, res) => {
    // extract config
    var datCfg = {
      url: `dat://${req.params.key}/`,
      name: req.body.name,
      domains: req.body.domains
    }

    // find the old dat
    var oldDatCfg = config.canonical.dats.find(d => getDatKey(d.url) === req.params.key)
    if (!oldDatCfg) {
      return res.status(404).json({message: 'Dat not found'})
    }

    // fill in missing attrs
    if (typeof datCfg.name === 'undefined') datCfg.name = oldDatCfg.name
    if (typeof datCfg.domains === 'undefined') datCfg.domains = oldDatCfg.domains

    // validate
    try {
      validateDatCfg(datCfg)
    } catch (e) {
      let message = 'There were errors in your request.'
      if (e.invalidUrl) message = `Invalid Dat url (${e.value}). Must provide the url of the Dat you wish to pin.`
      if (e.invalidName) message = `Invalid name (${e.value}). Must provide a name for the Dat.`
      if (e.invalidDomain) message = `Invalid domain (${e.value}).`
      return res.status(422).json({message})
    }

    // update the config
    config.updateDat(req.params.key, datCfg)
    res.status(200).end()
  })

  return server
}
