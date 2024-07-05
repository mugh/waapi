const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, MessageType, Mimetype, MessageOptions } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const app = express();
const port = 3000;

app.use(express.json());

let sessions = {};

// Load webhook URLs from a file (if it exists)
const webhookFilePath = path.join(__dirname, 'webhooks.json');
let webhooks = {};
if (fs.existsSync(webhookFilePath)) {
    webhooks = JSON.parse(fs.readFileSync(webhookFilePath, 'utf-8'));
}

// Save webhook URLs to a file
const saveWebhooks = () => {
    fs.writeFileSync(webhookFilePath, JSON.stringify(webhooks, null, 2));
};

// Function to initialize a socket connection for a given session ID
const startSock = async (sessionId) => {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // Disable printing the QR code in the terminal
    });

    // Save credentials whenever they are updated
    sock.ev.on('creds.update', saveCreds);

    // Handle QR code generation and display
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
            console.log(`Connection closed for session ${sessionId}. Reconnecting...`, shouldReconnect);
            if (shouldReconnect) {
                startSock(sessionId);
            }
        } else if (connection === 'open') {
            console.log(`Connection opened for session ${sessionId}`);
        } else if (qr) {
            console.log(`QR code for session ${sessionId}: ${qr}`);
            const qrCodeUrl = await QRCode.toDataURL(qr);
            sessions[sessionId].qrCodeUrl = qrCodeUrl;
        }
    });

    // Listen for incoming messages
    sock.ev.on('messages.upsert', async (upsert) => {
        console.log('Received new message:', upsert);
        // Extract sender phone number
        const senderNumber = upsert.messages[0]?.key.remoteJid?.split('@')[0];
        // Forward the incoming message to the webhook URL
        const webhookUrl = webhooks[sessionId];
        if (webhookUrl) {
            await axios.post(webhookUrl, { sessionId, senderNumber, message: upsert });
        } else {
            console.log(`No webhook URL configured for session ${sessionId}`);
        }
    });

    console.log(`Socket initialized for session ${sessionId}`);
    sessions[sessionId] = { sock, qrCodeUrl: null };
};

// Endpoint to start the socket for a given session ID and get QR code
app.get('/start/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        await startSock(sessionId);
        res.status(200).send(`STARTED : ${sessionId}`);
    } catch (error) {
        console.error(`Error starting socket for session ${sessionId}`, error);
        res.status(500).send(`Failed to start socket for session ${sessionId}`);
    }
});

// Endpoint to check if a socket is already started for a given session ID
app.get('/socketstat/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (session) {
        res.status(200).send(`RUNNING`);
    } else {
        res.status(404).send(`STOP`);
    }
});

// Endpoint to get the QR code for a specific session ID
app.get('/getqr/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (session && session.qrCodeUrl) {
        res.status(200).send(`<img src="${session.qrCodeUrl}" alt="QR Code for session ${sessionId}" />`);
    } else {
        res.status(404).send(`QR code already scanned`);
    }
});

// GET endpoint to check if a number exists on WhatsApp
app.get('/checkno/:sessionId/:phone', async (req, res) => {
    const { sessionId, phone } = req.params;
	
	 if (!sessionId) {
        return res.status(400).send('Missing SessionId');
    }
	const session = sessions[sessionId];
	
    if (!phone) {
        return res.status(400).send('Missing WhatsApp number');
    }

    try {
        // Check if the number exists on WhatsApp
        const [result] = await session.sock.onWhatsApp(phone);

        if (result.exists) {
            res.status(200).json({
                exists: true,
                jid: result.jid
            });
        } 
		
    } catch (error) {
        console.error('Error checking WhatsApp number:', error);
        res.status(500).json({
                exists: false,
                message: `Number ${phone} is not registered on WhatsApp`
            });
    }
});


