const path = require('path');
const fs = require('fs');

// Environment configurations
const ENVIRONMENTS = {
  local: {
    serverUrl: 'ws://localhost:3000',
    apiUrl: 'http://localhost:3000',
    name: 'Local Development'
  },
  dev: {
    serverUrl: 'wss://dev-api.termly.dev',
    apiUrl: 'https://dev-api.termly.dev',
    name: 'Development'
  },
  production: {
    serverUrl: 'wss://api.termly.dev',
    apiUrl: 'https://api.termly.dev',
    name: 'Production'
  }
};

// Determine current environment
function getEnvironment() {
  // 1. Explicit self-hosted server (see getEnvironmentConfig)
  if (process.env.TERMLY_SERVER_URL) {
    return 'self-hosted';
  }

  // 2. Check for local development override
  if (process.env.TERMLY_ENV === 'local') {
    return 'local';
  }

  // 2. Detect by package.json name
  try {
    // Try to find which package.json we're running from
    const cliPath = process.argv[1]; // Path to bin/cli.js or bin/cli-dev.js

    if (cliPath && cliPath.includes('cli-dev.js')) {
      return 'dev';
    }

    // Check if we're running from package.dev.json context
    const packageJsonPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = require(packageJsonPath);
      if (pkg.name === '@termly-dev/cli-dev') {
        return 'dev';
      }
    }
  } catch (err) {
    // Fallback to production if detection fails
  }

  // 4. Default to production
  return 'production';
}

// Derive the HTTP origin from a WebSocket URL, so pointing the CLI at a
// self-hosted relay takes one variable instead of two.
function httpUrlFromServerUrl(serverUrl) {
  return serverUrl.replace(/^ws(s)?:/, (match, secure) => (secure ? 'https:' : 'http:'));
}

// Get current environment config
//
// TERMLY_SERVER_URL points the CLI at a self-hosted relay. It also reaches the
// mobile app: the URL is embedded in the pairing QR code, so a phone scanning
// it connects to the same server rather than to a hardcoded termly.dev host.
function getEnvironmentConfig() {
  const env = getEnvironment();

  if (env === 'self-hosted') {
    const serverUrl = process.env.TERMLY_SERVER_URL;

    return {
      serverUrl,
      apiUrl: process.env.TERMLY_API_URL || httpUrlFromServerUrl(serverUrl),
      name: `Self-hosted (${serverUrl})`,
      environment: env
    };
  }

  return {
    ...ENVIRONMENTS[env],
    environment: env
  };
}

// Get server URL for current environment
function getServerUrl() {
  return getEnvironmentConfig().serverUrl;
}

// Get API URL for current environment
function getApiUrl() {
  return getEnvironmentConfig().apiUrl;
}

// Get environment name
function getEnvironmentName() {
  return getEnvironmentConfig().name;
}

// Check if running in local mode
function isLocal() {
  return getEnvironment() === 'local';
}

// Check if pointed at a self-hosted server
function isSelfHosted() {
  return getEnvironment() === 'self-hosted';
}

// Check if running in dev mode
function isDev() {
  return getEnvironment() === 'dev';
}

// Check if running in production mode
function isProduction() {
  return getEnvironment() === 'production';
}

module.exports = {
  ENVIRONMENTS,
  getEnvironment,
  getEnvironmentConfig,
  getServerUrl,
  getApiUrl,
  getEnvironmentName,
  isLocal,
  isSelfHosted,
  isDev,
  isProduction
};
