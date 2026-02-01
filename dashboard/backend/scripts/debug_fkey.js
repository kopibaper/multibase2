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

    // 1. Get FK details
    const fkRes = await client.query(`
      SELECT
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'produkte_kategorie_id_fkey'
      LIMIT 1;
    `);

    if (fkRes.rows.length === 0) {
      console.log('Foreign key not found.');
      return;
    }

    const { foreign_table_name, foreign_column_name } = fkRes.rows[0];
    console.log(`Foreign Key references table: ${foreign_table_name} (${foreign_column_name})`);

    // 2. Fetch valid IDs
    const limit = 5;
    const rowsRes = await client.query(`SELECT * FROM "${foreign_table_name}" LIMIT ${limit}`);

    console.log(`\nValid entries from '${foreign_table_name}':`);
    if (rowsRes.rows.length === 0) {
      console.log('(Table is empty)');
    } else {
      console.table(rowsRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
