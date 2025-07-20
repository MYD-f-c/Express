const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { User } = require('../models');

// Load env vars
dotenv.config();

async function resetAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sansligun', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Delete existing admin if exists
    const deletedAdmin = await User.findOneAndDelete({ tcNo: '99999999999' });
    
    if (deletedAdmin) {
      console.log('Existing admin user deleted');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Abdullah223', salt);

    // Create new admin user
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
    console.error('Error resetting admin user:', error);
    process.exit(1);
  }
}

resetAdminUser();
