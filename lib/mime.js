const identifyFiletype = require('identify-filetype')
const mime = require('mime')
const through2 = require('through2')

var identify =
exports.identify = function (name, chunk) {
  // try to identify the type by the chunk contents
  var mimeType
  var identifiedExt = (chunk) ? identifyFiletype(chunk) : false
  if (identifiedExt) {
    mimeType = mime.lookup(identifiedExt)
  }
  if (!mimeType) {
    // fallback to using the entry name
    mimeType = mime.lookup(name)
  }

  // hackish fix
  // the svg test can be a bit aggressive: html pages with
  // inline svgs can be falsely interpretted as svgs
  // double check that
  if (identifiedExt === 'svg' && mime.lookup(name) === 'text/html') {
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
