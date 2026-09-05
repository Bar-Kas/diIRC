import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const serverPath = path.join(here, "index.js");

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

function waitForOutput(child, pattern, output, timeoutMs = 3000) {
  if (pattern.test(output.join(""))) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}: ${output.join("")}`)), timeoutMs);
    const onData = () => {
      if (!pattern.test(output.join(""))) return;
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      resolve();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  });
}

async function startHarness(overrides = {}, cliOverrides = []) {
  const ircPort = await freePort();
  const httpPort = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "diirc-test-harness-"));
  const configPath = path.join(tempDir, "config.json");
  const baseConfig = {
    serverName: "smoke-test",
    networkName: "Smoke-Test",
    ircPort,
    httpPort,
    channels: ["#general", "#locked-test", "#invite-test", "#limited-test"],
    channelOptions: {
      "#locked-test": { key: "letmein", modes: "+ntk" },
      "#invite-test": { modes: "+nti" },
      "#limited-test": { limit: 1, modes: "+ntl" }
    },
    seed: 7,
    scenarioMode: "deterministic",
    scenarioSequence: ["text", "markdown", "image"],
    messageIntervalMs: 0,
    burstIntervalMs: 0,
    traffic: { enabled: false, lifecycle: false },
    botDirectMessagesEnabled: false,
    bots: false,
    bouncer: { enabled: false, profile: "none", replayOnConnect: false }
  };
  const config = {
    ...baseConfig,
    ...overrides,
    traffic: { ...baseConfig.traffic, ...(overrides.traffic || {}) },
    bouncer: { ...baseConfig.bouncer, ...(overrides.bouncer || {}) }
  };
  fs.writeFileSync(configPath, JSON.stringify(config));
  const output = [];
  const child = spawn(process.execPath, [serverPath, ...cliOverrides, configPath], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => output.push(chunk));
  child.stderr.on("data", (chunk) => output.push(chunk));
  try {
    await waitForOutput(child, /\[READY\]/, output);
  } catch (error) {
    child.kill();
    throw error;
  }
  return {
    child,
    ircPort,
    httpPort,
    output,
    async close() {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 800))]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function connectIrc(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const lines = [];
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => resolve({
      socket,
      lines,
      send(line) { socket.write(`${line}\r\n`); },
      waitFor(predicate, timeoutMs = 2000) {
        const existing = lines.find((line) => predicate(line));
        if (existing) return Promise.resolve(existing);
        return new Promise((waitResolve, waitReject) => {
          const timer = setTimeout(() => waitReject(new Error(`Timed out waiting for IRC line. Received:\n${lines.join("\n")}`)), timeoutMs);
          const check = (line) => {
            if (!predicate(line)) return;
            clearTimeout(timer);
            socket.off("line", check);
            waitResolve(line);
          };
          socket.on("line", check);
        });
      }
    }));
    socket.on("data", (chunk) => {
      buffer += chunk;
      const received = buffer.split(/\r?\n/);
      buffer = received.pop() || "";
      for (const line of received.filter(Boolean)) { lines.push(line); socket.emit("line", line); }
    });
    socket.on("error", reject);
  });
}

async function register(client, nick = "ReactUser") {
  client.send("CAP LS 302");
  client.send(`NICK ${nick}`);
  client.send(`USER ${nick.toLowerCase()} 0 * :Smoke Test User`);
  return client.waitFor((line) => line.includes(" 001 "));
}

function requestJson(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", port, path: pathname, ...options }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(body) }); } catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

test("covers registration, NAMES, deterministic controls, errors and lifecycle", async () => {
  const harness = await startHarness();
  const client = await connectIrc(harness.ircPort);
  try {
    await register(client);
    client.send("JOIN #general");
    await client.waitFor((line) => line.includes(" 353 ReactUser = #general "));
    await client.waitFor((line) => line.includes(" 366 ReactUser #general "));

    client.send("TEST MESSAGE #general :deterministic message");
    await client.waitFor((line) => line.includes("ScenarioBot!scenariobot") && line.includes("deterministic message"));

    client.send("TEST ERROR 482 #general");
    await client.waitFor((line) => line.includes(" 482 ReactUser #general "));
    client.send("AWAY :Lunch break");
    await client.waitFor((line) => line.includes(" 306 ReactUser "));
    client.send("AWAY");
    await client.waitFor((line) => line.includes(" 305 ReactUser "));

    const state = await requestJson(harness.httpPort, "/state");
    assert.equal(state.status, 200);
    assert.equal(state.body.channels.find((channel) => channel.name === "#general").members[0], "ReactUser");
    assert.equal(state.body.events.recent.some((event) => event.type === "join"), true);
    const metadata = await requestJson(harness.httpPort, "/metadata");
    assert.equal(metadata.status, 200);
    assert.match(metadata.body.image, /test-image\.svg/);

    client.send("PART #general :done");
    await client.waitFor((line) => line.includes(" PART #general :done"));
  } finally {
    client.socket.destroy();
    await harness.close();
  }
});

test("exercises channel key, invite-only and channel-limit errors", async () => {
  const harness = await startHarness();
  const first = await connectIrc(harness.ircPort);
  const second = await connectIrc(harness.ircPort);
  try {
    await register(first, "FirstUser");
    await register(second, "SecondUser");

    first.send("JOIN #locked-test wrong");
    await first.waitFor((line) => line.includes(" 475 FirstUser #locked-test "));
    first.send("JOIN #locked-test letmein");
    await first.waitFor((line) => line.includes(" 366 FirstUser #locked-test "));

    first.send("JOIN #invite-test");
    await first.waitFor((line) => line.includes(" 473 FirstUser #invite-test "));

    first.send("JOIN #limited-test");
    await first.waitFor((line) => line.includes(" 366 FirstUser #limited-test "));
    second.send("JOIN #limited-test");
    await second.waitFor((line) => line.includes(" 471 SecondUser #limited-test "));
  } finally {
    first.socket.destroy();
    second.socket.destroy();
    await harness.close();
  }
});

test("routes bot PMs and broadcasts nickname changes", async () => {
  const harness = await startHarness({
    bots: [{ nick: "EchoBot", username: "echo", realname: "PM Echo Bot", channels: ["#general"] }]
  });
  const client = await connectIrc(harness.ircPort);
  try {
    await register(client);
    client.send("JOIN #general");
    await client.waitFor((line) => line.includes(" 366 ReactUser #general "));
    client.send("PRIVMSG EchoBot :hello with spaces");
    await client.waitFor((line) => line.includes("EchoBot!echobot") && line.includes("hello with spaces"));
    client.send("NICK RenamedUser");
    await client.waitFor((line) => line.includes("ReactUser!reactuser") && line.includes(" NICK :RenamedUser"));
  } finally {
    client.socket.destroy();
    await harness.close();
  }
});

test("runs every bouncer profile with standard IRC notices and replay controls", async () => {
  for (const profile of ["znc", "soju", "bip", "pounce"]) {
    const harness = await startHarness({ bouncer: { enabled: true, profile: "none", replayOnConnect: false } }, ["--profile", profile, "--seed", "42"]);
    const client = await connectIrc(harness.ircPort);
    try {
      client.send(`PASS user/network:secret`);
      await register(client, `User${profile}`);
      const welcome = await client.waitFor((line) => line.includes("NOTICE User"));
      const serviceNick = profile === "bip" || profile === "pounce" ? profile : "*status";
      assert.match(welcome, new RegExp(serviceNick.replace("*", "\\*")));
      client.send("PRIVMSG *status :status");
      const profileLabel = { znc: "ZNC", soju: "soju", bip: "bip", pounce: "Pounce" }[profile];
      await client.waitFor((line) => line.includes("Profile:") && line.includes(profileLabel));
      client.send("JOIN #general");
      await client.waitFor((line) => line.includes(` 366 User${profile} #general `));
      client.send("PRIVMSG *status :replay");
      await client.waitFor((line) => line.includes("[Playback 01]"));
      const health = await requestJson(harness.httpPort, "/health");
      assert.equal(health.body.bouncer.profile, profile);
    } finally {
      client.socket.destroy();
      await harness.close();
    }
  }
});

