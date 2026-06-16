const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codealpha_meet',
      {
        serverSelectionTimeoutMS: 2000, // Wait 2s before timing out
      }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    console.log('MongoDB local service is offline. Running server in In-Memory Mock DB Mode.');
    global.isMockDB = true;
  }
};

module.exports = connectDB;
