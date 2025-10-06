import dbService from '../src/dbService.js';
try {
  await dbService.connect();
  const r = await dbService.query('SELECT 1 AS X');
  console.log('DB TEST RESULT:', r.recordset);
  await dbService.disconnect();
  process.exit(0);
} catch (e) {
  console.error('DB TEST FAILED', e);
  process.exit(1);
}
