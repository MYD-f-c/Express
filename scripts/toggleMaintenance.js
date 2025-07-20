const mongoose = require('mongoose');
const { Settings } = require('../models');
require('dotenv').config();

async function toggleMaintenance(enable = false) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sansligun', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get or create settings
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    // Toggle maintenance mode
    settings.maintenanceMode = enable;
    await settings.save();

    console.log(`Maintenance mode ${enable ? 'enabled' : 'disabled'}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Check command line argument
const arg = process.argv[2];
const enable = arg === 'on' || arg === 'true' || arg === '1';

toggleMaintenance(enable);
