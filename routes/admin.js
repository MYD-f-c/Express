const express = require('express');
const { User, Lottery, Announcement, Settings } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Get all users (admin only)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Update user status (admin only)
router.put('/users/:userId/status', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'Geçersiz durum' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Don't delete admin users
    if (user.isAdmin) {
      return res.status(403).json({ message: 'Admin kullanıcılar silinemez' });
    }

    await User.findByIdAndDelete(userId);
    res.json({ message: 'Kullanıcı başarıyla silindi' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Get dashboard stats (admin only)
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const bannedUsers = await User.countDocuments({ status: 'banned' });
    const totalLotteries = await Lottery.countDocuments();
    const activeLottery = await Lottery.findOne({ status: 'active' });
    
    // Calculate total revenue
    const lotteries = await Lottery.find();
    const totalRevenue = lotteries.reduce((sum, lottery) => {
      return sum + (lottery.participants.length * lottery.ticketPrice);
    }, 0);

    res.json({
      totalUsers,
      activeUsers,
      bannedUsers,
      totalLotteries,
      activeLottery: !!activeLottery,
      totalRevenue
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Get all lotteries with details (admin only)
router.get('/lotteries', auth, adminAuth, async (req, res) => {
  try {
    const lotteries = await Lottery.find()
      .populate('winner', 'fullName email tcNo')
      .sort({ createdAt: -1 });
    
    res.json(lotteries);
  } catch (error) {
    console.error('Error fetching lotteries:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Create new lottery (admin only)
router.post('/lotteries', auth, adminAuth, async (req, res) => {
  try {
    const { prizeAmount, ticketPrice, maxParticipants, drawDate } = req.body;

    // Check if there's already an active lottery
    const activeLottery = await Lottery.findOne({ status: 'active' });
    if (activeLottery) {
      return res.status(400).json({ message: 'Zaten aktif bir çekiliş var' });
    }

    const lottery = new Lottery({
      prizeAmount,
      ticketPrice,
      maxParticipants,
      drawDate: new Date(drawDate),
      participants: [],
      status: 'active'
    });

    await lottery.save();
    res.status(201).json(lottery);
  } catch (error) {
    console.error('Error creating lottery:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Update lottery (admin only)
router.put('/lotteries/:lotteryId', auth, adminAuth, async (req, res) => {
  try {
    const { lotteryId } = req.params;
    const updates = req.body;

    const lottery = await Lottery.findByIdAndUpdate(
      lotteryId,
      updates,
      { new: true }
    );

    if (!lottery) {
      return res.status(404).json({ message: 'Çekiliş bulunamadı' });
    }

    res.json(lottery);
  } catch (error) {
    console.error('Error updating lottery:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Delete lottery (admin only)
router.delete('/lotteries/:lotteryId', auth, adminAuth, async (req, res) => {
  try {
    const { lotteryId } = req.params;

    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      return res.status(404).json({ message: 'Çekiliş bulunamadı' });
    }

    // Don't delete if lottery has participants
    if (lottery.participants.length > 0) {
      return res.status(400).json({ message: 'Katılımcısı olan çekilişler silinemez' });
    }

    await Lottery.findByIdAndDelete(lotteryId);
    res.json({ message: 'Çekiliş başarıyla silindi' });
  } catch (error) {
    console.error('Error deleting lottery:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Get payment history (admin only)
router.get('/payments', auth, adminAuth, async (req, res) => {
  try {
    // In a real app, you would have a Payment model
    // For now, we'll aggregate from user participations
    const users = await User.find()
      .populate('participations.lotteryId')
      .select('fullName email participations');

    const payments = [];
    users.forEach(user => {
      user.participations.forEach(participation => {
        if (participation.lotteryId) {
          payments.push({
            userId: user._id,
            userName: user.fullName,
            userEmail: user.email,
            lotteryId: participation.lotteryId._id,
            amount: participation.lotteryId.ticketPrice,
            ticketCount: participation.ticketCount,
            totalAmount: participation.lotteryId.ticketPrice * participation.ticketCount,
            date: participation.date
          });
        }
      });
    });

    // Sort by date
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Announcement routes

// Get all announcements (admin only)
router.get('/announcements', auth, adminAuth, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });
    
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Create announcement (admin only)
router.post('/announcements', auth, adminAuth, async (req, res) => {
  try {
    const { title, content, type } = req.body;

    const announcement = new Announcement({
      title,
      content,
      type,
      createdBy: req.user.userId,
      isActive: true
    });

    await announcement.save();
    await announcement.populate('createdBy', 'fullName');
    
    res.status(201).json(announcement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Update announcement (admin only)
router.put('/announcements/:announcementId', auth, adminAuth, async (req, res) => {
  try {
    const { announcementId } = req.params;
    const updates = req.body;

    const announcement = await Announcement.findByIdAndUpdate(
      announcementId,
      updates,
      { new: true }
    ).populate('createdBy', 'fullName');

    if (!announcement) {
      return res.status(404).json({ message: 'Duyuru bulunamadı' });
    }

    res.json(announcement);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Toggle announcement status (admin only)
router.put('/announcements/:announcementId/toggle', auth, adminAuth, async (req, res) => {
  try {
    const { announcementId } = req.params;

    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return res.status(404).json({ message: 'Duyuru bulunamadı' });
    }

    announcement.isActive = !announcement.isActive;
    await announcement.save();
    await announcement.populate('createdBy', 'fullName');

    res.json(announcement);
  } catch (error) {
    console.error('Error toggling announcement:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Delete announcement (admin only)
router.delete('/announcements/:announcementId', auth, adminAuth, async (req, res) => {
  try {
    const { announcementId } = req.params;

    const announcement = await Announcement.findByIdAndDelete(announcementId);
    if (!announcement) {
      return res.status(404).json({ message: 'Duyuru bulunamadı' });
    }

    res.json({ message: 'Duyuru başarıyla silindi' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Select winners for lottery (admin only or automatic)
router.post('/lotteries/:lotteryId/select-winners', auth, adminAuth, async (req, res) => {
  try {
    const { lotteryId } = req.params;
    
    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      return res.status(404).json({ message: 'Çekiliş bulunamadı' });
    }

    if (lottery.status !== 'active') {
      return res.status(400).json({ message: 'Bu çekiliş aktif değil' });
    }

    // Select 4 winners randomly from participants
    const participantIds = lottery.participants;
    const numberOfWinners = Math.min(4, participantIds.length);
    
    if (participantIds.length === 0) {
      return res.status(400).json({ message: 'Bu çekilişte katılımcı yok' });
    }

    // Shuffle array and pick winners
    const shuffled = [...participantIds].sort(() => 0.5 - Math.random());
    const winnerIds = shuffled.slice(0, numberOfWinners);
    
    // Calculate prize per winner
    const totalPrize = participantIds.length * lottery.ticketPrice;
    const prizePerWinner = Math.floor(totalPrize / numberOfWinners);

    // Update winners in database
    lottery.winners = winnerIds.map(userId => ({
      userId,
      amount: prizePerWinner,
      date: new Date()
    }));
    lottery.status = 'completed';
    lottery.totalAmount = totalPrize;
    await lottery.save();

    // Update each winner's winnings array
    for (const winnerId of winnerIds) {
      await User.findByIdAndUpdate(winnerId, {
        $push: {
          winnings: {
            lotteryId: lottery._id,
            amount: prizePerWinner,
            date: new Date()
          }
        }
      });
    }

    // Populate winner details for response
    const populatedLottery = await Lottery.findById(lotteryId)
      .populate('winners.userId', 'fullName email tcNo');

    res.json({
      message: `${numberOfWinners} kazanan seçildi`,
      lottery: populatedLottery,
      totalPrize,
      prizePerWinner,
      winners: populatedLottery.winners
    });
  } catch (error) {
    console.error('Error selecting winners:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Settings routes

// Get system settings (admin only)
router.get('/settings', auth, adminAuth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Update system settings (admin only)
router.put('/settings', auth, adminAuth, async (req, res) => {
  try {
    const updates = req.body;
    
    // Get current settings and update only provided fields
    const settings = await Settings.getSettings();
    
    // Update only the fields that were sent
    Object.keys(updates).forEach(key => {
      if (settings.schema.paths[key]) {
        settings[key] = updates[key];
      }
    });
    
    await settings.save();
    
    res.json({ message: 'Ayarlar güncellendi', settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Reset all data (admin only) - DANGEROUS!
router.post('/reset-data', auth, adminAuth, async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Bu işlem production ortamında yapılamaz' });
    }
    
    // Delete all non-admin users
    await User.deleteMany({ isAdmin: false });
    
    // Delete all lotteries
    await Lottery.deleteMany({});
    
    // Delete all announcements
    await Announcement.deleteMany({});
    
    res.json({ message: 'Tüm veriler sıfırlandı' });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

module.exports = router;
