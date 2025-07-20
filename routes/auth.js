const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const auth = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    console.log('Register request received:', req.body);
    const { tcNo, fullName, email, iban, password, termsAccepted } = req.body;

    // Validate input
    if (!tcNo || !fullName || !email || !iban || !password || !termsAccepted) {
      return res.status(400).json({ 
        message: 'Lütfen tüm alanları doldurun',
        missingFields: {
          tcNo: !tcNo,
          fullName: !fullName,
          email: !email,
          iban: !iban,
          password: !password,
          termsAccepted: !termsAccepted
        }
      });
    }

    if (!termsAccepted) {
      return res.status(400).json({ message: 'Kullanım şartları kabul edilmelidir' });
    }

    // Check if user already exists
    console.log('Checking if user exists:', email);
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Bu e-posta adresi zaten kayıtlı' });
    }

    // Hash password
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if user is admin
    const isAdmin = tcNo === '99999999999' && password === 'Abdullah223';

    // Create new user
    console.log('Creating new user...');
    const user = new User({
      tcNo,
      fullName,
      email,
      iban,
      password: hashedPassword,
      isAdmin,
      participations: [],
      winnings: [],
      status: 'active',
      lastLogin: new Date()
    });

    // Save user to database
    console.log('Saving user to database...');
    const savedUser = await user.save();
    console.log('User saved successfully:', savedUser._id);

    // Generate JWT
    console.log('Generating JWT...');
    const token = jwt.sign(
      { 
        userId: savedUser._id,
        isAdmin: savedUser.isAdmin 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('Registration successful');
    res.status(201).json({
      id: savedUser._id,
      tcNo: savedUser.tcNo,
      fullName: savedUser.fullName,
      email: savedUser.email,
      iban: savedUser.iban,
      isAdmin: savedUser.isAdmin,
      status: savedUser.status,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ 
      message: 'Sunucu hatası', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { tcNo, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ tcNo });
    if (!user) {
      return res.status(400).json({ message: 'Geçersiz T.C. Kimlik No veya şifre' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Geçersiz T.C. Kimlik No veya şifre' });
    }

    // Check if user is banned
    if (user.status === 'banned') {
      return res.status(403).json({ 
        message: 'Hesabınız askıya alındı',
        status: user.status
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { 
        userId: user._id,
        isAdmin: user.isAdmin 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      id: user._id,
      tcNo: user.tcNo,
      fullName: user.fullName,
      email: user.email,
      iban: user.iban,
      isAdmin: user.isAdmin,
      status: user.status,
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('participations.lotteryId')
      .populate('winnings.lotteryId');

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Change password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Lütfen tüm alanları doldurun' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Yeni şifre en az 6 karakter olmalıdır' });
    }

    // Get user with password
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mevcut şifre yanlış' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Şifre başarıyla değiştirildi' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Update notification settings
router.put('/notification-settings', auth, async (req, res) => {
  try {
    const { notificationSettings } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Update notification settings
    user.notificationSettings = {
      pushEnabled: notificationSettings.pushEnabled || false,
      emailEnabled: notificationSettings.emailEnabled || false,
      winnerNotifications: notificationSettings.winnerNotifications || false,
      drawNotifications: notificationSettings.drawNotifications || false,
      promotionNotifications: notificationSettings.promotionNotifications || false
    };

    await user.save();

    res.json({ 
      message: 'Bildirim ayarları güncellendi',
      notificationSettings: user.notificationSettings 
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Get notification settings
router.get('/notification-settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('notificationSettings');
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    res.json({ 
      notificationSettings: user.notificationSettings || {
        pushEnabled: true,
        emailEnabled: true,
        winnerNotifications: true,
        drawNotifications: true,
        promotionNotifications: false
      }
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

module.exports = router;
