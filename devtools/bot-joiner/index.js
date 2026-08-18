import fs from 'fs';
import path from 'path';
import net from 'net';
import tls from 'tls';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configArg = process.argv[2];
const configPath = configArg
  ? path.resolve(process.cwd(), configArg)
  : path.join(__dirname, 'config.json');

if (!fs.existsSync(configPath)) {
  console.error(`[ERROR] Configuration file not found: ${configPath}`);
  console.log(`[INFO] Copy config.example.json to config.json or provide a file path argument.`);
  process.exit(1);
}

let config;
try {
  const fileContent = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(fileContent);
} catch (err) {
  console.error(`[ERROR] Failed to parse configuration file ${configPath}:`, err.message);
  process.exit(1);
}

function buildBotDefinitions(cfg) {
  const userList = (cfg.users && Array.isArray(cfg.users) && cfg.users.length > 0)
    ? cfg.users
    : ['User_1', 'User_2', 'User_3', 'User_4', 'User_5'];

  const botMap = new Map();
  const defaultRealname = cfg.botOptions?.realname || 'IRC Load Test User';

  if (cfg.channels && Array.isArray(cfg.channels)) {
    cfg.channels.forEach((ch) => {
      const channelName = ch.name;
      const key = ch.key || '';
      const allowMessages = ch.allowMessages !== false;

      let targetUserNicks = [];
      if (ch.users && Array.isArray(ch.users)) {
        targetUserNicks = ch.users;
      } else {
        const count = ch.usersCount || 1;
        for (let i = 0; i < count; i++) {
          if (i < userList.length) {
            targetUserNicks.push(userList[i]);
          } else {
            targetUserNicks.push(`User_${i + 1}`);
          }
        }
      }

      targetUserNicks.forEach((nick) => {
        if (!botMap.has(nick)) {
          const cleanUser = nick.toLowerCase().replace(/[^a-z0-9]/g, '') || 'botuser';
          botMap.set(nick, {
            nick,
            username: cleanUser,
            realname: defaultRealname,
            channels: []
          });
        }
        const botDef = botMap.get(nick);
        botDef.channels.push({
          name: channelName,
          key,
          allowMessages
        });
      });
    });
  }

  return Array.from(botMap.values());
}

const botDefinitions = buildBotDefinitions(config);

if (botDefinitions.length === 0) {
  console.error('[ERROR] No valid bot user definitions found in configuration.');
  process.exit(1);
}

console.log('----------------------------------------------------');
console.log('[INFO] IRC Devtools Load Test Tool');
console.log(`[INFO] Server: ${config.server.host}:${config.server.port} (TLS: ${config.server.tls ? 'true' : 'false'})`);
console.log(`[INFO] Configured users count: ${botDefinitions.length}`);
console.log('----------------------------------------------------\n');

class IrcBot {
  constructor(def, serverCfg) {
    this.nick = def.nick;
    this.username = def.username;
    this.realname = def.realname;
    this.targetChannels = def.channels;
    this.serverCfg = serverCfg;

    this.socket = null;
    this.buffer = '';
    this.status = 'disconnected'; // 'connecting', 'registered', 'disconnected'
    this.joinedChannels = new Set();
    this.lastError = null;
    this.errorLogged = false;
  }

  connect() {
    this.status = 'connecting';
    const { host, port, tls: useTls } = this.serverCfg;
    const options = { host, port };

    if (useTls) {
      this.socket = tls.connect(options, () => this.onConnect());
    } else {
      this.socket = net.connect(options, () => this.onConnect());
    }

    this.socket.setEncoding('utf-8');
    this.socket.on('data', (data) => this.onData(data));
    this.socket.on('error', (err) => this.onError(err));
    this.socket.on('close', () => this.onClose());
  }

