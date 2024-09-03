require('dotenv').config(); // Load environment variables from .env file
const fs = require('fs'); 
const path = require('path'); 
const Boom = require('@hapi/boom');
const express = require('express');
const mongoose = require('mongoose');
const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const axios = require('axios');
const crypto = require('crypto');
const {
    body,
    param,
    validationResult
} = require('express-validator');
const rateLimit = require('express-rate-limit');
const qrcodeTerminal = require('qrcode-terminal'); // Import the qrcode-terminal package
const app = express();
const port = 3000;

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// MongoDB schemas
const apiKeySchema = new mongoose.Schema({
    sessionId: String,
    apiKey: String
});

const webhookSchema = new mongoose.Schema({
    sessionId: String,
    webhookUrl: String
});

const systemApiKeySchema = new mongoose.Schema({
    key: String
});

const sessionSchema = new mongoose.Schema({
    sessionId: String,
    qrCodeUrl: String,
    isConnected: Boolean
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);
const Webhook = mongoose.model('Webhook', webhookSchema);
const SystemApiKey = mongoose.model('SystemApiKey', systemApiKeySchema);
const Session = mongoose.model('Session', sessionSchema);

let sessions = {};
let SYSTEM_API_KEY;
let apiKeys = {};
let webhooks = {};

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = Buffer.from(process.env.SECRET_KEY, 'hex'); // Convert hex string to buffer
const IV_LENGTH = 16; // For AES, this is always 16

// Encrypt the data
const encrypt = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH); // Generate random IV
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex'); // Return IV and encrypted data
};

// Decrypt the data
const decrypt = (text) => {
    const parts = text.split(':'); // Split the IV and encrypted data
    const iv = Buffer.from(parts.shift(), 'hex'); // Get the IV
    const encryptedText = Buffer.from(parts.join(':'), 'hex'); // Get the encrypted data
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

// Load API keys and webhooks from MongoDB
const loadConfig = async () => {
    try {
        const apiKeysData = await ApiKey.find({});
        apiKeysData.forEach(apiKey => {
            apiKeys[apiKey.sessionId] = apiKey.apiKey;
        });
        console.log('API keys loaded from MongoDB.');

        const webhooksData = await Webhook.find({});
        webhooksData.forEach(webhook => {
            webhooks[webhook.sessionId] = webhook.webhookUrl;
        });
        console.log('Webhooks loaded from MongoDB.');

    } catch (error) {
        console.error('Could not load API keys and webhooks:', error);
    }

    // Load or generate the system API key
    const systemApiKeyData = await SystemApiKey.findOne({});
    if (systemApiKeyData) {
        SYSTEM_API_KEY = decrypt(systemApiKeyData.key);
		console.log(`System API Key: ${SYSTEM_API_KEY}`);		// Decrypt the stored key
    } else {
        SYSTEM_API_KEY = crypto.randomBytes(32).toString('hex');
        const encryptedKey = encrypt(SYSTEM_API_KEY);
        await new SystemApiKey({ key: encryptedKey }).save();
        console.log(`Generated and saved new System API Key: ${SYSTEM_API_KEY}`);
    }
};

// Save API keys to MongoDB
const saveApiKeys = async () => {
    for (const sessionId in apiKeys) {
        await ApiKey.findOneAndUpdate({ sessionId }, { apiKey: apiKeys[sessionId] }, { upsert: true });
    }
};

// Save webhooks to MongoDB
const saveWebhooks = async () => {
    for (const sessionId in webhooks) {
        await Webhook.findOneAndUpdate({ sessionId }, { webhookUrl: webhooks[sessionId] }, { upsert: true });
    }
};

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later."
});

app.use(limiter);

