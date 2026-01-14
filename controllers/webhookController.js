// webhookController.js
exports.paystackWebhook = catchAsync(async (req, res, next) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const payment = await Payment.findOne({
      reference: event.data.reference,
    });

    if (payment && payment.status === 'initiated') {
      payment.status = 'success';
      payment.transactionId = event.data.id;
      payment.completedAt = new Date();
      await payment.save();

      // Update booking
      const booking = await Booking.findById(payment.booking);
      booking.status = 'confirmed';
      booking.paymentStatus = 'paid';
      await booking.save();
    }
  }

  res.status(200).json({ received: true });
});
