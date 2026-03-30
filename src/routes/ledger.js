const express = require('express');
const router  = express.Router();
const {
  getContacts, createContact, updateContact, deleteContact,
  getTransactions, addTransaction, updateTransaction, deleteTransaction,
} = require('../controllers/ledgerController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/contacts',                   getContacts);
router.post('/contacts',                  createContact);
router.put('/contacts/:id',               updateContact);
router.delete('/contacts/:id',            deleteContact);

router.get('/contacts/:id/transactions',  getTransactions);
router.post('/transactions',              addTransaction);
router.put('/transactions/:id',           updateTransaction);
router.delete('/transactions/:id',        deleteTransaction);

module.exports = router;
