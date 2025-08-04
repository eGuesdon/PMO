

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHmac } from 'crypto';
import {
  AuditService,
  FileAuditTransport,
  AuditEvent,
} from '../../core/utils/AuditService';

describe('AuditService', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const logFile = path.join(fixturesDir, 'audit.log');

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    try {
      await fs.unlink(logFile);
    } catch {
      // ignore if file does not exist
    }
  });

  beforeEach(() => {
    // Reset singleton instance between tests
    (AuditService as any).instance = undefined;
  });

  it('should log an event without HMAC signature', async () => {
    const transport = new FileAuditTransport(logFile);
    const service = AuditService.getInstance([transport]);
    await service.log({
      actor: 'test',
      event: 'TEST_EVENT',
      resource: 'res1',
      status: 'SUCCESS',
      details: { foo: 'bar' },
    });

    const data = await fs.readFile(logFile, 'utf-8');
    const lines = data.trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry: AuditEvent = JSON.parse(lines[0]);
    expect(entry.actor).toBe('test');
    expect(entry.event).toBe('TEST_EVENT');
    expect(entry.resource).toBe('res1');
    expect(entry.status).toBe('SUCCESS');
    expect(entry.details).toEqual({ foo: 'bar' });
    expect(entry.signature).toBeUndefined();
    expect(entry.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('should log an event with HMAC signature', async () => {
    const hmacKey = 'secretkey';
    const transport = new FileAuditTransport(logFile);
    const service = AuditService.getInstance([transport], hmacKey);
    await service.log({
      actor: 'test2',
      event: 'TEST_HMAC',
      resource: 'res2',
    });

    const data = await fs.readFile(logFile, 'utf-8');
    const lines = data.trim().split('\n');
    expect(lines.length).toBe(2);

    const entry: AuditEvent = JSON.parse(lines[1]);
    expect(entry.signature).toBeDefined();

    // Verify signature is correct
    const { signature, ...signedData } = entry;
    const expectedHmac = createHmac('sha256', hmacKey)
      .update(JSON.stringify(signedData))
      .digest('hex');
    expect(signature).toBe(expectedHmac);
  });
});