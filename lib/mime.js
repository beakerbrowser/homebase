const identifyFiletype = require('identify-filetype')
const mime = require('mime')
const through2 = require('through2')

mime.default_type = 'text/plain'

var identify =
exports.identify = function (name, chunk) {
  // try to identify the type by the chunk contents
  var mimeType
  var identifiedExt = (chunk) ? identifyFiletype(chunk) : false
  if (identifiedExt) {
    mimeType = mime.getType(identifiedExt)
  }
  if (!mimeType) {
    // fallback to using the entry name
    mimeType = mime.getType(name)
  }

  // hackish fix
  // the svg test can be a bit aggressive: html pages with
  // inline svgs can be falsely interpretted as svgs
  // double check that
  if (identifiedExt === 'svg' && mime.getType(name) === 'text/html') {
    return 'text/html'
  }

  return mimeType
}

exports.identifyStream = function (name, cb) {
  var first = true
  return through2(function (chunk, enc, cb2) {
    if (first) {
      first = false
      cb(identify(name, chunk))
    }
    this.push(chunk)
    cb2()
  })
}
