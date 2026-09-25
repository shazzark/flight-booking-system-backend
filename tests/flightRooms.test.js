const test = require('node:test');
const assert = require('node:assert/strict');
const { registerFlightRoomHandlers } = require('../flightRooms');

const flightId = '68ABC12368ABC12368ABC123';
const room = 'flight:68abc12368abc12368abc123';

const connectedSocket = () => {
  const handlers = new Map();
  const rooms = new Set();
  registerFlightRoomHandlers({
    on: (event, handler) => handlers.set(event, handler),
    join: (name) => rooms.add(name),
    leave: (name) => rooms.delete(name),
  });
  return { handlers, rooms };
};

test('subscribing to a valid flight ID joins its server-constructed room', () => {
  const { handlers, rooms } = connectedSocket();

  handlers.get('flight:subscribe')(flightId);

  assert.deepEqual([...rooms], [room]);
});

test('unsubscribing from a flight leaves its room', () => {
  const { handlers, rooms } = connectedSocket();
  handlers.get('flight:subscribe')(flightId);

  handlers.get('flight:unsubscribe')(flightId.toLowerCase());

  assert.equal(rooms.size, 0);
});

test('invalid flight IDs cannot change room membership', () => {
  const { handlers, rooms } = connectedSocket();
  handlers.get('flight:subscribe')(flightId);

  for (const invalid of ['admin:private', '68abc123', {}, null, 42]) {
    handlers.get('flight:subscribe')(invalid);
    handlers.get('flight:unsubscribe')(invalid);
  }

  assert.deepEqual([...rooms], [room]);
});
