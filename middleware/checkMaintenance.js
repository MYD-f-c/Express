const { Settings, User } = require('../models');
const jwt = require('jsonwebtoken');

const checkMaintenance = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    
    // Skip maintenance check for admin routes
    if (req.path.startsWith('/api/admin')) {
      return next();
    }
    
    // Skip maintenance check for auth routes (so admins can still login)
    if (req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/register')) {
      return next();
    }
    
    // Check if maintenance mode is enabled
    if (settings.maintenanceMode) {
      // Check if user is admin
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.userId);
          
          // If user is admin, allow access
          if (user && user.isAdmin) {
            return next();
          }
        } catch (error) {
          // Token is invalid, continue with maintenance mode
        }
      }
      
      return res.status(503).json({
        message: 'Platform bakımdadır',
        maintenanceMode: true,
        maintenanceMessage: settings.maintenanceMessage || 'Platform şu anda bakımdadır. Lütfen daha sonra tekrar deneyin.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    // Continue if there's an error checking maintenance mode
    next();
  }
};

module.exports = checkMaintenance;
