const mongoose = require('mongoose');

const dbURI = 'mongodb://localhost:27017/swiggi'; //  URI MongoDB 

const connectDB = async () => {
  try {
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB successfully.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Quá trình thoát bị lỗi
  }
};

module.exports = connectDB;
