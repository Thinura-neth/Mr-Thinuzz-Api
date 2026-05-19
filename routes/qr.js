// routes/qr.js - Mr Thinuzz API (QR & Barcode Generator Plugin)
const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const router = express.Router();

// ============ API CONFIGURATION FOR DASHBOARD ============
router.apiConfig = {
    name: "QR & Barcode API",
    name_si: "QR සහ බාර්කෝඩ් API",
    icon: "fa-qrcode",
    color: "#8b5cf6", // Purple theme
    base_path: "/qr",
    enabled: true,
    endpoints: [
        {
            name: "Generate QR Code",
            method: "GET",
            path: "/qrcode",
            params: ["text", "size", "dark", "light", "format"],
            required_params: ["text"],
            example: "/qr/qrcode?text=HelloThinuzz&size=400",
            description: "Generate high-quality custom QR Codes as image or base64"
        },
        {
            name: "Generate Barcode",
            method: "GET",
            path: "/barcode",
            params: ["data", "type", "format"],
            required_params: ["data"],
            example: "/qr/barcode?data=1234567890&type=code128",
            description: "Generate various types of Barcodes (CODE128, EAN13, UPC etc.)"
        }
    ]
};

// Helper: Query parameter extractor for Vercel/Dashboard nested queries
function getParam(req, primaryKey, fallbackKey = 'url') {
    // 1. Check direct query
    if (req.query[primaryKey]) return req.query[primaryKey];
    
    // 2. Check nested URL wrapping (?url=/qr/endpoint?param=...)
    if (req.query[fallbackKey]) {
        const nestedUrl = decodeURIComponent(req.query[fallbackKey]);
        if (nestedUrl.includes(`${primaryKey}=`)) {
            return nestedUrl.split(`${primaryKey}=`)[1].split('&')[0];
        }
    }
    
    // 3. Raw URL string fallback parsing
    if (req.url.includes(`${primaryKey}=`)) {
        const urlParts = req.url.split(`${primaryKey}=`);
        if (urlParts.length > 1) return urlParts[1].split('&')[0];
    }
    
    return null;
}

// ============ ROUTES ============

// Root API Info
router.get('/', (req, res) => {
    res.json({
        status: true,
        ...router.apiConfig,
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString()
    });
});

// 1. QR CODE GENERATOR ENDPOINT
router.get('/qrcode', async (req, res) => {
    try {
        // Safe parameter extraction
        const rawText = getParam(req, 'text');
        const rawSize = getParam(req, 'size');
        const rawDark = getParam(req, 'dark');
        const rawLight = getParam(req, 'light');
        const rawFormat = getParam(req, 'format');

        if (!rawText) {
            return res.status(400).json({
                status: false,
                error: "Missing 'text' parameter",
                author: "Mr Thinuzz",
                usage: "/qr/qrcode?text=YourTextHere"
            });
        }

        const text = decodeURIComponent(rawText);
        const size = rawSize ? parseInt(rawSize) : 500;
        const dark = rawDark ? decodeURIComponent(rawDark) : '#000000';
        const light = rawLight ? decodeURIComponent(rawLight) : '#FFFFFF';
        const format = rawFormat ? rawFormat.toLowerCase() : 'image'; // image OR base64

        // Generate QR Code Buffer
        const qrBuffer = await QRCode.toBuffer(text, {
            type: 'png',
            width: size,
            margin: 2,
            color: { dark, light },
            errorCorrectionLevel: 'H'
        });

        // Response handling based on format
        if (format === 'base64') {
            return res.json({
                status: true,
                author: "Mr Thinuzz",
                data: {
                    text: text,
                    size: size,
                    format: 'png',
                    base64: qrBuffer.toString('base64')
                }
            });
        }

        // Return as raw PNG Image
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(qrBuffer);

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.message,
            author: "Mr Thinuzz"
        });
    }
});

// 2. BARCODE GENERATOR ENDPOINT
router.get('/barcode', async (req, res) => {
    try {
        // Safe parameter extraction
        const rawData = getParam(req, 'data');
        let rawType = getParam(req, 'type');
        const rawFormat = getParam(req, 'format');

        if (!rawData) {
            return res.status(400).json({
                status: false,
                error: "Missing 'data' parameter",
                author: "Mr Thinuzz",
                usage: "/qr/barcode?data=1234567890",
                types_available: ['code128', 'ean13', 'ean8', 'upc', 'code39', 'code93', 'codabar']
            });
        }

        const data = decodeURIComponent(rawData);
        const format = rawFormat ? rawFormat.toLowerCase() : 'image'; // image OR base64
        
        // Auto-detect barcode type if not provided
        let type = rawType ? rawType.toLowerCase() : 'code128';
        if (!rawType) {
            if (/^\d{13}$/.test(data)) type = 'ean13';
            else if (/^\d{12}$/.test(data)) type = 'upc';
            else if (/^\d{8}$/.test(data)) type = 'ean8';
        }

        // Fetch barcode from provider
        const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(data)}&code=${type}&dpi=96&font=Consolas`;
        
        const response = await axios.get(barcodeUrl, { 
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const barcodeBuffer = Buffer.from(response.data, 'binary');

        // Response handling based on format
        if (format === 'base64') {
            return res.json({
                status: true,
                author: "Mr Thinuzz",
                data: {
                    text: data,
                    type: type,
                    format: 'png',
                    base64: barcodeBuffer.toString('base64')
                }
            });
        }

        // Return as raw PNG Image
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(barcodeBuffer);

    } catch (error) {
        // Fallback to secondary provider if TEC-IT fails
        try {
            const rawData = getParam(req, 'data');
            const data = decodeURIComponent(rawData);
            const altUrl = `https://api.qrserver.com/v1/create-barcode/?data=${encodeURIComponent(data)}&size=400x200&format=png`;
            const altResponse = await axios.get(altUrl, { responseType: 'arraybuffer', timeout: 10000 });
            
            res.setHeader('Content-Type', 'image/png');
            return res.send(Buffer.from(altResponse.data, 'binary'));
        } catch (altError) {
            return res.status(500).json({
                status: false,
                error: "Failed to generate barcode from all sources: " + error.message,
                author: "Mr Thinuzz"
            });
        }
    }
});

module.exports = router;
