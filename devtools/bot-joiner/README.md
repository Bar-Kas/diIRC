# IRC Bot Joiner - Devtools

Load testing tool for joining multiple users to an IRC server to test channel loading, member lists, and chat message rendering performance in Luna IRC.

---

## Usage

### Run via npm:
```bash
npm run devtools:bots
```

### Run via Node.js directly:
```bash
node devtools/bot-joiner/index.js
```

### Pass custom configuration path:
```bash
node devtools/bot-joiner/index.js path/to/config.json
```

---

## Configuration (`config.json`)

The `config.json` file configures IRC server connection details, user lists, channel assignment, and chat simulation settings.

```json
{
  "server": {
    "host": "localhost",
    "port": 6667,
    "tls": false,
    "password": ""
  },
  "botOptions": {
    "connectDelayMs": 100,
    "autoReconnect": false,
    "realname": "IRC Load Test User"
  },
  "users": [
    "alex",
    "blake",
    "charlie",
    "dana",
    "elliot",
    "fiona",
    "george",
    "hannah",
    "ian",
    "julia"
  ],
  "chatSimulation": {
    "enabled": true,
    "intervalMs": 3000,
    "messages": [
      "Hello everyone",
      "How is performance testing going?",
      "Checking message latency."
    ]
  },
  "channels": [
    {
      "name": "#general",
      "usersCount": 10,
      "allowMessages": true,
      "key": ""
    },
    {
      "name": "#announcements",
      "usersCount": 8,
      "allowMessages": false,
      "key": ""
    }
  ]
}
```

### Configuration Parameters

- `server`: Host, port, TLS flag, and server password.
- `users`: Array of usernames/nicknames used for test bots.
- `chatSimulation`:
  - `enabled`: Set to `true` to enable random message sending.
  - `intervalMs`: Time interval in milliseconds between random messages.
  - `messages`: Array of random message strings.
- `channels`:
  - `name`: Channel name (e.g., `#general`).
  - `usersCount`: Number of users to join this channel.
  - `allowMessages`: Boolean flag (`true` or `false`). If `false`, users only join the channel and will not send simulated chat messages to it.
  - `key`: Optional channel password.

---

## Controls

Press `q` or `Ctrl+C` in the terminal to send an IRC `QUIT` command for all connected bot users and gracefully terminate the process.
