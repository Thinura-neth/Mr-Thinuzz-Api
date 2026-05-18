const cheerio = require('cheerio');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Inspect එකෙන් ගත්ත අලුත්ම x-user එක අනිවාර්යයෙන්ම මෙතනට දාන්න
const X_USER = '{"appType":3}'; 

const commonHeaders = {
    'authority': 'h5-api.aoneroom.com',
    'accept': 'application/json, text/plain, */*',
    'origin': 'https://videodownloader.site',
    'referer': 'https://videodownloader.site/',
    'x-client-info': '{"version":"1.0.0","platform":"web"}',
    'x-user': X_USER,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

// --- 1. SEARCH ENDPOINT ---
app.get('/search', async (req, res) => {
    const query = req.query.q;
    const host = req.get('host');
    const protocol = req.protocol;

    if (!query) return res.status(400).json({ status: false, message: "සර්ච් කරන්න නමක් දෙන්න" });

    try {
        const response = await axios.post('https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search', {
            keyword: query, page: 1, pageSize: 24
        }, { headers: commonHeaders });

        const results = (response.data?.data?.items || []).map(item => ({
            title: item.title,
            img: item.url,
            url: `${item.detailPath}`,
            year: item.releasedDate
        }));

        res.json({ status: true, creator: "@mcerror", results });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

// --- 2. INFO & DOWNLOAD ENDPOINT ---
app.get('/info', async (req, res) => {
    const detailPath = req.query.path;
    if (!detailPath) return res.status(400).json({ status: false, message: "Path is required" });

    try {
        // Step 1: Get Movie Details
        const detailUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/detail?detailPath=${detailPath}`;
        const detailRes = await axios.get(detailUrl, { headers: commonHeaders });
        
        const movieData = detailRes.data?.data?.subject; // JSON structure එක අනුව මේක වෙනස් කළා

        if (!movieData || !movieData.subjectId) {
            return res.json({ status: false, message: "Movie ID not found", debug: detailRes.data });
        }

        // Step 2: Get Download Links
        const dlUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/download`;
        const dlRes = await axios.get(dlUrl, {
            params: {
                subjectId: movieData.subjectId,
                se: 0,
                ep: 0,
                detailPath: detailPath
            },
            headers: {
                ...commonHeaders,
                'referer': `https://videodownloader.site/detail/${detailPath}`
            }
        });

        const links = dlRes.data?.data?.list || [];

        res.json({
            status: true,
            creator: "@mcerror",
            result: {
                title: movieData.title,
                poster: movieData.cover?.url,
                description: movieData.description,
                rating: movieData.imdbRatingValue,
                genres: movieData.genre,
                dl_links: links.map(l => ({
                    quality: l.name,
                    size: l.size,
                    link: l.url
                }))
            }
        });

    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});
app.get('/ytdl', async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ status: false, message: "URL එකක් දාපන් මචං" });
    }

    try {
        
        const apiUrl = `https://mcsave.up.railway.app/api/download-all?url=${encodeURIComponent(videoUrl)}`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': '*/*',
                'referer': 'https://mcsave.up.railway.app/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
            }
        });

        const data = response.data;

        res.json({
            status: true,
            creator: "@mcerror",
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            medias: (data.medias || []).map(m => ({
                quality: m.quality,
                size: m.formattedSize,
                ext: m.extension,
                type: m.type,
                link: m.url
            }))
        });

    } catch (e) {
        res.status(500).json({ status: false, message: "Error: " + e.message });
    }
});


