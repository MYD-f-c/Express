const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'error', 'success', 'alert'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isSystemWide: {
    type: Boolean,
    default: true
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  expiresAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for better query performance
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1 });
notificationSchema.index({ isSystemWide: 1, expiresAt: 1 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark notification as read by a user
notificationSchema.methods.markAsRead = async function(userId) {
  const alreadyRead = this.readBy.some(
    read => read.userId.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.readBy.push({ userId, readAt: new Date() });
    await this.save();
  }
};

// Static method to get active notifications
notificationSchema.statics.getActiveNotifications = async function(userId = null) {
  const now = new Date();
  const query = {
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: now } }
    ]
  };

  if (userId) {
    query.$and = [
      {
        $or: [
          { isSystemWide: true },
          { targetUsers: userId }
        ]
      }
    ];
  } else {
    query.isSystemWide = true;
  }

  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .populate('createdBy', 'username email')
    .lean();
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
