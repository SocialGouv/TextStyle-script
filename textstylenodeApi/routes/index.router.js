const express = require('express');
const router = express.Router();


const ctrlLegi = require('../controllers/legifrance.controller');
const ctrlTest = require('../controllers/test.controller');
const ctrlIterate = require('../controllers/iterate.controller');
const ctrlIterateNo = require('../controllers/iterateNo.controller');
// LegiFrance
router.post('/search', ctrlLegi.dilaSearchLegi);
router.post('/jorf', ctrlLegi.dilaSearchJorf);
router.post('/loda', ctrlLegi.dilaSearchLoda);


module.exports = router;
