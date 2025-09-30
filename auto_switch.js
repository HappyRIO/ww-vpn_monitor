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

console.log("✅ Script started");

// Function to run NordVPN CLI
let reconnecting = false;

function reconnectNordVPN(reason = "Switch") {
  if (reconnecting) return; // Skip if already reconnecting
  reconnecting = true;

  console.log(`\n[${new Date().toISOString()}] Reconnecting NordVPN (${reason})...`);

  exec(`${nordvpnExe} -d`, (err, stdout, stderr) => {
    if (err) {
      console.error("Error disconnecting:", err.message);
      reconnecting = false; // Reset flag even on error
      return;
    }
    console.log("Disconnected:", stdout || stderr);

    exec(`${nordvpnExe} -c -g "Canada"`, (err2, stdout2, stderr2) => {
      if (err2) {
        console.error("Error connecting:", err2.message);
      } else {
        console.log("Connected:", stdout2 || stderr2);
      }
      reconnecting = false; // Reset flag once reconnect attempt finishes
    });
  });
}


// Function to check server status
async function checkServer() {
  try {
    const res = await fetch(url);
    console.log(`[${new Date().toISOString()}] Status code:`, res.status);

    if (res.status !== 200) {
      console.log("❌ Server not reachable. Triggering reconnect...");
      reconnectNordVPN("Switch due to error");
    } else {
      console.log("✅ Server is reachable. No action needed.");
    }
  } catch (err) {
    console.log("❌ Error reaching server:", err.message);
    reconnectNordVPN("Switch due to error");
  }
}

// Run immediately
checkServer();

// Run health check every 1 min
setInterval(checkServer, 60000);

// Regular reconnect every 1 hour (3600000 ms)
setInterval(() => reconnectNordVPN("Regular switch"), 3600000);