// Middleware to check API key
const checkApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const { sessionId } = req.params;

    const storedApiKey = await ApiKey.findOne({ sessionId });
    if (!apiKey || !sessionId || (storedApiKey && storedApiKey.apiKey !== apiKey)) {
        return res.status(403).send('Forbidden: Invalid API key or sessionId');
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

// Function to delete the session folder if it exists
const deleteSessionFolder = (sessionId) => {
    const sessionFolderPath = path.join(__dirname, 'sessions', sessionId); // Construct the path to the session folder
    if (fs.existsSync(sessionFolderPath)) { // Check if the folder exists
        fs.rmSync(sessionFolderPath, { recursive: true, force: true }); // Delete the folder and its contents
        console.log(`Deleted session folder: ${sessionFolderPath}`);
    }
};

// Function to initialize a socket connection for a given session ID
const startSock = async (sessionId) => {

    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Set this to false if using qrcode-terminal
        browser: ['waapi-mugh', 'Chrome', '100']
    });

    sessions[sessionId] = {
        sock,
        qrCodeUrl: null,
        isConnected: false
    };

    sock.ev.on('creds.update', saveCreds);

    // Connection update event handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to', lastDisconnect.error, ', reconnecting:', shouldReconnect);

            // Check for unauthorized error
            if (lastDisconnect.error?.output?.statusCode === 401) {
                console.log(`Session ${sessionId} is logged out. Clearing session state and prompting for new QR code...`);
                
                // Clear the session state
                await Session.deleteOne({ sessionId }); // Remove from database
                delete sessions[sessionId]; // Clean up in-memory session
				deleteSessionFolder(sessionId); // Delete the session folder 
				
                // Start a new session
                //await startSock(sessionId); // Reinitialize the socket
                return; // Exit the current function
            }

            // Handle QR refs attempts ended error
            if (lastDisconnect.error?.message === 'QR refs attempts ended') {
                console.log(`QR not scan attempts ended for session ${sessionId}. Deleting session...`);
                await Session.deleteOne({ sessionId }); // Remove from database
                delete sessions[sessionId]; // Clean up in-memory session
				deleteSessionFolder(sessionId); // Delete the session folder 
                return; // Exit the current function
            }

            if (shouldReconnect) {
                await startSock(sessionId); // Reconnect if not logged out
            } else {
                console.log(`Session ${sessionId} is logged out. Cannot reconnect.`);
                delete sessions[sessionId]; // Clean up session
                await Session.deleteOne({ sessionId }); // Remove from database
				deleteSessionFolder(sessionId); // Delete the session folder 
            }
        } else if (connection === 'open') {
            console.log(`Connection opened for session ${sessionId}`);
            sessions[sessionId].isConnected = true;
            await Session.findOneAndUpdate({ sessionId }, { isConnected: true }, { new: true });
        } else if (qr) {
            // Check if the timeout has already been reached
            if (!sessions[sessionId].qrTimeoutReached) {
                console.log(`QR code for session ${sessionId}: ${qr}`);
                const qrCodeUrl = await QRCode.toDataURL(qr);
                sessions[sessionId].qrCodeUrl = qrCodeUrl;
                await Session.findOneAndUpdate({ sessionId }, { qrCodeUrl }, { new: true });

                // Print the QR code to the terminal with smaller size
                qrcodeTerminal.generate(qr, { small: true }); // Generate and print the QR code with small size

            } else {
                console.log(`QR code generation skipped for session ${sessionId} as timeout has already been reached.`);
            }
        }
    });

    // Message upsert event handling
    sock.ev.on('messages.upsert', async (upsert) => {
        const senderNumber = upsert.messages[0]?.key.remoteJid?.split('@')[0];
        const webhook = await Webhook.findOne({ sessionId });
        if (webhook) {
            try {
                // Validate the webhook URL
                new URL(webhook.webhookUrl); // This will throw if the URL is invalid

                await axios.post(webhook.webhookUrl, {
                    sessionId,
                    senderNumber,
                    message: upsert
                });
            } catch (error) {
                if (error instanceof TypeError) {
                    console.error(`Invalid webhook URL for session ${sessionId}: ${webhook.webhookUrl}`);
                } else {
                    console.error(`Error sending data to webhook: ${error.message}`);
                }
            }
        } else {
            console.log(`No webhook URL configured for session ${sessionId}`);
        }
    });

    // Save initial session data to MongoDB when starting a new session
    await Session.findOneAndUpdate({ sessionId }, { sessionId, qrCodeUrl: null, isConnected: true }, { upsert: true });
    console.log(`Socket initialized for session ${sessionId}`);
};


// Function to restore sessions on startup
const restoreSessions = async () => {
    try {
        // Fetch all sessions from MongoDB
        const storedSessions = await Session.find({});
        if (storedSessions.length === 0) {
            console.log("No sessions found in the database.");
            return;
        }

        for (const storedSession of storedSessions) {
            const { sessionId } = storedSession;
            console.log(`Attempting to restore session: ${sessionId}`);
            await startSock(sessionId);
        }
    } catch (error) {
        console.error('Error restoring sessions:', error);
    }
};

// Load the system API key and restore sessions when the server starts
loadConfig().then(() => {
    restoreSessions();
});

// RESTful API Endpoints

// Start the socket for a given session ID and get QR code
app.post('/sessions/:sessionId/start', checkApiKey, async (req, res) => {
    const { sessionId } = req.params;
    try {
        await startSock(sessionId);
        res.status(200).json({
            message: `Session ${sessionId} started.`
        });
    } catch (error) {
        console.error(`Error starting socket for session ${sessionId}`, error);
        res.status(500).json({
            error: `Failed to start socket for session ${sessionId}`
        });
    }
});

