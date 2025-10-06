const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Target URL to check
const url = "https://baberuthsports.com/";

// Full path to NordVPN CLI executable
const nordvpnExe = `"${path.join("C:", "Program Files", "NordVPN", "nordvpn.exe")}"`;

// Verify NordVPN executable exists
if (!fs.existsSync(path.join("C:", "Program Files", "NordVPN", "nordvpn.exe"))) {
  console.error("\x1b[31m❌ NordVPN executable not found. Check your installation path.\x1b[0m");
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────
// Logging helper (console + file)
// ────────────────────────────────────────────────────────────────
function log(type, msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync("vpn-monitor.log", line);

  const colors = {
    info: "\x1b[36m",      // cyan
    success: "\x1b[32m",   // green
    warn: "\x1b[33m",      // yellow
    error: "\x1b[31m",     // red
    reset: "\x1b[0m",
  };

  let color = colors.info;
  if (type === "success") color = colors.success;
  else if (type === "warn") color = colors.warn;
  else if (type === "error") color = colors.error;

  console.log(`${color}${line.trim()}${colors.reset}`);
}

log("success", "✅ Script started");

// ────────────────────────────────────────────────────────────────
// Globals
// ────────────────────────────────────────────────────────────────
let reconnecting = false;
let cooldownUntil = 0;

// ────────────────────────────────────────────────────────────────
// VPN Reconnect
// ────────────────────────────────────────────────────────────────
function reconnectNordVPN(reason = "Switch") {
  if (reconnecting) return;
  reconnecting = true;

  log("warn", `🔄 Reconnecting NordVPN (${reason})...`);
  cooldownUntil = Date.now() + 30000; // 30-second cooldown

  exec(`${nordvpnExe} -d`, (err, stdout, stderr) => {
    if (err) {
      log("error", "❌ Error disconnecting: " + err.message);
      reconnecting = false;
      return;
    }
    log("info", "🔌 Disconnected: " + (stdout || stderr).trim());

    // Wait 5 seconds before reconnect
    setTimeout(() => {
      const countries = ["Canada", "Australia", "Hong Kong", "Taiwan", "Poland", "Ireland"];
      const randomCountry = countries[Math.floor(Math.random() * countries.length)];

      exec(`${nordvpnExe} -c -g "${randomCountry}"`, (err2, stdout2, stderr2) => {
        if (err2) {
          log("error", "❌ Error connecting: " + err2.message);
        } else {
          log("success", `✅ Connected to ${randomCountry}: ${(stdout2 || stderr2).trim()}`);
        }
        reconnecting = false;
      });
    }, 5000);
  });
}

// ────────────────────────────────────────────────────────────────
// Server Health Check
// ────────────────────────────────────────────────────────────────
async function checkServer() {
  if (Date.now() < cooldownUntil) {
    log("warn", "⏸ Cooldown active — skipping this check.");
    return;
  }

  try {
    const res = await fetch(url);
    log("info", `🌐 Status code: ${res.status}`);

    if (res.status !== 200) {
      log("warn", "❌ Server not reachable. Triggering reconnect...");
      reconnectNordVPN("Switch due to error");
    } else {
      log("success", "✅ Server is reachable. No action needed.");
    }
  } catch (err) {
    log("error", "❌ Error reaching server: " + err.message);
    reconnectNordVPN("Switch due to network error");
  }
}

// ────────────────────────────────────────────────────────────────
// Run immediately + intervals
// ────────────────────────────────────────────────────────────────
checkServer();

// Check every 2 minutes
setInterval(checkServer, 120000);

// Regular reconnect every hour
setInterval(() => reconnectNordVPN("Regular switch"), 3600000);
