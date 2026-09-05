import { session } from './session.js';

describe('session', () => {
  it('should work', () => {
    expect(session()).toEqual('session');
  });
});
