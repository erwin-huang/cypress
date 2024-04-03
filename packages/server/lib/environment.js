require('./util/fs')

const os = require('os')

const Promise = require('bluebird')
const debug = require('debug')('cypress:server')

// never cut off stack traces
Error.stackTraceLimit = Infinity

// cannot use relative require statement
// here because when obfuscated package
// would not be available
const pkg = require('@packages/root')

// instead of setting NODE_ENV we will
// use our own separate CYPRESS_INTERNAL_ENV so
// as not to conflict with CI providers

// use env from package first
// or development as default
const env = process.env['CYPRESS_INTERNAL_ENV'] || (process.env['CYPRESS_INTERNAL_ENV'] = pkg.env != null ? pkg.env : 'development')

process.env['CYPRESS'] = 'true'

const config = {
  // uses cancellation for automation timeouts
  cancellation: true,
}

if (env === 'development') {
  // enable long stack traces in dev
  config.longStackTraces = true
}

Promise.config(config)

// NOTE: errors are printed in development mode only
try {
  // i wish we didn't have to do this but we have to append
  // these command line switches immediately
  const {
    app,
  } = require('electron')

  app.commandLine.appendSwitch('disable-renderer-backgrounding', true)
  app.commandLine.appendSwitch('ignore-certificate-errors', true)

  // These flags are for webcam/WebRTC testing
  // https://github.com/cypress-io/cypress/issues/2704
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
  app.commandLine.appendSwitch('use-fake-device-for-media-stream')

  // https://github.com/cypress-io/cypress/issues/2376
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

  // allows webSecurity: false to work as expected in webPreferences
  // https://github.com/electron/electron/issues/18214
  app.commandLine.appendSwitch('disable-site-isolation-trials')

  // prevent electron from using /dev/shm, which can cause crashes in Docker
  // https://github.com/cypress-io/cypress/issues/15814
  app.commandLine.appendSwitch('disable-dev-shm-usage')

  // prevent navigation throttling when navigating in the browser rapid fire
  // https://github.com/cypress-io/cypress/pull/20271
  app.commandLine.appendSwitch('disable-ipc-flooding-protection')

  // ensure we get the most accurate memory usage
  app.commandLine.appendSwitch('enable-precise-memory-info')

  if (os.platform() === 'linux') {
    app.disableHardwareAcceleration()
  }

  if (process.env.ELECTRON_EXTRA_LAUNCH_ARGS) {
    // regex will be used to convert ELECTRON_EXTRA_LAUNCH_ARGS into an array, for example
    // input: 'foo --ipsum=0 --bar=--baz=quux --lorem="--ipsum=dolor --sit=amet"'
    // output: ['foo', '--ipsum=0', '--bar=--baz=quux', '--lorem="--ipsum=dolor --sit=amet"']
    const regex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g
    const electronLaunchArguments = process.env.ELECTRON_EXTRA_LAUNCH_ARGS.match(regex) || []

    electronLaunchArguments.forEach((arg) => {
      // arg can be just key --disable-http-cache
      // or key value --remote-debugging-port=8315
      // or key value with another value --foo=--bar=4196
      // or key value with another multiple value --foo='--bar=4196 --baz=quux'
      const [key, ...value] = arg.split('=')

      // because this is an environment variable, everything is a string
      // thus we don't have to worry about casting
      // --foo=false for example will be "--foo", "false"
      if (value.length) {
        let joinedValues = value.join('=')

       // check if the arg is wrapped in " or ' (unicode)
       const isWrappedInQuotes = !!['\u0022', '\u0027'].find(((charAsUnicode) => joinedValues.startsWith(charAsUnicode) && joinedValues.endsWith(charAsUnicode)))

        if (isWrappedInQuotes) {
          joinedValues = joinedValues.slice(1, -1)
        }

        app.commandLine.appendSwitch(key, joinedValues)
      } else {
        app.commandLine.appendSwitch(key)
      }
    })
  }
} catch (e) {
  debug('environment error %s', e.message)
}

module.exports = env
