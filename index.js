const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// 👉 Firebase र OneSignal को सेटिङ
const FIREBASE_DB_URL = "https://sajilokamai-72496-default-rtdb.firebaseio.com";
const SECRET_KEY = "aa502ea3d1d752f7458a4625e0df43"; // 👉 आफ्नो Postback key हाल
const ONESIGNAL_APP_ID = "ab2b8bde-4b9c-4d7b-a4ee-4e2f282726b4"; // 👉 यहाँ OneSignal App ID राख्नुहोस्
const ONESIGNAL_REST_API_KEY = "os_v2_app_vmvyxxsltrgxxjhojyxsqjzgwtfcztm2mqauel5k7otmjk3mnz6a3tuvs4vhpctpw2cbqwliwhvvrfuld6kgtrxdovogww3mpzoprma"; // 👉 यहाँ OneSignal API Key राख्नुहोस्

app.get('/postback', async (req, res) => {
    const { 
        user_id, 
        reward, 
        transaction_id,
        signature,
        offer_name,
        task_name
    } = req.query;

    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("Missing data");
    }

    try {
        const rewardInt = Math.trunc(Number(reward));
        const dataString = `${SECRET_KEY}.${user_id}.${rewardInt}.${transaction_id}`;

        const expectedSignature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(dataString)
            .digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            return res.status(403).send("Invalid signature");
        }

        // 🔹 Get User Email for notification
        const userRes = await fetch(`${FIREBASE_DB_URL}/users/${user_id}.json`);
        const userData = await userRes.json();
        const userEmail = userData?.email;

        let currentCoins = Number(userData?.coins || userData?.balance || 0);
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

        // 🔥 History save (यहाँ डेटाबेसमा हिस्ट्री मात्र बस्छ, notification बस्दैन)
        const finalOfferName = offer_name ? offer_name : "Offerwall Game";
        const history = {
            userId: user_id,
            userEmail: userEmail || "From Server",
            amount: Number(reward),
            offer_name: finalOfferName, // अब असली नाम जानेछ
            task_name: task_name || "Task",
            transaction_id,
            timestamp: Date.now()
        };

        await fetch(`${FIREBASE_DB_URL}/history/${user_id}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(history)
        });

        // 🔥 Send OneSignal Notification Direct to User
        if (userEmail) {
            const pushData = {
                app_id: ONESIGNAL_APP_ID,
                target_channel: "push",
                filters: [
                    {"field": "tag", "key": "email", "relation": "=", "value": userEmail}
                ],
                headings: {"en": "Offerwall Completed! 🎉"},
                contents: {"en": `तपाईंले ${finalOfferName} बाट ${reward} Coins कमाउनुभयो। खातेमा जम्मा भइसक्यो!`},
            };

            await fetch("https://onesignal.com/api/v1/notifications", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify(pushData)
            }).then(resp => resp.json())
              .then(data => console.log("Push Result:", data))
              .catch(err => console.error("Push Error:", err));
        }

        console.log(`User ${user_id} earned ${reward}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error(error);
        return res.status(500).send("Server Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
