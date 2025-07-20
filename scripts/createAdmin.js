const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { User } = require('../models');

// Load env vars
dotenv.config();

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sansligun', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Check if admin exists
    const adminExists = await User.findOne({ tcNo: '99999999999' });
    
    if (adminExists) {
      console.log('Admin user already exists');
      console.log('Admin info:', {
        id: adminExists._id,
        tcNo: adminExists.tcNo,
        fullName: adminExists.fullName,
        email: adminExists.email,
        isAdmin: adminExists.isAdmin
      });
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Abdullah223', salt);

    // Create admin user
    const adminUser = new User({
      tcNo: '99999999999',
      fullName: 'Admin Kullanıcı',
      email: 'admin@sansligun.com',
      iban: 'TR000000000000000000000000',
      password: hashedPassword,
      isAdmin: true,
      status: 'active',
      participations: [],
      winnings: [],
      lastLogin: new Date()
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Login credentials:');
    console.log('TC No: 99999999999');
    console.log('Password: Abdullah223');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
