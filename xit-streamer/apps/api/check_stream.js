const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://xit:xit_pass@localhost:5432/xit_streamer'
  });
  
  try {
    await client.connect();
    
    const sessionRes = await client.query("SELECT * FROM livestream_sessions ORDER BY created_at DESC LIMIT 1");
    const session = sessionRes.rows[0];
    
    if (!session) {
      console.log("No sessions found.");
      return;
    }
    
    console.log("=== Livestream Session ===");
    console.log(JSON.stringify(session, null, 2));
    
    const destRes = await client.query("SELECT * FROM stream_destinations WHERE session_id = $1", [session.id]);
    console.log("\n=== Stream Destinations ===");
    console.log(JSON.stringify(destRes.rows, null, 2));

    const healthRes = await client.query("SELECT * FROM stream_health_snapshots WHERE session_id = $1 ORDER BY snapshot_at DESC LIMIT 5", [session.id]);
    console.log("\n=== Latest Health Snapshots ===");
    console.log(JSON.stringify(healthRes.rows, null, 2));
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

check();
