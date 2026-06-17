const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch'); // जरुरी छ
const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 CONFIG
const FIREBASE_DB_URL = "https://sajilokamai-72496-default-rtdb.firebaseio.com";
const SECRET_KEY = "aa502ea3d1d752f7458a4625e0df43";

const ONESIGNAL_APP_ID = "ab2b8bde-4b9c-4d7b-a4ee-4e2f282726b4";
const ONESIGNAL_REST_API_KEY = "os_v2_app_xxxxxxxxxxxxxxxxx"; // 🔁 आफ्नो सही key राख

// 🚀 ROUTE
app.get('/postback', async (req, res) => {
    const { 
        user_id, 
        reward, 
        transaction_id,
        signature,
        offer_name,
        task_name
    } = req.query;

    // 🔴 VALIDATION
    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("Missing data");
    }

    try {
        const rewardInt = Math.trunc(Number(reward));

        // 🔐 SIGNATURE VERIFY
        const dataString = `${SECRET_KEY}.${user_id}.${rewardInt}.${transaction_id}`;

        const expectedSignature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(dataString)
            .digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            return res.status(403).send("Invalid signature");
        }

        // 🔹 GET USER DATA
        const userRes = await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = await userRes.json();

        let currentCoins = Number(userData?.coins || userData?.balance || 0);
        const newCoins = currentCoins + Number(reward);

        // 🔹 UPDATE COINS
        await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                coins: newCoins,
                balance: newCoins
            })
        });

        // 🔹 HISTORY SAVE
        const finalOfferName = offer_name || "Offerwall Game";

        const history = {
            userId: user_id,
            amount: Number(reward),
            offer_name: finalOfferName,
            task_name: task_name || "Task",
            transaction_id,
            timestamp: Date.now()
        };

        await fetch(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(history)
        });

        // 🔔 🔥 SEND ONESIGNAL NOTIFICATION (BEST METHOD)
        const pushData = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [user_id],
            headings: {
                en: "Offerwall Completed! 🎉"
            },
            contents: {
                en: `तपाईंले ${finalOfferName} बाट ${reward} Coins कमाउनुभयो। खातेमा जम्मा भइसक्यो!`
            }
        };

        try {
            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify(pushData)
            });

            const result = await response.json();
            console.log("✅ OneSignal Response:", result);

        } catch (err) {
            console.error("❌ Push Error:", err);
        }

        console.log(`✅ User ${user_id} earned ${reward}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("❌ Server Error:", error);
        return res.status(500).send("Server Error");
    }
});

// 🚀 START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
