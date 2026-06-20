const mongoose = require('mongoose');

const connectMongoDB = async () => {
  try {
    const { MONGO_HOST, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DATABASE } = process.env;

    let uri;
    if (MONGO_USER && MONGO_PASSWORD) {
      uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=admin`;
    } else {
      uri = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`;
    }

    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = { connectMongoDB };
