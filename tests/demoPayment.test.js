const test = require('node:test');
const assert = require('node:assert/strict');
const Booking = require('../models/bookingModel');
const Payment = require('../models/paymentModel');
const paymentController = require('../controllers/paymentController');
const mongoose = require('mongoose');

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    handler(
      req,
      { status() { return this; }, json(body) { resolve(body); } },
      reject,
    );
  });
}

test('demo payment fields are valid in the existing payment model', () => {
  const payment = new Payment({
    user: new mongoose.Types.ObjectId(),
    booking: new mongoose.Types.ObjectId(),
    amount: 125,
    currency: 'USD',
    provider: 'demo',
    paymentMethod: 'demo',
    reference: 'DEMO-VALID',
  });
  assert.equal(payment.validateSync(), undefined);
});

test('demo payment uses the saved booking amount and demo method', async () => {
  const originalFindById = Booking.findById;
  const originalFindOne = Payment.findOne;
  const originalCreate = Payment.create;
  let created;

  try {
    Booking.findById = async () => ({
      user: { toString: () => 'user-1' },
      status: 'pending',
      totalAmount: 125,
      bookingReference: 'ABC123',
      flight: { toString: () => 'flight-1' },
    });
    Payment.findOne = async () => null;
    Payment.create = async (data) => { created = data; return data; };

    const response = await invoke(paymentController.initializePayment, {
      body: { bookingId: 'booking-1', amount: 1 },
      user: { id: 'user-1' },
    });

    assert.equal(created.amount, 125);
    assert.equal(created.currency, 'USD');
    assert.equal(created.provider, 'demo');
    assert.equal(created.paymentMethod, 'demo');
    assert.equal(response.data.reference, created.reference);
  } finally {
    Booking.findById = originalFindById;
    Payment.findOne = originalFindOne;
    Payment.create = originalCreate;
  }
});

test('demo verification is tied to the user and confirms only once', async () => {
  const originalFindOne = Payment.findOne;
  let paymentSaves = 0;
  let bookingSaves = 0;
  const booking = {
    status: 'pending',
    paymentStatus: 'unpaid',
    async save() { bookingSaves += 1; },
  };
  const payment = {
    reference: 'DEMO-1',
    status: 'initiated',
    booking,
    async save() { paymentSaves += 1; },
  };

  try {
    Payment.findOne = (query) => {
      assert.deepEqual(query, {
        reference: 'DEMO-1',
        booking: 'booking-1',
        user: 'user-1',
      });
      return { populate: async () => payment };
    };
    const req = {
      query: { reference: 'DEMO-1', bookingId: 'booking-1' },
      user: { id: 'user-1' },
    };

    await invoke(paymentController.verifyDummyPayment, req);
    await invoke(paymentController.verifyDummyPayment, req);

    assert.equal(payment.status, 'success');
    assert.equal(booking.status, 'confirmed');
    assert.equal(booking.paymentStatus, 'paid');
    assert.equal(paymentSaves, 1);
    assert.equal(bookingSaves, 1);
  } finally {
    Payment.findOne = originalFindOne;
  }
});
