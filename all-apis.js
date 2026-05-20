const express = require('express');
const router = express.Router();

// Dashboard Cards සඳහා Endpoint එක
router.get('/cards', async (req, res) => {
    try {
        const dynamicApis = global.loadedRoutesInfo || {};
        const cardsArray = [];

        Object.keys(dynamicApis).forEach(key => {
            cardsArray.push({
                id: key,
                ...dynamicApis[key]
            });
        });

        res.json({
            status: true,
            total_apis: cardsArray.length,
            cards: cardsArray
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            error: "Failed to generate dynamic API cards",
            message: error.message
        });
    }
});

module.exports = router;
