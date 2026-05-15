// routes/download.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const AUTHOR = "Mr Thinuzz";

// Function to get file info from direct URL
async function getDownloadInfo(directUrl) {
    try {
        // Extract filename from URL
        let filename = decodeURIComponent(directUrl.split('/').pop().split('?')[0]);
        
        // Get file size using HEAD request
        let fileSize = "Unknown";
        let sizeInBytes = 0;
        
        try {
            const headResponse = await axios.head(directUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://cinesubz.lk/'
                }
            });
            
            if (headResponse.headers['content-length']) {
                sizeInBytes = parseInt(headResponse.headers['content-length']);
                if (sizeInBytes > 1073741824) {
                    fileSize = (sizeInBytes / 1073741824).toFixed(2) + ' GB';
                } else if (sizeInBytes > 1048576) {
                    fileSize = (sizeInBytes / 1048576).toFixed(2) + ' MB';
                } else {
                    fileSize = (sizeInBytes / 1024).toFixed(2) + ' KB';
                }
            }
        } catch (e) {
            console.log("HEAD request failed, continuing without size");
        }
        
        // Generate Telegram bot start code
        const startCode = Buffer.from(`get_${Date.now()}_${Math.random().toString(36).substring(7)}`).toString('base64');
        
        return {
            title: filename,
            size: fileSize,
            size_bytes: sizeInBytes,
            downloadUrls: [
                {
                    url: `https://t.me/cstg03bot?start=${startCode}`,
                    type: "telegram"
                },
                {
                    url: directUrl,
                    type: "direct"
                }
            ]
        };
        
    } catch (error) {
        console.error(`Download info failed: ${error.message}`);
        return {
            title: "Unknown",
            size: "Unknown",
            size_bytes: 0,
            downloadUrls: [],
            error: error.message
        };
    }
}

// Download endpoint
router.get('/', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            author: AUTHOR,
            status: false,
            error: "URL is required",
            example: "/download?url=https://bot3.sonic-cloud.online/server5/file.mp4"
        });
    }
    
    try {
        const decodedUrl = decodeURIComponent(url);
        console.log(`📥 Processing download request for: ${decodedUrl}`);
        
        const downloadInfo = await getDownloadInfo(decodedUrl);
        
        res.status(200).json({
            author: AUTHOR,
            status: true,
            timestamp: new Date().toISOString(),
            data: downloadInfo
        });
        
    } catch (err) {
        console.error(`Download error: ${err.message}`);
        res.status(500).json({
            author: AUTHOR,
            status: false,
            error: err.message
        });
    }
});

module.exports = router;
