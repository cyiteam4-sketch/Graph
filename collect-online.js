
const fs = require("node:fs");
const path = require("node:path");

const API_URL =
  "https://core-hub-eej1.onrender.com/api/online";

const HISTORY_FILE = path.join(
  __dirname,
  "data",
  "online-history.json"
);

const RETENTION_MS = 24 * 60 * 60 * 1000;

async function collectOnlineData() {
  console.log("Pinging Core Hub Games...");

  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CoreHub-Analytics/1.0"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const now = new Date();
  const timestamp = now.toISOString();

  const directory = path.dirname(HISTORY_FILE);
  fs.mkdirSync(directory, { recursive: true });

  let history = {
    updatedAt: null,
    intervalMinutes: 15,
    retentionHours: 24,
    snapshots: []
  };

  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const saved = JSON.parse(
        fs.readFileSync(HISTORY_FILE, "utf8")
      );

      if (Array.isArray(saved.snapshots)) {
        history = { ...history, ...saved };
      }
    } catch {
      console.warn("Existing history was invalid; starting fresh.");
    }
  }

  // Keep only records from the last 24 hours.
  const cutoff = now.getTime() - RETENTION_MS;

  history.snapshots = history.snapshots.filter((snapshot) => {
    const time = Date.parse(snapshot.timestamp);
    return Number.isFinite(time) && time >= cutoff;
  });

  // Save the complete API JSON response with its timestamp.
  history.snapshots.push({
    timestamp,
    data
  });

  history.updatedAt = timestamp;
  history.intervalMinutes = 15;
  history.retentionHours = 24;

  fs.writeFileSync(
    HISTORY_FILE,
    JSON.stringify(history, null, 2) + "\n",
    "utf8"
  );

  console.log(`Snapshot saved at ${timestamp}`);
  console.log(`Snapshots retained: ${history.snapshots.length}`);
  console.log(`JSON saved to ${HISTORY_FILE}`);
}

collectOnlineData().catch((error) => {
  console.error("Analytics collection failed:", error.message);
  process.exitCode = 1;
});
