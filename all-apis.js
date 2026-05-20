const express = require('express');
const router = express.Router();

router.get('/cards', (req, res) => {
    try {
        const dynamicApis = global.loadedRoutesInfo || {};
        const cardsArray = Object.keys(dynamicApis).map(key => ({
            id: key,
            ...dynamicApis[key]
        }));
        res.json({ status: true, total_apis: cardsArray.length, cards: cardsArray });
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

module.exports = router;
