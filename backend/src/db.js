const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
throw new Error('DATABASE_URL is missing. Add your Neon database URL to environment variables.');
}

const pool = new Pool({
connectionString: process.env.DATABASE_URL,

// Neon PostgreSQL requires SSL.
ssl: {
rejectUnauthorized: false
},

max: 10,
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 10000,
keepAlive: true
});

pool.on('error', (error) => {
console.error('Unexpected PostgreSQL pool error:', error.message);
});

async function query(text, params) {
return pool.query(text, params);
}

module.exports = {
pool,
query
};
