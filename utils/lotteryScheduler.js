const cron = require('node-cron');
const { Lottery, User } = require('../models');

// Function to select winners for a lottery
async function selectWinners(lotteryId) {
  try {
    console.log(`[LotteryScheduler] Starting winner selection for lottery ${lotteryId}`);
    
    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      console.error(`[LotteryScheduler] Lottery ${lotteryId} not found`);
      return;
    }

    if (lottery.status !== 'active') {
      console.log(`[LotteryScheduler] Lottery ${lotteryId} is not active`);
      return;
    }

    const participantIds = lottery.participants;
    const numberOfWinners = Math.min(4, participantIds.length);
    
    if (participantIds.length === 0) {
      console.log(`[LotteryScheduler] No participants in lottery ${lotteryId}`);
      lottery.status = 'completed';
      lottery.totalAmount = 0;
      await lottery.save();
      return;
    }

    // Shuffle array and pick winners
    const shuffled = [...participantIds].sort(() => 0.5 - Math.random());
    const winnerIds = shuffled.slice(0, numberOfWinners);
    
    // Calculate prize per winner
    const totalPrize = participantIds.length * lottery.ticketPrice;
    const prizePerWinner = Math.floor(totalPrize / numberOfWinners);

    console.log(`[LotteryScheduler] Selected ${numberOfWinners} winners for lottery ${lotteryId}`);
    console.log(`[LotteryScheduler] Total prize: ${totalPrize}, Prize per winner: ${prizePerWinner}`);

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

    console.log(`[LotteryScheduler] Successfully completed lottery ${lotteryId}`);
  } catch (error) {
    console.error('[LotteryScheduler] Error selecting winners:', error);
  }
}

// Check for lotteries that need winner selection
async function checkLotteries() {
  try {
    const now = new Date();
    
    // Find active lotteries where draw date has passed
    const expiredLotteries = await Lottery.find({
      status: 'active',
      drawDate: { $lte: now }
    });

    console.log(`[LotteryScheduler] Found ${expiredLotteries.length} expired lotteries`);

    for (const lottery of expiredLotteries) {
      await selectWinners(lottery._id);
    }
  } catch (error) {
    console.error('[LotteryScheduler] Error checking lotteries:', error);
  }
}

// Initialize the scheduler
function initializeLotteryScheduler() {
  // Run every minute to check for expired lotteries
  cron.schedule('* * * * *', () => {
    console.log('[LotteryScheduler] Running lottery check...');
    checkLotteries();
  });

  console.log('[LotteryScheduler] Lottery scheduler initialized - checking every minute');
  
  // Also check immediately on startup
  checkLotteries();
}

module.exports = {
  initializeLotteryScheduler,
  selectWinners,
  checkLotteries
};
