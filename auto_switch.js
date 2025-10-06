const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Target URL to check
const url = "https://baberuthsports.com/";

// Full path to NordVPN CLI executable
const nordvpnExe = `"${path.join(
  "C:",
  "Program Files",
  "NordVPN",
  "nordvpn.exe"
)}"`;

// Verify NordVPN executable exists
if (
  !fs.existsSync(path.join("C:", "Program Files", "NordVPN", "nordvpn.exe"))
) {
  console.error(
    "❌ NordVPN executable not found. Check your installation path."
  );
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────
// Logging helper
// ────────────────────────────────────────────────────────────────
function log(level, msg) {
  const colors = {
    info: "\x1b[36m", // cyan
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
    success: "\x1b[32m", // green
  };
  const color = colors[level] || "\x1b[37m";
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(color + line + "\x1b[0m");
  fs.appendFileSync("vpn-monitor.log", line + "\n");
}

log("info", "✅ Script started");

// ────────────────────────────────────────────────────────────────
// Globals
// ────────────────────────────────────────────────────────────────
let reconnecting = false;
let cooldownUntil = 0;
let failCount = 0;

// ────────────────────────────────────────────────────────────────
// Browser-like Headers for fetch()
// ────────────────────────────────────────────────────────────────
const realisticHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
};

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
    log("info", "🔌 Disconnected: " + (stdout || stderr));

    setTimeout(() => {
      const countries = [
        "Canada",
        "Australia",
        "Hong Kong",
        "Taiwan",
        "Poland",
        "Ireland",
      ];
      const randomCountry =
        countries[Math.floor(Math.random() * countries.length)];

      exec(
        `${nordvpnExe} -c -g "${randomCountry}"`,
        (err2, stdout2, stderr2) => {
          if (err2) {
            log("error", "❌ Error connecting: " + err2.message);
          } else {
            log(
              "success",
              `✅ Connected to ${randomCountry}: ${stdout2 || stderr2}`
            );
          }
          reconnecting = false;
        }
      );
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
    const res = await fetch(url, { headers: realisticHeaders });
    log("info", `🌐 Status code: ${res.status}`);

    if (res.status !== 200) {
      failCount++;
      log("warn", `⚠️ Failed (${failCount}/3)`);

      if (failCount >= 3) {
        reconnectNordVPN("3 consecutive errors");
        failCount = 0;
      }
    } else {
      if (failCount > 0) log("success", "✅ Server recovered.");
      failCount = 0;
      log("success", "✅ Server reachable.");
    }
  } catch (err) {
    failCount++;
    log("error", `❌ Fetch error (${failCount}/3): ${err.message}`);
    if (failCount >= 3) {
      reconnectNordVPN("3 consecutive fetch errors");
      failCount = 0;
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Schedule tasks
// ────────────────────────────────────────────────────────────────
checkServer();

// Check every 2 minutes
setInterval(checkServer, 60000);

// Regular reconnect every hour
setInterval(() => reconnectNordVPN("Hourly refresh"), 1800000);
