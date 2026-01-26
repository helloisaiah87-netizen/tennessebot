const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// This is the "Inbox" where we store messages temporarily
let messageQueue = [];

// 1. Website sends message here
app.post('/send', (req, res) => {
    const msg = req.body.message;
    if (msg) {
        messageQueue.push(msg);
        console.log("📨 New Message stored:", msg);
        res.json({ success: true, text: "Message stored in mailbox!" });
    } else {
        res.status(400).json({ error: "No message provided" });
    }
});

// 2. Bot checks here to pick up messages
app.get('/pickup', (req, res) => {
    // Send all messages to the bot and clear the queue
    res.json({ messages: messageQueue });
    messageQueue = []; // Empty the mailbox
});

// Start the Mailbox Server
app.listen(3000, () => {
    console.log("📬 Mailbox is OPEN and running!");
});