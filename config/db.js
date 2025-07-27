//const mongoose = require('mongoose');
//require('dotenv').config();

//const connectDB = async () => {
 // try {
   // await mongoose.connect(process.env.MONGO_URI);
    //console.log('✅ MongoDB Connected');
  //} catch (err) {
   // console.error('❌ MongoDB connection error:', err.message);
   // process.exit(1);
  //}
//};

//module.exports = connectDB;

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
// This code connects to a MongoDB database using Mongoose, with error handling for connection issues.
// It uses environment variables for configuration, ensuring sensitive information is not hard-coded.