#!/usr/bin/env node
// Minimal email test to verify provider setup
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const { sendEmail } = await import('../../api/_lib/email.js');
const to = process.env.ENRICH_NOTIFY_TO || process.env.EMAIL_TO || process.env.ADMIN_EMAIL;
if (!to){
  console.error('Missing ENRICH_NOTIFY_TO (or EMAIL_TO/ADMIN_EMAIL)');
  process.exit(2);
}
const samplePath = path.join(process.cwd(), 'email-sample.txt');
fs.writeFileSync(samplePath, `Email test at ${new Date().toISOString()}\n`);
const res = await sendEmail({ to, subject: 'Email test from rules-engine', html: '<p>Test OK</p>', attachments: [{ filename: 'email-sample.txt', path: samplePath, mimeType: 'text/plain' }] });
console.log(JSON.stringify(res, null, 2));
