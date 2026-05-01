const express = require('express');
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  restoreUser,
  regenerateMemberCode,
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middlewares/auth');

router.use(protect);
router.get('/', getUsers);
router.post('/', adminOnly, createUser);
router.put('/:id', adminOnly, updateUser);
router.delete('/:id', adminOnly, deleteUser);
router.post('/:id/restore', adminOnly, restoreUser);
router.post('/:id/regenerate-code', adminOnly, regenerateMemberCode);

module.exports = router;
