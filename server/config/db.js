const mongoose = require("mongoose");

/**
 * Connect to MongoDB Atlas using Mongoose.
 * Exits the process on connection failure to prevent the server
 * from running without a database.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};
module.exports = connectDB;
