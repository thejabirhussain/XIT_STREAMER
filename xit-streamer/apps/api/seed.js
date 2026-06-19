const { Client } = require('pg');
const crypto = require('crypto');

const ENCRYPTION_KEY = "faf338d889377c7994b867ffe648b73aefaa01c87dad5b78ee006d866576470f";
const key = Buffer.from(ENCRYPTION_KEY, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

async function seed() {
  console.log("Starting database seeding...");
  const client = new Client({
    connectionString: 'postgresql://xit:xit_pass@localhost:5432/xit_streamer'
  });
  
  try {
    await client.connect();
    
    // Seed user
    const userId = '67a2701b-48da-4455-85fd-96e387689f15';
    const email = 'the-jabir-unive-6148@pages.plusgoogle.com';
    const name = 'Jabir Hussain';
    const avatarUrl = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop';
    
    await client.query(`
      INSERT INTO users (id, email, name, avatar_url, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET id = $1, name = $3, avatar_url = $4;
    `, [userId, email, name, avatarUrl]);
    
    console.log(`Seeded user: ID=${userId}, Email=${email}`);

    // Clean up ALL old destinations, health snapshots, sessions, and connections for this user first
    await client.query("DELETE FROM stream_health_snapshots");
    await client.query("DELETE FROM stream_destinations");
    await client.query("DELETE FROM livestream_sessions");
    await client.query("DELETE FROM platform_connections WHERE user_id = $1", [userId]);
    console.log("Cleared old sessions, destinations, snapshots, and connections for test user.");

    // Seed mock connections
    const connections = [
      {
        id: '11111111-2222-3333-4444-555555555555',
        platform: 'youtube',
        accountName: 'Mock YouTube Channel',
        accountId: 'mock_youtube_channel_id',
        encryptedAccessToken: encrypt('mock_youtube_token_123'),
        encryptedRefreshToken: encrypt('mock_youtube_refresh_123'),
      },
      {
        id: '22222222-3333-4444-5555-666666666666',
        platform: 'facebook',
        accountName: 'Mock Facebook Page',
        accountId: 'mock_facebook_page_id',
        encryptedAccessToken: encrypt('mock_facebook_token_123'),
      },
      {
        id: '33333333-4444-5555-6666-777777777777',
        platform: 'instagram',
        accountName: 'Mock Instagram Account',
        accountId: 'mock_instagram_account_id',
        encryptedAccessToken: encrypt('mock_instagram_token_123'),
      }
    ];

    for (const conn of connections) {
      await client.query(`
        INSERT INTO platform_connections (id, user_id, platform, account_name, account_id, avatar_url, encrypted_access_token, encrypted_refresh_token, token_expires_at, connection_status, last_synced_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW())
        ON CONFLICT (user_id, platform, account_id) 
        DO UPDATE SET encrypted_access_token = $7, encrypted_refresh_token = $8, connection_status = $10;
      `, [
        conn.id,
        userId,
        conn.platform,
        conn.accountName,
        conn.accountId,
        avatarUrl,
        conn.encryptedAccessToken,
        conn.encryptedRefreshToken || null,
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        'connected'
      ]);
      console.log(`Seeded mock connection: Platform=${conn.platform}, ID=${conn.id}`);
    }
    
    console.log("Database seeding completed successfully!");
    
  } catch (err) {
    console.error("Failed to seed database:", err);
  } finally {
    await client.end();
  }
}

seed();
