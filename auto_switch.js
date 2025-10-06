const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Target URL to check
const url = "https://baberuthsports.com/";

// Full path to NordVPN CLI executable
const nordvpnExe = `"${path.join("C:", "Program Files", "NordVPN", "nordvpn.exe")}"`;

// Verify NordVPN executable exists
if (!fs.existsSync(path.join("C:", "Program Files", "NordVPN", "nordvpn.exe"))) {
  console.error("❌ NordVPN executable not found. Check your installation path.");
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────
// Logging helper
// ────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync("vpn-monitor.log", line);
}

log("✅ Script started");

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

  log(`Reconnecting NordVPN (${reason})...`);
  cooldownUntil = Date.now() + 30000; // 30-second cooldown

  exec(`${nordvpnExe} -d`, (err, stdout, stderr) => {
    if (err) {
      log("❌ Error disconnecting: " + err.message);
      reconnecting = false;
      return;
    }
    log("Disconnected: " + (stdout || stderr));

    // Wait 5 seconds before reconnect
    setTimeout(() => {
      const countries = ["Canada", "France", "Netherlands", "Germany", "Sweden"];
      const randomCountry = countries[Math.floor(Math.random() * countries.length)];

      exec(`${nordvpnExe} -c -g "${randomCountry}"`, (err2, stdout2, stderr2) => {
        if (err2) {
          log("❌ Error connecting: " + err2.message);
        } else {
          log(`✅ Connected to ${randomCountry}: ${stdout2 || stderr2}`);
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
    log("⏸ Cooldown active — skipping this check.");
    return;
  }

  try {
    const res = await fetch(url);
    log(`Status code: ${res.status}`);

    if (res.status !== 200) {
      log("❌ Server not reachable. Triggering reconnect...");
      reconnectNordVPN("Switch due to error");
    } else {
      log("✅ Server is reachable. No action needed.");
    }
  } catch (err) {
    log("❌ Error reaching server: " + err.message);
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