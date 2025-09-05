#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import crypto from 'crypto';

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

const logFile = process.argv[2] || process.env.AUDIT_LOG_FILE || 'logs/audit.log';
const key = process.env.AUDIT_HMAC_KEY;

if (!fs.existsSync(logFile)) {
  console.error(`Log file not found: ${logFile}`);
  process.exit(2);
}
if (!key) {
  console.error(`AUDIT_HMAC_KEY is not set (dotenv or env)`);
  process.exit(2);
}

const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n').filter(Boolean);
let ok = 0,
  ko = 0,
  idx = 0;

for (const line of lines) {
  idx++;
  try {
    const obj = JSON.parse(line);
    const { hmac, ...toSign } = obj;
    const expected = crypto.createHmac('sha256', key).update(stableStringify(toSign)).digest('hex');
    if (hmac && hmac === expected) ok++;
    else ko++;
  } catch {
    ko++;
  }
}

console.log(JSON.stringify({ file: logFile, total: lines.length, ok, ko }, null, 2));
process.exit(ko > 0 ? 1 : 0);