// Endpoint to send a message using a specific session ID (POST request)
app.post('/message', async (req, res) => {
    const { sessionId, id, text } = req.body; // Extract parameters from req.body

    console.log('Received request:', req.body); // Log the request body

    if (!sessionId || !id || !text) {
        return res.status(400).send('Missing sessionId, id, or text');
    }

    const session = sessions[sessionId];
    if (!session) {
        return res.status(404).send(`Session ${sessionId} not found`);
    }

    try {
        // Check if the number exists on WhatsApp
        const [result] = await session.sock.onWhatsApp(id);
        if (!result.exists) {
            return res.status(404).send(`Number ${id} is not registered on WhatsApp`);
        }

        // Send the message
        const sentMsg = await session.sock.sendMessage(id, { text });
        res.status(200).send(`Message sent successfully: ${JSON.stringify(sentMsg)}`);
    } catch (error) {
        console.error(`Error sending message for session ${sessionId}`, error);
        res.status(500).send('Failed to send message');
    }
});

// Endpoint to send an image message
app.post('/sendimageurl', async (req, res) => {
    const { sessionId, id, text, attachment } = req.body;

    console.log('Received request:', req.body);

    if (!sessionId || !id || !attachment) {
        return res.status(400).send('Missing sessionId, id, or attachment');
    }

    const session = sessions[sessionId];
    if (!session) {
        return res.status(404).send(`Session ${sessionId} not found`);
    }

    try {
        // Check if the number exists on WhatsApp
        const [result] = await session.sock.onWhatsApp(id);
        if (!result.exists) {
            return res.status(404).send(`Number ${id} is not registered on WhatsApp`);
        }

        // Fetch the image data
        const response = await axios.get(attachment, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        let message = {
            image: buffer,
            caption: text
        };

        // Send the message with the attachment
        const sentMsg = await session.sock.sendMessage(id, message);
        res.status(200).send(`Sent successfully: ${JSON.stringify(sentMsg)}`);
    } catch (error) {
        console.error(`Error sending message with attachment for session ${sessionId}`, error);
        res.status(500).send('Failed to send image');
    }
});


// Endpoint to send a PDF or document file
app.post('/sendfileurl', async (req, res) => {
    const { sessionId, id, text, attachment } = req.body;

    console.log('Received request:', req.body);

    if (!sessionId || !id || !attachment) {
        return res.status(400).send('Missing sessionId, id, or attachment');
    }

    const session = sessions[sessionId];
    if (!session) {
        return res.status(404).send(`Session ${sessionId} not found`);
    }

    try {
        // Check if the number exists on WhatsApp
        const [result] = await session.sock.onWhatsApp(id);
        if (!result.exists) {
            return res.status(404).send(`Number ${id} is not registered on WhatsApp`);
        }

        // Fetch the file data
        const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        // Determine the file extension from the attachment's fileName
        const fileExtension = attachment.fileName.split('.').pop();

        // Determine the mimetype dynamically based on the file extension
        const mimeType = `application/${fileExtension}`;

        let message = {
            document: buffer,
            caption: text,
            mimetype: mimeType,
            fileName: attachment.fileName
        };

        // Send the message with the attachment
        const sentMsg = await session.sock.sendMessage(id, message);
        res.status(200).send(`Sent successfully: ${JSON.stringify(sentMsg)}`);
    } catch (error) {
        console.error(`Error sending message with attachment for session ${sessionId}`, error);
        res.status(500).send('Failed to send attachment');
    }
});


// Endpoint to set the webhook URL for a specific session ID
app.post('/set-webhook/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
        return res.status(400).send('Missing webhookUrl');
    }

    webhooks[sessionId] = webhookUrl;
    saveWebhooks();

    res.status(200).send(`Webhook URL set for session ${sessionId}`);
});

// Endpoint to get the webhook URL for a specific session ID
app.get('/get-webhook/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const webhookUrl = webhooks[sessionId];

    if (!webhookUrl) {
        return res.status(404).send(`Webhook URL not found for session ${sessionId}`);
    }

    res.status(200).send({ sessionId, webhookUrl });
});

// Webhook endpoint to listen for new incoming messages (for testing purposes)
app.post('/webhook/new-message', (req, res) => {
    const { sessionId, message } = req.body;
    console.log(`Webhook received new message for session ${sessionId}:`, message);
    // Implement your webhook handling logic here to process incoming messages

    res.status(200).send('Webhook received new message');
});

// Start the Express server
app.listen(port, () => {
    console.log(`WhatsApp API server listening at http://localhost:${port}`);
});
