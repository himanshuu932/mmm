const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const SECRET_CODE = process.env.SECRET_CODE || 'MMMUT_CDC_ADMIN_2025';
const QUESTION_ID = process.env.QUESTION_ID || 'level3_path_traversal';
const DOCUMENTS_DIR = path.join(__dirname, 'documents');
const MAIN_BACKEND_URL = 'https://buggit-backend-yy8i.onrender.com/api/store-result';

// Helper function to send result to main backend (backend-to-backend)
async function sendToMainBackend(teamcode, questionId) {
    try {
        const response = await fetch(MAIN_BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamcode, questionId })
        });

        const result = await response.json();
        console.log("[BACKEND-SYNC] Stored in Main Backend:", result);
        return { success: true, result };
    } catch (error) {
        console.error("[BACKEND-SYNC] Error contacting main backend:", error.message);
        return { success: false, error: error.message };
    }
}

// List available documents
app.get('/api/documents', (req, res) => {
    try {
        const files = fs.readdirSync(DOCUMENTS_DIR);
        const documents = files.map(file => ({
            name: file,
            displayName: file.replace(/_/g, ' ').replace('.txt', '').toUpperCase()
        }));
        res.json({ success: true, documents });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// VULNERABLE ENDPOINT - Path Traversal
app.get('/api/document', (req, res) => {
    const filename = req.query.file;

    if (!filename) {
        return res.status(400).json({ error: 'File parameter required' });
    }

    // VULNERABILITY: No proper sanitization of user input!
    const filePath = path.join(DOCUMENTS_DIR, filename);

    if (!filename.endsWith('.txt')) {
        return res.status(403).json({ error: 'Access denied. Only .txt files allowed.' });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, filename, content });
    } catch (err) {
        res.status(404).json({ error: 'Document not found or access denied.' });
    }
});

// Verify code endpoint
app.post('/api/verify', async (req, res) => {
    const { code, teamcode } = req.body;

    if (code === SECRET_CODE) {
        // Use provided teamcode or default
        const y = teamcode || '382045158047';

        // Backend-to-backend call to main server
        const syncResult = await sendToMainBackend(y, QUESTION_ID);
         console.log("Sync result:", syncResult);
         
        return res.json({
            success: true,
            message: "ACCESS GRANTED - OMEGA CLEARANCE VERIFIED",
            bugFound: "BUG_FOUND{path_traversal_document_leak}",
            redirect: "/dashboard",
            backendSync: syncResult
        });
    } else {
        res.json({
            success: false,
            message: "Invalid authorization code."
        });
    }
});

// Health check
app.get('/ping', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`MMMUT Document Portal running on port ${PORT}`);
    console.log(`Question ID: ${QUESTION_ID}`);
    console.log(`Main Backend: ${MAIN_BACKEND_URL}`);
    console.log(`Ping endpoint: /ping`);

    // Self-ping for Render
    const PING_INTERVAL = 10 * 60 * 1000;
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        fetch(`${url}/ping`)
            .then(r => r.json())
            .then(d => console.log(`[KEEP-ALIVE] Pinged at ${d.timestamp}`))
            .catch(e => console.log(`[KEEP-ALIVE] Ping failed: ${e.message}`));
    }, PING_INTERVAL);
    console.log(`[KEEP-ALIVE] Self-ping enabled every 10 minutes`);
});
