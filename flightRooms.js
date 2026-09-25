const roomForFlight = (flightId) => {
  if (typeof flightId !== 'string' || !/^[0-9a-f]{24}$/i.test(flightId)) {
    return null;
  }

  return `flight:${flightId.toLowerCase()}`;
};

const registerFlightRoomHandlers = (socket) => {
  socket.on('flight:subscribe', (flightId) => {
    const room = roomForFlight(flightId);
    if (room) socket.join(room);
  });

  socket.on('flight:unsubscribe', (flightId) => {
    const room = roomForFlight(flightId);
    if (room) socket.leave(room);
  });
};

module.exports = { roomForFlight, registerFlightRoomHandlers };
