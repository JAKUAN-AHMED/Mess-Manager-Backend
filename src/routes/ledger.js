const express = require('express');
const router  = express.Router();
const {
  getContacts, createContact, updateContact, deleteContact,
  getTransactions, addTransaction, updateTransaction, deleteTransaction,
} = require('../controllers/ledgerController');
const {
  shareContact, unshareContact, getSharedUsers, getSharedWithMe, searchUsers,
} = require('../controllers/ledgerShareController');
const { protect } = require('../middlewares/auth');

router.use(protect);

// Contacts
router.get('/contacts',                   getContacts);
router.post('/contacts',                  createContact);
router.put('/contacts/:id',               updateContact);
router.delete('/contacts/:id',            deleteContact);

// Transactions
router.get('/contacts/:id/transactions',  getTransactions);
router.post('/transactions',              addTransaction);
router.put('/transactions/:id',           updateTransaction);
router.delete('/transactions/:id',        deleteTransaction);

// Sharing
router.post('/share',                     shareContact);
router.delete('/share/:contactId/:userId', unshareContact);
router.get('/share/:contactId/users',     getSharedUsers);
router.get('/shared-with-me',             getSharedWithMe);
router.post('/search-users',              searchUsers);

module.exports = router;
