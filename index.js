const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const FIREBASE_DB_URL = "https://sajilokamai-72496-default-rtdb.firebaseio.com";
const SECRET_KEY = "aa502ea3d1d752f7458a4625e0df43";

app.get('/postback', async (req, res) => {

    const { 
        user_id, 
        reward, 
        transaction_id,
        signature,
        offer_name,
        task_name
    } = req.query;

    // 🔹 basic check
    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("Missing data");
    }

    try {
        // 🔥 🔐 Signature verify
        const rewardInt = Math.trunc(Number(reward));
        const dataString = `${SECRET_KEY}.${user_id}.${rewardInt}.${transaction_id}`;

        const expectedSignature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(dataString)
            .digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            return res.status(403).send("Invalid signature");
        }

        // 🔹 user data
        const userRes = await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = await userRes.json();

        let currentCoins = Number(userData?.coins || userData?.balance || 0);
        const newCoins = currentCoins + Number(reward);

        // 🔹 update coins
        await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                coins: newCoins,
                balance: newCoins
            })
        });

        // 🔥 history save
        const history = {
            coins: Number(reward),
            offer_name: offer_name || "Game",
            task_name: task_name || "Task",
            transaction_id,
            timestamp: Date.now()
        };

        await fetch(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(history)
        });

        // 🔥 🔔 Notification Push Logic
        const notifRef = await fetch(`${FIREBASE_DB_URL}/notifications.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: "Offerwall Reward 🎁",
                message: `You earned ${reward} coins completing ${offer_name || 'Game'}.`,
                email: userData?.email || "ALL",
                image: "",
                timestamp: Date.now()
            })
        });

        const notifData = await notifRef.json();

        if (notifData && notifData.name) {
            await fetch(`${FIREBASE_DB_URL}/notifications/${notifData.name}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: notifData.name })
            });
        }

        console.log(`User ${user_id} earned ${reward}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error(error);
        return res.status(500).send("Server Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