test("supports HTTP scenario control and a reconnect-triggering disconnect", async () => {
  const harness = await startHarness({ bouncer: { enabled: true, profile: "soju", replayOnConnect: false } });
  const client = await connectIrc(harness.ircPort);
  try {
    await register(client);
    client.send("JOIN #general");
    await client.waitFor((line) => line.includes(" 366 ReactUser #general "));
    const body = JSON.stringify({ action: "message", channel: "#general", sender: "HTTPBot", message: "controlled from HTTP" });
    const result = await requestJson(harness.httpPort, "/control", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, body });
    assert.equal(result.status, 200);
    await client.waitFor((line) => line.includes("HTTPBot!httpbot") && line.includes("controlled from HTTP"));

    client.send("TEST DISCONNECT 10");
    await once(client.socket, "close");
  } finally {
    client.socket.destroy();
    await harness.close();
  }
});

test("keeps two configured server instances isolated", async () => {
  const first = await startHarness({ serverName: "network-one", networkName: "Network-One" });
  const second = await startHarness({ serverName: "network-two", networkName: "Network-Two" });
  const firstClient = await connectIrc(first.ircPort);
  const secondClient = await connectIrc(second.ircPort);
  try {
    await register(firstClient, "ReactUser");
    await register(secondClient, "ReactUser");
    const [firstHealth, secondHealth] = await Promise.all([requestJson(first.httpPort, "/health"), requestJson(second.httpPort, "/health")]);
    assert.equal(firstHealth.body.serverName, "network-one");
    assert.equal(secondHealth.body.serverName, "network-two");
    assert.equal(firstHealth.body.clients.filter((client) => client.nick === "ReactUser").length, 1);
    assert.equal(secondHealth.body.clients.filter((client) => client.nick === "ReactUser").length, 1);
  } finally {
    firstClient.socket.destroy();
    secondClient.socket.destroy();
    await Promise.all([first.close(), second.close()]);
  }
});
