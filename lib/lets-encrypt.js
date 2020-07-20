var pkg = require('../package.json');
var Greenlock = require('greenlock');

var greenlock

exports.setup = async function (config) {
  greenlock = Greenlock.create({
    configDir: config.greenlockDirectory,
    packageAgent: pkg.name + '/' + pkg.version,
    maintainerEmail: pkg.author,
    staging: false,
    notify: function(event, details) {
      if ('error' === event) {
        // `details` is an error object in this case
        console.error(details);
      }
    }
  });
  greenlock.manager.defaults({
    agreeToTerms: config.letsencrypt.agreeTos,
    subscriberEmail: config.letsencrypt.email
  })
  greenlock.add({subject: config.hostnames[0], altnames: config.hostnames})
}

exports.getCertInfo = async function (config) {
  return greenlock.get({servername: config.hostnames[0]})
}