const express = require('express');
const router = express.Router();
const { Notification } = require('../models');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Get all active notifications (admin can see all, users see system-wide or targeted)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.isAdmin ? null : req.user._id;
    const notifications = await Notification.getActiveNotifications(userId);
    
    // Mark which notifications user has read
    if (!req.user.isAdmin) {
      const notificationsWithReadStatus = notifications.map(notification => ({
        ...notification,
        isRead: notification.readBy.some(
          read => read.userId.toString() === req.user._id.toString()
        )
      }));
      return res.json(notificationsWithReadStatus);
    }
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Bildirimler yüklenirken hata oluştu' });
  }
});

// Create new notification (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'info',
      priority = 'medium',
      isSystemWide = true,
      targetUsers = [],
      expiresAt = null,
      metadata = {}
    } = req.body;

    const notification = new Notification({
      title,
      message,
      type,
      priority,
      isSystemWide,
      targetUsers,
      expiresAt,
      metadata,
      createdBy: req.user._id
    });

    await notification.save();
    
    res.status(201).json({
      message: 'Bildirim başarıyla oluşturuldu',
      notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Bildirim oluşturulurken hata oluştu' });
  }
});

// Mark notification as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Bildirim bulunamadı' });
    }

    await notification.markAsRead(req.user._id);
    
    res.json({ message: 'Bildirim okundu olarak işaretlendi' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Bildirim güncellenirken hata oluştu' });
  }
});

// Update notification (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      priority,
      isSystemWide,
      targetUsers,
      expiresAt,
      metadata
    } = req.body;

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      {
        title,
        message,
        type,
        priority,
        isSystemWide,
        targetUsers,
        expiresAt,
        metadata,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Bildirim bulunamadı' });
    }

    res.json({
      message: 'Bildirim başarıyla güncellendi',
      notification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ message: 'Bildirim güncellenirken hata oluştu' });
  }
});

// Delete notification (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Bildirim bulunamadı' });
    }

    res.json({ message: 'Bildirim başarıyla silindi' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Bildirim silinirken hata oluştu' });
  }
});

// Get notification statistics (admin only)
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalNotifications = await Notification.countDocuments();
    const activeNotifications = await Notification.countDocuments({
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });
    
    const typeStats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Notification.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalNotifications,
      activeNotifications,
      typeStats,
      priorityStats
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ message: 'İstatistikler yüklenirken hata oluştu' });
  }
});

module.exports = router;
