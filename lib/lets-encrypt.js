
exports.approveDomains = function (cfg) {
  return function (options, certs, cb) {
    var domain = options.domain
    options.agreeTos = true
    options.email = cfg.letsencrypt.email
    if (certs) {
      options.domains = certs.altnames
    }

    // is this one of our sites?
    if (cfg.hostnames.indexOf(domain) !== -1) {
      return cb(null, {options: options, certs: certs})
    }

    cb(new Error('Invalid domain'))
  }
}
