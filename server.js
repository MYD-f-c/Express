const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const { Lottery, User } = require('./models');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const checkMaintenance = require('./middleware/checkMaintenance');
const { initializeLotteryScheduler } = require('./utils/lotteryScheduler');

// Load env vars
dotenv.config();

// Initialize express
const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sansligun', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    // Initialize lottery scheduler after DB connection
    initializeLotteryScheduler();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Middleware
app.use(cors({
  origin: '*', // Development için tüm origin'lere izin ver
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Debug middleware - log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// Maintenance mode middleware - apply to all routes
app.use(checkMaintenance);

// Routes
app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Get current lottery stats
app.get('/api/lottery/stats', async (req, res) => {
  try {
    const currentLottery = await Lottery.findOne({ status: 'active' });
    
    if (!currentLottery) {
      // Aktif çekiliş yoksa varsayılan değerler döndür
      return res.json({
        participants: 0,
        totalAmount: 0,
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 saat sonra
      });
    }
    
    res.json({
      participants: currentLottery.participants.length,
      totalAmount: currentLottery.totalAmount,
      endDate: currentLottery.endDate
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get last winners
app.get('/api/lottery/winners', async (req, res) => {
  try {
    const completedLotteries = await Lottery.find({ status: 'completed' })
      .populate('winners.userId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(5);
    
    const winners = completedLotteries.flatMap(lottery => 
      lottery.winners.map(winner => ({
        id: winner._id,
        userId: winner.userId?._id || 'unknown',
        userName: winner.userId?.fullName || 'Bilinmeyen Kullanıcı',
        amount: winner.amount,
        date: winner.date
      }))
    );
    
    // Hiç kazanan yoksa boş array döndür
    res.json(winners);
  } catch (error) {
    console.error('Winners error:', error);
    // Hata durumunda boş array döndür
    res.json([]);
  }
});

// Participate in lottery
app.post('/api/lottery/participate', async (req, res) => {
  try {
    console.log('Participate request received:', req.body);
    const { userId } = req.body;
    
    if (!userId) {
      console.log('Error: userId not provided');
      return res.status(400).json({ message: 'Kullanıcı ID gerekli' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      console.log('Error: User not found with ID:', userId);
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    let currentLottery = await Lottery.findOne({ status: 'active' });
    if (!currentLottery) {
      console.log('Creating new lottery...');
      currentLottery = new Lottery({
        prizeAmount: 10000, // Başlangıç ödül miktarı
        drawDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        ticketPrice: 100,
        maxParticipants: 10000,
        participants: [],
        totalAmount: 0,
        status: 'active'
      });
      await currentLottery.save();
      console.log('New lottery created:', currentLottery._id);
    }
    
    if (currentLottery.participants.includes(userId)) {
      console.log('Error: User already participated');
      return res.status(400).json({ message: 'Bu çekilişe zaten katıldınız' });
    }
    
    const ticketNumber = Math.random().toString(36).substr(2, 8).toUpperCase();
    
    currentLottery.participants.push(userId);
    currentLottery.totalAmount += 100; // 100 TL participation fee
    await currentLottery.save();
    
    user.participations.push({
      lotteryId: currentLottery._id,
      ticketNumber,
      date: new Date()
    });
    await user.save();
    
    console.log('User participated successfully:', userId, 'Ticket:', ticketNumber);
    res.json({
      message: 'Başarıyla katıldınız',
      lotteryNumber: ticketNumber
    });
  } catch (error) {
    console.error('Participate error:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