// Endpoint to delete a session by session ID
app.delete('/sessions/:sessionId', checkApiKey, async (req, res) => {
    const { sessionId } = req.params;

    // Check if the session exists
    if (!sessions[sessionId]) {
        return res.status(404).json({
            error: `Session ${sessionId} not found`
        });
    }

    // Close the socket if it exists
    const sock = sessions[sessionId].sock;
    if (sock) {
        sock.end(); // Close the socket connection
    }

    // Remove the session from the sessions object
    delete sessions[sessionId];

    // Remove the session from the database
    await Session.deleteOne({ sessionId });
	
	//delete session folder
	deleteSessionFolder(sessionId);
	
    res.status(200).json({
        message: `Session ${sessionId} deleted successfully`
    });
});

// Check if a socket is already started for a given session ID
app.get('/sessions/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;

    // Fetch the session status from MongoDB
    const sessionData = await Session.findOne({ sessionId });

    if (sessionData) {
        // Return RUNNING if connected, otherwise return STOPPED
        return res.status(200).json({
            status: sessionData.isConnected ? 'RUNNING' : 'STOPPED'
        });
    }

    // If the session does not exist, return 404
    res.status(404).json({
        status: 'STOPPED'
    });
});

// Get the QR code for a specific session ID
app.get('/sessions/:sessionId/qrcode', checkApiKey, async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];

    if (session && session.qrCodeUrl) {
        return res.status(200).json({
            message: 'QR code retrieved successfully',
            qrCodeUrl: session.qrCodeUrl,
            imageHtml: `<img src="${session.qrCodeUrl}" alt="QR Code for session ${sessionId}" />`
        });
    } else {
        return res.status(404).json({
            error: 'QR code not available or socket not RUNNING'
        });
    }
});

// Generate a new API key for a specific session ID
app.post('/key/:sessionId', checkSystemApiKey, async (req, res) => {
    const { sessionId } = req.params;
    const apiKey = crypto.randomBytes(32).toString('hex');
    apiKeys[sessionId] = apiKey;  // Update the in-memory object
    await saveApiKeys();          // Save to MongoDB
    
    res.status(200).json({
        sessionId,
        apiKey
    });
});

// Get the API key for a specific session ID
app.get('/key/:sessionId', checkSystemApiKey, async (req, res) => {
    const { sessionId } = req.params;
    const apiKeyData = await ApiKey.findOne({ sessionId });

    if (!apiKeyData) {
        return res.status(404).json({
            error: `API key not found for session ${sessionId}`
        });
    }
    
    res.status(200).json({
        apiKey: apiKeyData.apiKey
    });
});

// Delete the API key for a specific session ID
app.delete('/key/:sessionId', checkSystemApiKey, async (req, res) => {
    const { sessionId } = req.params;

    const apiKeyData = await ApiKey.findOne({ sessionId });
    if (!apiKeyData) {
        return res.status(404).json({
            error: `API key not found for session ${sessionId}`
        });
    }

    await ApiKey.deleteOne({ sessionId });
    delete apiKeys[sessionId]; // Remove from in-memory object
    res.status(200).json({
        message: `API key deleted for session ${sessionId}`
    });
});

// Set the webhook URL for a specific session ID
app.post('/webhook/:sessionId', checkApiKey,
    body('webhookUrl').isURL().withMessage('Invalid webhook URL'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { sessionId } = req.params;
        const { webhookUrl } = req.body;

        webhooks[sessionId] = webhookUrl;  // Update the in-memory object
        await saveWebhooks();               // Save to MongoDB

        res.status(200).json({
            message: `Webhook URL set for session ${sessionId}`
        });
    }
);

// Get the webhook URL for a specific session ID
app.get('/webhook/:sessionId', checkApiKey, async (req, res) => {
    const { sessionId } = req.params;
    const webhookData = await Webhook.findOne({ sessionId });

    if (!webhookData) {
        return res.status(404).json({
            error: `Webhook URL not found for session ${sessionId}`
        });
    }

    res.status(200).json({
        sessionId,
        webhookUrl: webhookData.webhookUrl
    });
});

// Webhook endpoint to listen for new incoming messages
app.post('/webhook/new-message', checkApiKey, (req, res) => {
    const { sessionId, message } = req.body;
    console.log(`Webhook received new message for session ${sessionId}:`, message);
    res.status(200).send('Webhook received new message');
});

// Check if a number exists on WhatsApp
// Check if a phone number is registered on WhatsApp
app.get('/sessions/:sessionId/check/:phone',
    checkApiKey,
    param('sessionId').isString().withMessage('Invalid sessionId'),
    param('phone').isString().isLength({ min: 10 }).withMessage('Invalid phone number'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { sessionId, phone } = req.params;
        const session = sessions[sessionId];

        if (!session) {
            return res.status(404).json({
                error: `Session ${sessionId} not found`
            });
        }

        try {
            const result = await session.sock.onWhatsApp(phone);

            // Validate result
            if (!result || !Array.isArray(result) || result.length === 0) {
                return res.status(404).json({
                    exists: false,
                    message: `Number ${phone} is not registered on WhatsApp`
                });
            }

            res.status(200).json({
                exists: result[0].exists,
                jid: result[0].jid
            });
        } catch (error) {
            console.error('Error checking WhatsApp number:', error);
            res.status(500).json({
                exists: false,
                message: 'Failed to check WhatsApp number'
            });
        }
    }
);

