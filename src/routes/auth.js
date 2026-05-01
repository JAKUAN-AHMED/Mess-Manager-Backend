const express = require('express');
const router  = express.Router();
const { login, memberCodeLogin, registerManager, signup, getMe, forgotPassword, changePassword } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/login',            login);
router.post('/member-login',     memberCodeLogin);
router.post('/register-manager', registerManager);
router.post('/signup',           signup);
router.get('/me',                protect, getMe);
router.post('/forgot-password',  forgotPassword);
router.post('/change-password',  protect, changePassword);

module.exports = router;