  send(rawCommand) {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(rawCommand + '\r\n');
    }
  }

  onConnect() {
    if (this.serverCfg.password) {
      this.send(`PASS ${this.serverCfg.password}`);
    }
    this.send(`NICK ${this.nick}`);
    this.send(`USER ${this.username} 0 * :${this.realname}`);
  }

  onData(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop();

    for (const line of lines) {
      if (!line) continue;
      this.handleIrcLine(line);
    }
  }

  handleIrcLine(line) {
    if (line.startsWith('PING ')) {
      const payload = line.substring(5);
      this.send(`PONG ${payload}`);
      return;
    }

    const parts = line.split(' ');
    if (parts.length < 2) return;

    let command = parts[1];
    if (parts[0].startsWith(':')) {
      command = parts[1];
    } else {
      command = parts[0];
    }

    if (command === 'ERROR') {
      const errReason = line.substring(line.indexOf('ERROR') + 5).trim();
      this.lastError = errReason;
      return;
    }

    // 001 RPL_WELCOME
    if (command === '001') {
      this.status = 'registered';
      this.joinConfiguredChannels();
      return;
    }

    // 433 ERR_NICKNAMEINUSE
    if (command === '433') {
      this.nick = `${this.nick}_`;
      this.send(`NICK ${this.nick}`);
      return;
    }

    // JOIN confirmation
    if (command === 'JOIN') {
      let rawChan = parts[2] || parts[1];
      if (rawChan && rawChan.startsWith(':')) rawChan = rawChan.substring(1);
      if (rawChan) {
        this.joinedChannels.add(rawChan.toLowerCase());
      }
    }
  }

  joinConfiguredChannels() {
    for (const channelObj of this.targetChannels) {
      const name = channelObj.name;
      const key = channelObj.key ? ` ${channelObj.key}` : '';
      this.send(`JOIN ${name}${key}`);
    }
  }

  onError(err) {
    this.lastError = err.message;
  }

  onClose() {
    this.status = 'disconnected';
    if (this.lastError && !shuttingDown) {
      if (!this.errorLogged) {
        this.errorLogged = true;
        console.warn(`[WARN] User '${this.nick}' disconnected: ${this.lastError}`);
      }
    }
  }

  disconnect() {
    if (this.socket && !this.socket.destroyed) {
      this.send('QUIT :Load test tool disconnect');
      this.socket.end();
    }
  }
}

const activeBots = botDefinitions.map(def => new IrcBot(def, config.server));
const delayMs = config.botOptions?.connectDelayMs || 100;

console.log(`[INFO] Connecting users with ${delayMs}ms delay...\n`);

let index = 0;
const connectInterval = setInterval(() => {
  if (index >= activeBots.length) {
    clearInterval(connectInterval);
    return;
  }
  activeBots[index].connect();
  index++;
}, delayMs);

// Global chat simulation runner
let chatSimulationTimer = null;
if (config.chatSimulation && config.chatSimulation.enabled) {
  const simCfg = config.chatSimulation;
  const intervalMs = simCfg.intervalMs || 3000;
  const messages = simCfg.messages || ['Load test message'];

  chatSimulationTimer = setInterval(() => {
    if (shuttingDown) return;

    const eligibleBots = activeBots.filter(bot => {
      if (bot.status !== 'registered') return false;
      return bot.targetChannels.some(ch => ch.allowMessages && bot.joinedChannels.has(ch.name.toLowerCase()));
    });

    if (eligibleBots.length === 0) return;

    const randomBot = eligibleBots[Math.floor(Math.random() * eligibleBots.length)];
    const allowedChannels = randomBot.targetChannels.filter(
      ch => ch.allowMessages && randomBot.joinedChannels.has(ch.name.toLowerCase())
    );

    if (allowedChannels.length === 0) return;

    const targetChan = allowedChannels[Math.floor(Math.random() * allowedChannels.length)].name;
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];

    randomBot.send(`PRIVMSG ${targetChan} :${randomMsg}`);
  }, intervalMs);
}

function printStatusSummary() {
  const registered = activeBots.filter(b => b.status === 'registered').length;
  const connecting = activeBots.filter(b => b.status === 'connecting').length;
  const disconnected = activeBots.filter(b => b.status === 'disconnected').length;

  const channelStats = {};
  activeBots.forEach(b => {
    b.joinedChannels.forEach(ch => {
      channelStats[ch] = (channelStats[ch] || 0) + 1;
    });
  });

  console.log(`[STATUS] Total: ${activeBots.length} | Registered: ${registered} | Connecting: ${connecting} | Disconnected: ${disconnected}`);
  const chanSummary = Object.entries(channelStats)
    .map(([ch, count]) => `${ch}: ${count}`)
    .join(', ');
  if (chanSummary) {
    console.log(`         Channels -> ${chanSummary}`);
  }
}

const statusReporter = setInterval(printStatusSummary, 4000);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[INFO] Shutdown requested. Disconnecting all users...');
  clearInterval(statusReporter);
  clearInterval(connectInterval);
  if (chatSimulationTimer) {
    clearInterval(chatSimulationTimer);
  }

  activeBots.forEach(bot => bot.disconnect());

  setTimeout(() => {
    console.log('[INFO] All bot users disconnected successfully.');
    process.exit(0);
  }, 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      shutdown();
    } else if (key.name === 'q') {
      shutdown();
    }
  });
  console.log('[INFO] Press "q" or Ctrl+C to disconnect all users and exit.\n');
}