// Send a message 
// Send a text message
app.post('/send/:sessionId/messages',
    checkApiKey,
    body('number').isString().withMessage('Missing number'), // Change id to number
    body('text').isString().withMessage('Missing text'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { sessionId } = req.params;
        const { number, text } = req.body; // Extract number instead of id

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({
                error: `Session ${sessionId} not found`
            });
        }

        try {
            const id = `${number}@s.whatsapp.net`; // Format the ID with the WhatsApp domain
            const result = await session.sock.onWhatsApp(id);

            // Check if result is defined and has the expected structure
            if (!result || !Array.isArray(result) || result.length === 0 || !result[0].exists) {
                return res.status(404).json({
                    error: `Number ${number} is not registered on WhatsApp`
                });
            }

            const sentMsg = await session.sock.sendMessage(id, {
                text
            });
            res.status(200).json({
                message: `Message sent successfully`,
                details: sentMsg
            });
        } catch (error) {
            console.error(`Error sending message for session ${sessionId}`, error);
            res.status(500).json({
                error: 'Failed to send message'
            });
        }
    }
);

app.post('/send/:sessionId/messages/image',
    checkApiKey,
    body('number').isString().withMessage('Missing number'),
    body('attachment.url').custom(value => {
        const isLocalhost = value.startsWith('http://localhost') || value.startsWith('https://localhost');
        const isValidURL = /^(http|https):\/\/[^ "]+$/.test(value);
        if (!isLocalhost && !isValidURL) {
            throw new Error('Invalid attachment URL');
        }
        return true;
    }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { sessionId } = req.params;
        const { number, text, attachment } = req.body;

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({
                error: `Session ${sessionId} not found`
            });
        }

        try {
            const id = `${number}@s.whatsapp.net`;
            const result = await session.sock.onWhatsApp(id);

            if (!result || !Array.isArray(result) || result.length === 0 || !result[0].exists) {
                return res.status(404).json({
                    error: `Number ${number} is not registered on WhatsApp`
                });
            }

            // Corrected line: Accessing the URL from the attachment object
            const response = await axios.get(attachment.url, {
                responseType: 'arraybuffer'
            });
            const buffer = Buffer.from(response.data, 'binary');
            const sentMsg = await session.sock.sendMessage(id, {
                image: buffer,
                caption: text
            });
            res.status(200).json({
                message: `Sent successfully`,
                details: sentMsg
            });
        } catch (error) {
            console.error(`Error sending image for session ${sessionId}`, error);
            res.status(500).json({
                error: 'Failed to send image'
            });
        }
    }
);

// Send a PDF or document file
// Send a file message
app.post('/send/:sessionId/messages/file',
    checkApiKey,
    body('number').isString().withMessage('Missing number'), // Change id to number
    body('attachment').isObject().withMessage('Invalid attachment object'),
    body('attachment.url').custom(value => {
        const isLocalhost = value.startsWith('http://localhost') || value.startsWith('https://localhost');
        const isValidURL = /^(http|https):\/\/[^ "]+$/.test(value);
        if (!isLocalhost && !isValidURL) {
            throw new Error('Invalid attachment URL');
        }
        return true;
    }),
    body('attachment.fileName').isString().withMessage('Missing file name'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const { sessionId } = req.params;
        const { number, text, attachment } = req.body; // Extract number instead of id

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({
                error: `Session ${sessionId} not found`
            });
        }

        try {
            const id = `${number}@s.whatsapp.net`; // Format the ID with the WhatsApp domain
            const result = await session.sock.onWhatsApp(id);

            // Check if result is defined and has the expected structure
            if (!result || !Array.isArray(result) || result.length === 0 || !result[0].exists) {
                return res.status(404).json({
                    error: `Number ${number} is not registered on WhatsApp`
                });
            }

            const response = await axios.get(attachment.url, {
                responseType: 'arraybuffer'
            });
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
            res.status(200).json({
                message: `Sent successfully`,
                details: sentMsg
            });
        } catch (error) {
            console.error(`Error sending file for session ${sessionId}`, error);
            res.status(500).json({
                error: 'Failed to send attachment'
            });
        }
    }
);


// Start the Express server
app.listen(port, () => {
    console.log(`WhatsApp API server listening at http://localhost:${port}`);
});
