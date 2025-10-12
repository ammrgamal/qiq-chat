#!/usr/bin/env node
// Wrapper to run enrichment for Kaspersky in lists 1 and 12
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const nodeExe = process.argv[0];
const script = new URL('./run-enrichment-db.mjs', import.meta.url).pathname;
const outFile = path.join(process.cwd(), 'enrichment-products12-kaspersky.json');

const child = spawn(nodeExe, [script, '--brand=Kaspersky', '--lists=1,12', '--limit=100'], { stdio: ['ignore','pipe','inherit'] });

let out = '';
child.stdout.on('data', chunk => { out += chunk.toString(); });
child.on('close', (code)=>{
	try {
		const obj = JSON.parse(out);
		if (obj && obj.ok){
			const preview = Array.isArray(obj.results)? obj.results.slice(0,20).map(r=>({ id:r.id, pn:r.pn, status:r.status, q:r.q })) : [];
			const final = { summary: { table: 'dbo.Products_12_Products', manufacturer: 'kaspersky', total: obj.total, enriched: obj.enriched, skipped: obj.skipped, failed: obj.failed }, preview };
			fs.writeFileSync(outFile, JSON.stringify(final, null, 2));
			console.log(`[wrapper] wrote ${outFile}`);
		} else {
			fs.writeFileSync(outFile, out);
		}
	} catch { fs.writeFileSync(outFile, out); }
	process.exit(code||0);
});

