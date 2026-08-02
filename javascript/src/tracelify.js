const http = require('http');
const https = require('https');
const crypto = require('crypto');

class Tracelify {
  constructor(dsn, release) {
    this.release = release;
    this.user = {};
    this.tags = {};
    this.breadcrumbs = [];
    
    const url = new URL(dsn);
    this.protocol = url.protocol || 'http:';
    this.host = url.hostname || 'localhost';
    this.port = url.port ? parseInt(url.port) : (this.protocol === 'https:' ? 443 : 80);
    this.publicKey = url.username || 'demo_key';
    
    let pathParts = url.pathname.replace(/^\/|\/$/g, '').split('/');
    if (pathParts.length > 0 && pathParts[0] === 'api') pathParts.shift();
    if (pathParts.length > 0 && pathParts[pathParts.length - 1] === 'events') pathParts.pop();
    this.projectId = pathParts.length > 0 ? pathParts[0] : 'unknown';
    
    this.endpoint = `${this.protocol}//${this.host}:${this.port}/api/${this.projectId}/events`;
    
    this._setupGlobalHandlers();
  }

  _setupGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      this.captureException(error);
    });
    process.on('unhandledRejection', (reason) => {
      this.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    });
  }

  setUser(user) {
    this.user = user;
  }

  setTag(key, value) {
    this.tags[key] = value;
  }

  addBreadcrumb(message) {
    this.breadcrumbs.push(message);
  }

  captureException(error) {
    if (!error) return;

    const stacktrace = error.stack || String(error);
    const timestamp = new Date().toISOString();
    
    const event = {
      event_id: crypto.randomUUID(),
      project_id: this.projectId,
      timestamp: timestamp,
      level: "error",
      release: this.release,
      client: {
        sdk: "tracelify.javascript"
      },
      error: {
        type: error.name || "Error",
        message: error.message || String(error),
        stacktrace: stacktrace
      }
    };

    if (Object.keys(this.user).length > 0) event.user = this.user;
    if (Object.keys(this.tags).length > 0) event.tags = this.tags;
    
    this._sendEvent(event);
  }

  _sendEvent(event) {
    const payload = JSON.stringify(event);
    const client = this.protocol === 'https:' ? https : http;
    const url = new URL(this.endpoint);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.publicKey}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 5000
    };

    const req = client.request(options, (res) => {
      if (res.statusCode !== 202) {
        console.warn(`[Tracelify SDK] Warning: server responded with ${res.statusCode}`);
      } else {
        console.log(`✅ Event accepted by Tracelify`);
      }
      res.on('data', () => {});
    });

    req.on('error', (e) => {
      console.error(`[Tracelify SDK] Error sending event: ${e.message}`);
    });
    
    req.on('timeout', () => {
      req.destroy();
    });

    req.write(payload);
    req.end();
  }

  shutdown() {
    return new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

module.exports = { Tracelify };
