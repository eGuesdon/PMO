import AuditService, { AuditTransport, AuditEvent } from '../../core/utils/AuditService';

describe('AuditService', () => {
  beforeEach(() => {
    AuditService.resetInstance();
  });

  it("écrit un événement d'audit avec HMAC", async () => {
    const events: AuditEvent[] = [];
    const mockTransport: AuditTransport = {
      write: async (entry: unknown) => {
        events.push(entry as AuditEvent);
      },
    };
    const hmacKey = 'test-key';
    const service = AuditService.getInstance([mockTransport], hmacKey);

    await service.log({
      actor: 'tester',
      event: 'TEST_EVENT',
      status: 'SUCCESS',
      resource: 'test-resource',
      details: { foo: 'bar' },
    });

    expect(events.length).toBe(1);
    const evt = events[0];
    expect(evt.actor).toBe('tester');
    expect(evt.event).toBe('TEST_EVENT');
    expect(evt.status).toBe('SUCCESS');
    expect(evt.resource).toBe('test-resource');
    expect(evt.details).toEqual({ foo: 'bar' });
    expect(typeof evt.hmac).toBe('string');
    expect(evt.hmac!.length).toBe(64); // SHA256 hex
  });
});
