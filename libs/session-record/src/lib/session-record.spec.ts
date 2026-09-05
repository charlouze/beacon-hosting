import { sessionRecord } from './session-record.js';

describe('sessionRecord', () => {
  it('should work', () => {
    expect(sessionRecord()).toEqual('session-record');
  });
});
