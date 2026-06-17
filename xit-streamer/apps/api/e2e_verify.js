const crypto = require('crypto');
const { Client } = require('pg');
const axios = require('axios');
const { spawn } = require('child_process');

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2EyNzAxYi00OGRhLTQ0NTUtODVmZC05NmUzODc2ODlmMTUiLCJlbWFpbCI6InRoZS1qYWJpci11bml2ZS02MTQ4QHBhZ2VzLnBsdXNnb29nbGUuY29tIiwiaWF0IjoxNzgxNzMyMjQyLCJleHAiOjE3ODIzMzcwNDJ9.rI8gWFZicX2AASzHlpe780DHJJDiOst3cq98Smgaeuo";
const ENCRYPTION_KEY = "faf338d889377c7994b867ffe648b73aefaa01c87dad5b78ee006d866576470f";
const key = Buffer.from(ENCRYPTION_KEY, 'hex');

function decrypt(encryptedData) {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) return encryptedData;
  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

async function run() {
  console.log("=== 1. Starting E2E Livestream Pipeline Verification ===");
  
  // Create Stream Session via API
  console.log("Creating stream session via API...");
  const createRes = await axios.post("http://localhost:4000/api/streams", {
    title: "E2E YouTube and Facebook Livestream Verification",
    ingestType: "rtmp"
  }, {
    headers: { Authorization: `Bearer ${JWT}` }
  });
  
  const session = createRes.data.data;
  const sessionId = session.id;
  const streamKey = session.streamKey;
  console.log(`Stream Session Created: ID=${sessionId}, StreamKey=${streamKey}`);
  console.log(`RTMP Ingest URL: ${session.rtmpIngestUrl}`);
  
  // Connect OBS to SRS simulation using FFmpeg testsrc
  console.log("\n=== 2. Starting RTMP Ingest Simulation (FFmpeg pushing to SRS) ===");
  const rtmpUrl = `rtmp://localhost:1935/live/${streamKey}`;
  const ffmpegPush = spawn("ffmpeg", [
    "-re",
    "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30",
    "-f", "lavfi", "-i", "sine=frequency=1000",
    "-c:v", "libx264", "-preset", "veryfast",
    "-c:a", "aac",
    "-f", "flv", rtmpUrl
  ], {
    stdio: 'ignore',
    detached: true
  });
  ffmpegPush.unref();
  console.log(`FFmpeg pushing simulation started. PID: ${ffmpegPush.pid}`);

  // Wait for session to start, destinations to populate, and FFmpeg forwarder to launch
  console.log("\n=== 3. Waiting for SRS on_publish and automatic forwarder launch ===");
  let dbSession = null;
  let attempt = 0;
  const maxAttempts = 30; // 30 seconds
  
  const client = new Client({ connectionString: 'postgresql://xit:xit_pass@localhost:5432/xit_streamer' });
  await client.connect();
  
  while (attempt < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await client.query("SELECT * FROM livestream_sessions WHERE id = $1", [sessionId]);
    dbSession = res.rows[0];
    if (dbSession && dbSession.status === 'live') {
      console.log(`Stream transitioned to live! Status: ${dbSession.status}`);
      break;
    }
    console.log(`Polling stream status: ${dbSession ? dbSession.status : 'unknown'} (Attempt ${attempt + 1}/${maxAttempts})`);
    attempt++;
  }
  
  if (!dbSession || dbSession.status !== 'live') {
    console.error("Verification failed: Stream did not transition to live status.");
    ffmpegPush.kill();
    await client.end();
    process.exit(1);
  }

  // Display database records and destinations
  console.log("\n=== 4. Fetching Database Records ===");
  const destRes = await client.query("SELECT * FROM stream_destinations WHERE session_id = $1", [sessionId]);
  console.log("--- livestream_sessions Record ---");
  console.log(JSON.stringify(dbSession, null, 2));
  console.log("--- stream_destinations Records ---");
  console.log(JSON.stringify(destRes.rows, null, 2));
  
  // Transition YouTube Broadcast to live via YouTube API
  console.log("\n=== 5. Transitioning YouTube Broadcast to live ===");
  const connRes = await client.query("SELECT * FROM platform_connections WHERE platform = 'youtube' AND user_id = $1", [dbSession.user_id]);
  const ytConnection = connRes.rows[0];
  if (ytConnection && dbSession.youtube_broadcast_id) {
    const accessToken = decrypt(ytConnection.encrypted_access_token);
    try {
      console.log(`Polling YouTube Live Stream Ingestion status (ID: ${dbSession.youtube_stream_id})...`);
      let streamStatus = 'inactive';
      for (let i = 0; i < 20; i++) {
        const streamCheck = await axios.get('https://www.googleapis.com/youtube/v3/liveStreams', {
          params: { part: 'status', id: dbSession.youtube_stream_id },
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const streamItem = streamCheck.data.items?.[0];
        streamStatus = streamItem?.status?.streamStatus || 'inactive';
        console.log(`YouTube Ingestion Status: ${streamStatus} (check ${i + 1}/20)`);
        if (streamStatus === 'active') {
          break;
        }
        await new Promise(r => setTimeout(r, 4000));
      }
      
      console.log(`Transitioning YouTube Broadcast ID ${dbSession.youtube_broadcast_id} to live...`);
      const transRes = await axios.post(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts/transition',
        null,
        {
          params: {
            broadcastStatus: 'live',
            id: dbSession.youtube_broadcast_id,
            part: 'id,status'
          },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
      console.log('YouTube transition API Response:', JSON.stringify(transRes.data, null, 2));
    } catch (err) {
      console.error('YouTube transition failed:', err.response?.data || err.message);
    }
  }

  // Verify running FFmpeg command on the host
  console.log("\n=== 6. Checking Running FFmpeg Processes on host ===");
  const { execSync } = require('child_process');
  try {
    const psOut = execSync('ps aux | grep ffmpeg | grep -v grep').toString();
    console.log(psOut);
  } catch (err) {
    console.error('Failed to list FFmpeg processes:', err.message);
  }

  // Clean up: Wait for user verification, then end stream
  console.log("\n=== 7. Stream is ACTIVE and live. Keeping active for 5 minutes for validation... ===");
  await new Promise(r => setTimeout(r, 300000));

  console.log("Ending stream via API...");
  const endRes = await axios.post(`http://localhost:4000/api/streams/${sessionId}/end`, {}, {
    headers: { Authorization: `Bearer ${JWT}` }
  });
  console.log("End API Response status:", endRes.status);
  
  ffmpegPush.kill();
  console.log("FFmpeg ingest simulation terminated.");
  
  await client.end();
  console.log("=== Verification Script Completed successfully ===");
}

run().catch(err => {
  console.error("Error running verification script:", err);
  process.exit(1);
});
