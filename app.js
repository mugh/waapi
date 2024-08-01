const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, MessageType, Mimetype, MessageOptions } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const mime = require('mime-types');
const fs = require('fs/promises');

const app = express();
const port = 3000;
const agentname = "waapi-mugh";

app.use(express.json());

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later."
});

app.use(limiter);

let sessions = {};
const apiKeysFilePath = path.join(__dirname, 'api_keys.json');
const webhookFilePath = path.join(__dirname, 'webhooks.json');
const systemApiKeyFilePath = path.join(__dirname, 'system_api_key.json');

let apiKeys = {};
let webhooks = {};
let SYSTEM_API_KEY;

// Load API keys and webhooks from files
const loadConfig = async () => {
    try {
        const apiKeysData = await fs.readFile(apiKeysFilePath, 'utf-8');
        apiKeys = JSON.parse(apiKeysData);
    } catch (error) {
        console.error('Could not load API keys:', error);
    }
    
    try {
        const webhooksData = await fs.readFile(webhookFilePath, 'utf-8');
        webhooks = JSON.parse(webhooksData);
    } catch (error) {
        console.error('Could not load webhooks:', error);
    }

    // Load or generate the system API key
    try {
        const systemApiKeyData = await fs.readFile(systemApiKeyFilePath, 'utf-8');
        SYSTEM_API_KEY = JSON.parse(systemApiKeyData).key;
    } catch (error) {
        // If the file doesn't exist, generate a new key and save it
        SYSTEM_API_KEY = crypto.randomBytes(32).toString('hex');
        await fs.writeFile(systemApiKeyFilePath, JSON.stringify({ key: SYSTEM_API_KEY }, null, 2));
        console.log(`Generated new System API Key: ${SYSTEM_API_KEY}`);
    }
};

// Save API keys and webhooks to files
const saveApiKeys = async () => {
    await fs.writeFile(apiKeysFilePath, JSON.stringify(apiKeys, null, 2));
};

const saveWebhooks = async () => {
    await fs.writeFile(webhookFilePath, JSON.stringify(webhooks, null, 2));
};

// Middleware to check API key
const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const { sessionId } = req.params;

    if (!apiKey || !sessionId || apiKeys[sessionId] !== apiKey) {
        return res.status(403).send('Forbidden: Invalid API key or sessionId');
    }
    next();
};

// Middleware to restrict access to localhost
const restrictToLocalhost = (req, res, next) => {
    const allowedIps = ['::1', '127.0.0.1', '::ffff:127.0.0.1']; // IPv6 and IPv4 localhost addresses
    if (!allowedIps.includes(req.ip)) {
        return res.status(403).send('Forbidden: Access allowed only from localhost');
    }
    next();
};

// Middleware to check system API key
const checkSystemApiKey = (req, res, next) => {
    const apiKey = req.headers['x-system-api-key'];
    if (!apiKey || apiKey !== SYSTEM_API_KEY) {
        return res.status(403).send('Forbidden: Invalid system API key');
    }
    next();
};

