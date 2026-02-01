const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'XUXjCNF5tMoaA4lia4F0eJBSGjz0U1IB',
  port: 9243,
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT pg_get_constraintdef(c.oid) AS constraint_def
      FROM pg_constraint c
      WHERE c.conname = 'produkte_zustand_check';
    `);
    console.log('CONSTRAINT DEF:', res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
