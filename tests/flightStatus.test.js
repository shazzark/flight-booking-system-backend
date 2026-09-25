const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Flight = require('../models/flightModel');
const Booking = require('../models/bookingModel');
const User = require('../models/userModel');
const flightRoutes = require('../routes/flightRoutes');

const newFlight = () =>
  new Flight({
    _id: new mongoose.Types.ObjectId(),
    airline: 'Demo Air',
    flightNumber: 'DA100',
    origin: 'JFK',
    destination: 'LAX',
    departureTime: new Date('2026-10-01T10:00:00Z'),
    arrivalTime: new Date('2026-10-01T13:00:00Z'),
    basePrice: 100,
    seatsAvailable: 10,
  });

test('flight model accepts the demo lifecycle and existing completed records', () => {
  assert.ok(Flight.schema.path('updatedAt'));
  assert.equal(Flight.schema.options.timestamps.createdAt, false);

  for (const status of [...Object.values(Flight.STATUS), 'completed']) {
    const flight = newFlight();
    flight.status = status;
    assert.equal(flight.validateSync(), undefined, status);
  }
  const flight = newFlight();
  flight.status = 'unknown';
  assert.ok(flight.validateSync()?.errors.status);
});

test('flight status PATCH requires admin and saves before cancelling bookings', async () => {
  const previousSecret = process.env.JWT_SECRET;
  const originalUserFindById = User.findById;
  const originalFlightFindById = Flight.findById;
  const originalBookingUpdateMany = Booking.updateMany;
  process.env.JWT_SECRET = 'flight-status-test-secret';

  const flight = newFlight();
  const calls = [];
  const events = [];
  const savedAt = new Date('2026-09-25T12:00:00.000Z');
  flight.save = async () => {
    assert.equal(flight.validateSync(), undefined);
    calls.push('save');
    flight.updatedAt = savedAt;
    return flight;
  };
  User.findById = async (id) => ({
    id,
    role: id === 'admin' ? 'admin' : 'user',
    changedPasswordAfter: () => false,
  });
  Flight.findById = async () => flight;
  Booking.updateMany = async () => {
    calls.push('cancel bookings');
  };

  const app = express();
  app.set('io', {
    to: (room) => ({
      emit: (name, payload) => {
        calls.push('emit');
        events.push({ room, name, payload });
      },
    }),
  });
  app.use(cookieParser());
  app.use(express.json());
  app.use('/flights', flightRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message });
  });
  const server = app.listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/flights/${flight.id}`;
    const patch = (token, status) =>
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
    const adminToken = jwt.sign({ id: 'admin' }, process.env.JWT_SECRET);
    const userToken = jwt.sign({ id: 'user' }, process.env.JWT_SECRET);

    assert.equal((await patch(null, 'boarding')).status, 401);
    assert.equal((await patch(userToken, 'boarding')).status, 403);
    assert.deepEqual(calls, []);
    assert.deepEqual(events, []);

    const boarding = await patch(adminToken, 'boarding');
    assert.equal(boarding.status, 200);
    assert.equal((await boarding.json()).data.flight.status, 'boarding');
    assert.deepEqual(calls, ['save', 'emit']);
    assert.deepEqual(events[0], {
      room: `flight:${flight.id}`,
      name: 'flight.updated',
      payload: {
        id: flight.id,
        status: Flight.STATUS.BOARDING,
        updatedAt: savedAt.toISOString(),
      },
    });

    const cancelled = await patch(adminToken, 'cancelled');
    assert.equal(cancelled.status, 200);
    assert.deepEqual(calls, [
      'save',
      'emit',
      'save',
      'cancel bookings',
      'emit',
    ]);
    assert.equal(events[1].payload.status, Flight.STATUS.CANCELLED);

    flight.status = Flight.STATUS.SCHEDULED;
    const cancelRoute = await fetch(`${url}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(cancelRoute.status, 200);
    assert.equal(
      (await cancelRoute.json()).data.flight.status,
      Flight.STATUS.CANCELLED,
    );
    assert.deepEqual(calls.slice(-3), ['save', 'cancel bookings', 'emit']);
    assert.deepEqual(events[2], {
      room: `flight:${flight.id}`,
      name: 'flight.updated',
      payload: {
        id: flight.id,
        status: Flight.STATUS.CANCELLED,
        updatedAt: savedAt.toISOString(),
      },
    });

    const emittedBeforeFailure = events.length;
    const successfulSave = flight.save;
    flight.save = async () => {
      throw new Error('save failed');
    };
    assert.equal((await patch(adminToken, 'delayed')).status, 500);
    assert.equal(events.length, emittedBeforeFailure);

    flight.save = successfulSave;
    flight.status = Flight.STATUS.SCHEDULED;
    Booking.updateMany = async () => {
      throw new Error('booking cancellation failed');
    };
    const failedCancellation = await fetch(`${url}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(failedCancellation.status, 500);
    assert.equal(events.length, emittedBeforeFailure);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    User.findById = originalUserFindById;
    Flight.findById = originalFlightFindById;
    Booking.updateMany = originalBookingUpdateMany;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
