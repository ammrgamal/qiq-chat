#!/usr/bin/env node
// Orchestrates safe sample enrichment: backup -> enrichment sample
import { spawnSync } from 'child_process';

function run(cmd, args, env){
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed with ${r.status}`);
}

async function main(){
  console.log('[preenrich] Step 1: Backup');
  try { run('node', ['scripts/backup-db.mjs']); } catch (e){
    console.error('[preenrich] Backup failed:', e.message); process.exit(2);
  }
  console.log('[preenrich] Step 2: Schema verify');
  try { run('sqlcmd', ['-S', process.env.SQL_SERVER, '-d', process.env.SQL_DB, '-i', 'scripts/schema-verify.sql']); } catch (e){
    console.error('[preenrich] Schema verify failed (continuing) ->', e.message);
  }
  console.log('[preenrich] Step 3: Enrichment sample');
  try { run('node', ['scripts/enrich-sample.mjs']); } catch (e){
    console.error('[preenrich] Enrichment failed:', e.message); process.exit(3);
  }
  console.log('[preenrich] Completed successfully');
}

main();