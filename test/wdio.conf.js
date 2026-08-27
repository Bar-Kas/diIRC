import path from 'node:path';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';

const tauriBinary = path.resolve('./src-tauri/target/release/app');
const screenshotDir = path.resolve('./test/reports/screenshots');

let driverAliceProcess = null;
let driverBobProcess = null;
let viteProcess = null;

export const config = {
  runner: 'local',
  specs: [
    './e2e/specs/**/*.spec.js',
    './e2e/specs/**/*.js'
  ],
  maxInstances: 1,
  capabilities: {
    alice: {
      port: 4444,
      capabilities: {
        'tauri:options': {
          application: tauriBinary
        }
      }
    },
    bob: {
      port: 4445,
      capabilities: {
        'tauri:options': {
          application: tauriBinary
        }
      }
    }
  },
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000
  },

  onPrepare: async function () {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    console.log('[E2E Setup] Cleaning isolated data directories...');
    fs.rmSync('/tmp/diirc-e2e-alice', { recursive: true, force: true });
    fs.rmSync('/tmp/diirc-e2e-bob', { recursive: true, force: true });

    console.log('[E2E Setup] Starting Docker Environment (Ergo IRC)...');
    const dockerComposePath = path.resolve('./test/e2e/docker/docker-compose.yml');
    execSync(`docker compose -f "${dockerComposePath}" up -d`, { stdio: 'inherit' });

    console.log('[E2E Setup] Waiting for Ergo to be reachable on port 16667...');
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(() => {
        const socket = new net.Socket();
        socket.connect(16667, '127.0.0.1', () => {
          clearInterval(interval);
          socket.destroy();
          console.log('[E2E Setup] Ergo is ready.');
          resolve();
        });
        socket.on('error', () => {
          attempts++;
          if (attempts > 15) {
            clearInterval(interval);
            reject(new Error('Ergo IRC server failed to start within 15 seconds.'));
          }
        });
      }, 1000);
    });

    console.log('[E2E Setup] Starting Vite dev server for Tauri frontend...');
    viteProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'ignore',
      detached: true
    });
    viteProcess.unref();

    console.log('[E2E Setup] Waiting for Vite to be reachable on port 1420...');
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(() => {
        const socket = new net.Socket();
        socket.connect(1420, '127.0.0.1', () => {
          clearInterval(interval);
          socket.destroy();
          console.log('[E2E Setup] Vite is ready.');
          resolve();
        });
        socket.on('error', () => {
          attempts++;
          if (attempts > 30) {
            clearInterval(interval);
            reject(new Error('Vite server failed to start within 30 seconds.'));
          }
        });
      }, 1000);
    });

    console.log('[E2E Setup] Starting tauri-driver on ports 4444 (native: 5444) and 4445 (native: 5445)...');

    driverAliceProcess = spawn('tauri-driver', ['--port', '4444', '--native-port', '5444'], {
      stdio: 'ignore',
      detached: true,
      env: {
        ...process.env,
        XDG_DATA_HOME: '/tmp/diirc-e2e-alice/data',
        XDG_CONFIG_HOME: '/tmp/diirc-e2e-alice/config',
        XDG_CACHE_HOME: '/tmp/diirc-e2e-alice/cache'
      }
    });
    driverAliceProcess.unref();

    driverBobProcess = spawn('tauri-driver', ['--port', '4445', '--native-port', '5445'], {
      stdio: 'ignore',
      detached: true,
      env: {
        ...process.env,
        XDG_DATA_HOME: '/tmp/diirc-e2e-bob/data',
        XDG_CONFIG_HOME: '/tmp/diirc-e2e-bob/config',
        XDG_CACHE_HOME: '/tmp/diirc-e2e-bob/cache'
      }
    });
    driverBobProcess.unref();

    await new Promise((resolve) => setTimeout(resolve, 2000));
  },

  onComplete: async function () {
    console.log('[E2E Teardown] Cleaning up tauri-driver processes, Vite, and Mock IRC Server...');
    if (driverAliceProcess && driverAliceProcess.pid) {
      try { process.kill(-driverAliceProcess.pid); } catch (e) {}
    }
    if (driverBobProcess && driverBobProcess.pid) {
      try { process.kill(-driverBobProcess.pid); } catch (e) {}
    }
    if (viteProcess && viteProcess.pid) {
      try { process.kill(-viteProcess.pid); } catch (e) {}
    }
    console.log('[E2E Teardown] Stopping Docker Environment...');
    try {
      const dockerComposePath = path.resolve('./test/e2e/docker/docker-compose.yml');
      execSync(`docker compose -f "${dockerComposePath}" down -v`, { stdio: 'inherit' });
    } catch (e) {
      console.error('[E2E Teardown] Failed to stop docker environment:', e);
    }
  }
};
