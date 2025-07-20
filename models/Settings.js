const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: {
    type: String,
    default: 'Platform şu anda bakımdadır. Lütfen daha sonra tekrar deneyin.'
  },
  registrationEnabled: {
    type: Boolean,
    default: true
  },
  lotteryAutoStart: {
    type: Boolean,
    default: false
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  pushNotifications: {
    type: Boolean,
    default: false
  },
  minTicketPrice: {
    type: Number,
    default: 10
  },
  maxTicketPrice: {
    type: Number,
    default: 1000
  },
  minParticipants: {
    type: Number,
    default: 10
  },
  commissionRate: {
    type: Number,
    default: 5
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
