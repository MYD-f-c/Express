const adminAuth = (req, res, next) => {
  // This middleware should be used after the auth middleware
  // which sets req.user
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ 
      message: 'Bu işlem için admin yetkisi gereklidir' 
    });
  }
  
  next();
};

module.exports = adminAuth;
