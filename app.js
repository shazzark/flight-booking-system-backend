const express = require('express');
const morgan = require('morgan');
const AppError = require('./utilis/appError');
const globalErrorHandler = require('./controllers/errorController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const userRouter = require('./routes/userRoutes');
const flightRouter = require('./routes/flightRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const paymentRouter = require('./routes/paymentRoutes');

const app = express();

// ------------------- MIDDLEWARES -------------------
app.use(cookieParser());
app.set('trust proxy', 1);

// SECURITY HEADERS
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

// ------------------- CORS -------------------
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      ' http://192.168.0.146:3000',
      'https://skybookapp.vercel.app/',
    ],
    credentials: true,
    // exposedHeaders: ['Set-Cookie'],
    // Add these options:
    // allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    // methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }),
);

// Logger for requests
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ------------------- RATE LIMIT -------------------
// Update rate limiter section:
const limiter = rateLimit({
  max: 1000, // Increased for testing
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to all API routes
app.use('/api', limiter);

// // Apply rate limiting to all API routes
// app.use('/api', (req, res, next) => {
//   // Skip rate-limit for file uploads
//   if (
//     req.method === 'POST' &&
//     req.originalUrl.startsWith('/api/v1/properties')
//   ) {
//     return next();
//   }
//   limiter(req, res, next);
// });

// ------------------- BODY PARSERS -------------------
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// DATA SANITIZATION
// app.use(xss());
// app.use(mongoSanitize());

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ------------------- STATIC FILES & IMAGES -------------------
// Serve images with proper headers
app.use(
  '/api/v1/img',
  express.static(path.join(__dirname, 'public/img'), {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📸 Serving image: ${filePath}`);
      }
    },
  }),
);

app.use(
  '/img',
  express.static(path.join(__dirname, 'public/img'), {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📸 Serving image: ${filePath}`);
      }
    },
  }),
);

// ------------------- MULTER FOR FILE UPLOADS -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/img'); // save to public/img
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    cb(null, `property-${Date.now()}.${ext}`);
  },
});

const upload = multer({ storage });

// Example route to test image upload
app.post('/api/v1/upload', upload.single('image'), (req, res) => {
  res.status(201).json({ status: 'success', file: req.file });
});

// ------------------- ROUTES -------------------
// app.use('/api/v1/properties', propertiesRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/flights', flightRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/payments', paymentRouter);

// Test root route
app.get('/', (req, res) => {
  res
    .status(200)
    .json({ status: 'ok', message: ' flight booking system API is running' });
});

// ------------------- UNHANDLED ROUTES -------------------
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// GLOBAL ERROR HANDLER
app.use(globalErrorHandler);

module.exports = app;
