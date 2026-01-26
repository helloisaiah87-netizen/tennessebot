const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const getUsers = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, '..', 'users.json'));
        return JSON.parse(data);
    } catch (e) {
        return []; // If file doesn't exist, return empty list
    }
};

const saveUser = (users) => {
    fs.writeFileSync(path.join(__dirname, '..', 'users.json'), JSON.stringify(users, null, 2));
};

// --- LOGIN ---
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        res.sendFile(path.join(__dirname, '..', 'views', 'staff.html'));
    } else {
        res.send(`<h2 style="color:white; background:black; padding:20px;">Login Failed. <a href="/login.html" style="color:red;">Try Again</a></h2>`);
    }
});

// --- REGISTER (Fixed: No Badge) ---
router.post('/register', (req, res) => {
    const { username, password } = req.body; // REMOVED "badge"
    const users = getUsers();

    if (users.find(u => u.username === username)) {
        return res.send('<h2 style="color:white; background:black;">User already exists. <a href="/register.html">Go Back</a></h2>');
    }

    const newUser = {
        username: username,
        password: password,
        role: "Staff" // Auto-assign generic staff role
    };

    users.push(newUser);
    saveUser(users);

    res.redirect('/login.html');
});

router.get('/logout', (req, res) => {
    res.redirect('/');
});

module.exports = router;