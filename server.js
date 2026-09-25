const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const corsOrigins = require('./corsOrigins');
const { registerFlightRoomHandlers } = require('./flightRooms');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);
mongoose.connect(DB, {}).then(() => {
  console.log('Db connection succesful');
});

const port = process.env.PORT || 5000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});
app.set('io', io);

io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Socket client connected');
  }

  registerFlightRoomHandlers(socket);

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Socket client disconnected');
    }
  });
});

server.listen(port, () => {
  console.log(`app running at port ${port}...`);
});
