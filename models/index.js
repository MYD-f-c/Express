const mongoose = require('mongoose');

const lotterySchema = new mongoose.Schema({
  prizeAmount: {
    type: Number,
    default: 10000
  },
  ticketPrice: {
    type: Number,
    default: 100
  },
  maxParticipants: {
    type: Number,
    default: 1000
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  drawDate: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  winners: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    date: Date
  }]
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  tcNo: {
    type: String,
    required: [true, 'T.C. Kimlik No zorunludur'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{11}$/.test(v);
      },
      message: 'T.C. Kimlik No tam 11 haneli olmalıdır'
    }
  },
  fullName: {
    type: String,
    required: [true, 'İsim ve Soyisim zorunludur'],
    trim: true,
    maxlength: [43, 'İsim Soyisim 43 karakterden uzun olamaz']
  },
  email: {
    type: String,
    required: [true, 'E-posta alanı zorunludur'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Lütfen geçerli bir e-posta adresi girin'
    ]
  },
  iban: {
    type: String,
    required: [true, 'IBAN zorunludur'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^TR[0-9]{24}$/.test(v);
      },
      message: 'IBAN 26 haneli olmalı ve TR ile başlamalıdır'
    }
  },
  password: {
    type: String,
    required: [true, 'Şifre alanı zorunludur'],
    minlength: [6, 'Şifre en az 6 karakter olmalıdır']
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'banned', 'warned', 'timeout'],
    default: 'active'
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  participations: [{
    lotteryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lottery',
      required: true
    },
    ticketNumber: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  winnings: [{
    lotteryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lottery',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Kazanç miktarı 0\'dan küçük olamaz']
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  notificationSettings: {
    pushEnabled: {
      type: Boolean,
      default: true
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    winnerNotifications: {
      type: Boolean,
      default: true
    },
    drawNotifications: {
      type: Boolean,
      default: true
    },
    promotionNotifications: {
      type: Boolean,
      default: false
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Announcement Schema
const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error'],
    default: 'info'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const Lottery = mongoose.model('Lottery', lotterySchema);
const User = mongoose.model('User', userSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);

const Settings = require('./Settings');
const Notification = require('./Notification');

module.exports = { Lottery, User, Announcement, Settings, Notification };