// Function to initialize a socket connection for a given session ID
const startSock = async (sessionId) => {
    const sessionFilePath = `./sessions/${sessionId}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionFilePath);
    const sock = makeWASocket({ auth: state, printQRInTerminal: false, name:agentname });
	
	// Initialize connection state for the session
    sessions[sessionId] = { sock, qrCodeUrl: null, isConnected: false };
	
    sock.ev.on('creds.update', saveCreds);

    let qrTimeout;
    let manualDisconnect = false; // Flag to indicate a manual disconnect
	
	sock.ev.on('connection.update', async (update) => {
		const { connection, qr, lastDisconnect } = update;
		
		if (connection === 'close') {
			// Check if the disconnection was manual
			if (manualDisconnect) {
				console.log(`Connection closed for session ${sessionId} due to manual disconnect.`);
				sessions[sessionId].isConnected = false; // Update connection state
				return; // Exit if it was a manual disconnect
			}

			const shouldReconnect = (lastDisconnect && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
			console.log(`Connection closed for session ${sessionId}. Reconnecting: ${shouldReconnect}`);
			if (shouldReconnect) startSock(sessionId);
		} else if (connection === 'open') {		
			console.log(`Connection opened for session ${sessionId}`);
			try {
				await fs.access(sessionFilePath); // Check if the session file exists
				console.log(`Session ${sessionId} restored from file.`);
			} catch (error) {
				console.error(`Session file for ${sessionId} does not exist or cannot be accessed.`);
			}
			clearTimeout(qrTimeout); // Clear timeout if connection is open
		} else if (qr) {
			console.log(`QR code for session ${sessionId}: ${qr}`);
			const qrCodeUrl = await QRCode.toDataURL(qr);
			sessions[sessionId].qrCodeUrl = qrCodeUrl;

			// Set a timeout to close the socket if the QR code is not scanned
			qrTimeout = setTimeout(() => {
				console.log(`QR code not scanned for session ${sessionId}. Closing connection.`);
				manualDisconnect = true; // Set the flag for manual disconnect
				sock.end(); // Use end to close the socket connection
			}, 1 * 60 * 1000); // 1 minutes timeout
		}
    });

    sock.ev.on('messages.upsert', async (upsert) => {
        const senderNumber = upsert.messages[0]?.key.remoteJid?.split('@')[0];
        const webhookUrl = webhooks[sessionId];
        if (webhookUrl) {
            await axios.post(webhookUrl, { sessionId, senderNumber, message: upsert });
        } else {
            console.log(`No webhook URL configured for session ${sessionId}`);
        }
    });
	sessions[sessionId].isConnected = true; // Update connection state	
    console.log(`Socket initialized for session ${sessionId}`);

};

// Function to restore sessions on startup
const restoreSessions = async () => {
    try {
        const sessionsDir = path.join(__dirname, 'sessions');
        console.log(`Checking for sessions directory at: ${sessionsDir}`);

        // Check if sessions directory exists
        await fs.access(sessionsDir, fs.constants.F_OK);
        const sessionFiles = await fs.readdir(sessionsDir);
        
        if (sessionFiles.length === 0) {
            console.log("No session files found.");
            return;
        }

        for (const sessionId of sessionFiles) {
            console.log(`Attempting to restore session: ${sessionId}`);
            await startSock(sessionId);
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("Sessions directory not found. No sessions to restore.");
        } else {
            console.error('Error restoring sessions:', error);
        }
    }
};

restoreSessions();

// RESTful API Endpoints

// Start the socket for a given session ID and get QR code
app.post('/sessions/:sessionId/start', checkApiKey, async (req, res) => {
    const { sessionId } = req.params;
    try {
        await startSock(sessionId);
        res.status(200).json({ message: `Session ${sessionId} started.` });
    } catch (error) {
        console.error(`Error starting socket for session ${sessionId}`, error);
        res.status(500).json({ error: `Failed to start socket for session ${sessionId}` });
    }
});

// Check if a socket is already started for a given session ID
app.get('/sessions/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];

    // Check if the session exists
    if (session) {
        // Return RUNNING if connected, otherwise return STOPPED
        return res.status(200).json({ status: session.isConnected ? 'RUNNING' : 'STOPPED' });
    }
    
    // If the session does not exist, return 404
    res.status(404).json({ status: 'STOPPED' });
});

// Get the QR code for a specific session ID
app.get('/sessions/:sessionId/qrcode', checkApiKey, (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];

    if (session && session.qrCodeUrl) {
        // Return both the image URL and a status message
        return res.status(200).json({
            message: 'QR code retrieved successfully',
            qrCodeUrl: session.qrCodeUrl,
            imageHtml: `<img src="${session.qrCodeUrl}" alt="QR Code for session ${sessionId}" />`
        });
    } else {
        return res.status(404).json({ error: 'QR code not available or socket not RUNNING' });
    }
});

// Check if a number exists on WhatsApp
app.get('/sessions/:sessionId/check/:phone', 
    checkApiKey,
    param('sessionId').isString().withMessage('Invalid sessionId'),
    param('phone').isString().isLength({ min: 10 }).withMessage('Invalid phone number'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { sessionId, phone } = req.params;
        const session = sessions[sessionId];

        try {
            const [result] = await session.sock.onWhatsApp(phone);
            res.status(200).json({ exists: result.exists, jid: result.jid });
        } catch (error) {
            console.error('Error checking WhatsApp number:', error);
            res.status(500).json({ exists: false, message: `Number ${phone} is not registered on WhatsApp` });
        }
    }
);

// Send a message 
app.post('/send/:sessionId/messages', 
    checkApiKey,
    body('number').isString().withMessage('Missing number'), // Change id to number
    body('text').isString().withMessage('Missing text'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const { number, text } = req.body; // Extract number instead of id

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: `Session ${sessionId} not found` });
        }

        try {
            const id = `${number}@s.whatsapp.net`; // Format the ID with the WhatsApp domain
            const [result] = await session.sock.onWhatsApp(id);
            if (!result.exists) {
                return res.status(404).json({ error: `Number ${number} is not registered on WhatsApp` });
            }

            const sentMsg = await session.sock.sendMessage(id, { text });
            res.status(200).json({ message: `Message sent successfully`, details: sentMsg });
        } catch (error) {
            console.error(`Error sending message for session ${sessionId}`, error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }
);

// Send an image message
app.post('/send/:sessionId/messages/image', 
    checkApiKey,
    body('number').isString().withMessage('Missing number'), // Change id to number
    body('attachment').isURL().withMessage('Invalid attachment URL'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const { number, text, attachment } = req.body; // Extract number instead of id

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: `Session ${sessionId} not found` });
        }

        try {
            const id = `${number}@s.whatsapp.net`; // Format the ID with the WhatsApp domain
            const [result] = await session.sock.onWhatsApp(id);
            if (!result.exists) {
                return res.status(404).json({ error: `Number ${number} is not registered on WhatsApp` });
            }

            const response = await axios.get(attachment, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            const sentMsg = await session.sock.sendMessage(id, { image: buffer, caption: text });
            res.status(200).json({ message: `Sent successfully`, details: sentMsg });
        } catch (error) {
            console.error(`Error sending image for session ${sessionId}`, error);
            res.status(500).json({ error: 'Failed to send image' });
        }
    }
);

// Send a PDF or document file
app.post('/send/:sessionId/messages/file', 
    checkApiKey,
    body('number').isString().withMessage('Missing number'), // Change id to number
    body('attachment').isObject().withMessage('Invalid attachment object'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const { number, text, attachment } = req.body; // Extract number instead of id

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: `Session ${sessionId} not found` });
        }

        try {
            const id = `${number}@s.whatsapp.net`; // Format the ID with the WhatsApp domain
            const [result] = await session.sock.onWhatsApp(id);
            if (!result.exists) {
                return res.status(404).json({ error: `Number ${number} is not registered on WhatsApp` });
            }

            const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            const fileExtension = attachment.fileName.split('.').pop();
            const mimeType = `application/${fileExtension}`;

            const message = {
                document: buffer,
                caption: text,
                mimetype: mimeType,
                fileName: attachment.fileName
            };

            const sentMsg = await session.sock.sendMessage(id, message);
            res.status(200).json({ message: `Sent successfully`, details: sentMsg });
        } catch (error) {
            console.error(`Error sending file for session ${sessionId}`, error);
            res.status(500).json({ error: 'Failed to send attachment' });
        }
    }
);

// Set the webhook URL for a specific session ID
app.post('/webhook/:sessionId', checkApiKey, 
    body('webhookUrl').isURL().withMessage('Invalid webhook URL'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const { webhookUrl } = req.body;

        webhooks[sessionId] = webhookUrl;
        await saveWebhooks();

        res.status(200).json({ message: `Webhook URL set for session ${sessionId}` });
    }
);

// Get the webhook URL for a specific session ID
app.get('/webhook/:sessionId', checkApiKey, (req, res) => {
    const { sessionId } = req.params;
    const webhookUrl = webhooks[sessionId];

    if (!webhookUrl) {
        return res.status(404).json({ error: `Webhook URL not found for session ${sessionId}` });
    }

    res.status(200).json({ sessionId, webhookUrl });
});

// Webhook endpoint to listen for new incoming messages
app.post('/webhook/new-message', checkApiKey, (req, res) => {
    const { sessionId, message } = req.body;
    console.log(`Webhook received new message for session ${sessionId}:`, message);
    res.status(200).send('Webhook received new message');
});

// Generate a new API key for a specific session ID
app.post('/key/:sessionId', restrictToLocalhost, checkSystemApiKey, (req, res) => {
    const { sessionId } = req.params;
    const apiKey = crypto.randomBytes(32).toString('hex');
    apiKeys[sessionId] = apiKey;
    saveApiKeys();
    res.status(200).json({ sessionId, apiKey });
});

// Get the API key for a specific session ID
app.get('/key/:sessionId', restrictToLocalhost, checkSystemApiKey, (req, res) => {
    const { sessionId } = req.params;
    const apiKey = apiKeys[sessionId];

    if (!apiKey) {
        return res.status(404).json({ error: `API key not found for session ${sessionId}` });
    }
    res.status(200).json({ apiKey });
});

// Delete the API key for a specific session ID
app.delete('/key/:sessionId', restrictToLocalhost, checkSystemApiKey, (req, res) => {
    const { sessionId } = req.params;

    if (!apiKeys[sessionId]) {
        return res.status(404).json({ error: `API key not found for session ${sessionId}` });
    }

    delete apiKeys[sessionId];
    saveApiKeys();
    res.status(200).json({ message: `API key deleted for session ${sessionId}` });
});

// Start the Express server
app.listen(port, () => {
    console.log(`WhatsApp API server listening at http://localhost:${port}`);
    loadConfig(); // Load configurations when server starts
    console.log(`System API Key: ${SYSTEM_API_KEY}`); // Log the system API key for future use
});