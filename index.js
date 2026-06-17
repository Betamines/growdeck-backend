const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const FIREBASE_DB_URL = "https://sajilokamai-72496-default-rtdb.firebaseio.com";

app.get('/postback', async (req, res) => {

    const { 
        user_id, 
        reward, 
        offer_name, 
        offer_id, 
        task_name, 
        task_id,
        event_id 
    } = req.query;

    if (!user_id || !reward) {
        return res.status(400).send("Missing data");
    }

    try {
        // 🔹 Duplicate check (same event दोहोरिन नदिन)
        if (event_id) {
            const checkEvent = await fetch(`${FIREBASE_DB_URL}/events/${event_id}.json`);
            const eventExists = await checkEvent.json();

            if (eventExists) {
                console.log("Duplicate event ignored");
                return res.status(200).send("Duplicate");
            }
        }

        // 🔹 User data fetch
        const userRes = await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = await userRes.json();

        let currentCoins = 0;
        if (userData) {
            currentCoins = Number(userData.coins || userData.balance || 0);
        }

        const newCoins = currentCoins + Number(reward);

        // 🔹 Update coins
        await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                coins: newCoins,
                balance: newCoins
            })
        });

        // 🔥 🔹 HISTORY SAVE (IMPORTANT)
        const historyData = {
            user_id,
            coins: Number(reward),
            offer_name: offer_name || "Unknown Game",
            task_name: task_name || "Task",
            offer_id: offer_id || null,
            task_id: task_id || null,
            timestamp: Date.now()
        };

        await fetch(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(historyData)
        });

        // 🔹 Save event_id (duplicate रोक्न)
        if (event_id) {
            await fetch(`${FIREBASE_DB_URL}/events/${event_id}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ used: true })
            });
        }

        console.log(`User ${user_id} earned ${reward} from ${offer_name}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).send("Server Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
