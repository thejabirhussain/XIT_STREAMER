const { Client } = require('pg');

async function cleanup() {
  console.log("Starting database cleanup...");
  const client = new Client({
    connectionString: 'postgresql://xit:xit_pass@localhost:5432/xit_streamer'
  });
  
  try {
    await client.connect();
    
    // Delete in order to respect foreign key constraints
    await client.query("DELETE FROM stream_health_snapshots");
    await client.query("DELETE FROM stream_destinations");
    await client.query("DELETE FROM livestream_sessions");
    
    // Delete any platform connections that are not our seeded mock ones
    const mockUser = '67a2701b-48da-4455-85fd-96e387689f15';
    await client.query("DELETE FROM platform_connections WHERE user_id != $1", [mockUser]);

    console.log("Database cleaned successfully! Stale sessions and destinations removed.");
  } catch (err) {
    console.error("Failed to clean database:", err);
  } finally {
    await client.end();
  }
}

cleanup();
