class ExtendableError extends Error {
  constructor(msg) {
    super(msg)
    this.name = this.constructor.name
    this.message = msg
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    } else {
      this.stack = (new Error(msg)).stack
    }
  }
}

exports.ConfigError = class ConfigError extends ExtendableError {
  constructor(msg) {
    super(msg || 'Configuration error')
    this.configError = true
  }
}