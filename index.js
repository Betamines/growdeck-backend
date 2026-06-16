const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// १. हजुरको GrowDeck कुञ्जीहरू (Keys)
const PLAYTIME_SECRET_KEY = "f2423d5bf68617d61e57"; 
const POSTBACK_SECRET_KEY = "aa502ea3d1d752f7458a4625e0df43";

// २. हजुरको वास्तविक Firebase Database URL (users फोल्डर भित्र बस्ने गरी सेट गरिएको)
const FIREBASE_DB_URL = "https://sajilokamai-72496-default-rtdb.firebaseio.com/users";

// GrowDeck Playtime URL जेनेरेट गर्ने लिङ्क
app.get('/get-wall-url', (req, res) => {
    const userId = req.query.user_id || "guest_123";
    const appId = req.query.app_id || "YOUR_APP_ID"; 

    const randomDeviceId = Math.random().toString(36).substring(2, 15);
    const wallUrl = `https://websdk.growdeck.io/?app-id=${appId}&secret-key=${PLAYTIME_SECRET_KEY}&external-id=${userId}&device-id=${randomDeviceId}`;
    
    res.json({ url: wallUrl });
});

// GrowDeck ले डेटा पठाउने मुख्य Postback URL
app.get('/postback', async (req, res) => {
    const { user_id, reward, transaction_id, signature } = req.query;

    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("विवरण पुगेन");
    }

    // Signature जाँच गर्ने नियम
    const template = `${POSTBACK_SECRET_KEY}.${user_id}.${Math.trunc(reward)}.${transaction_id}`;
    const expectedSignature = crypto.createHmac('sha256', POSTBACK_SECRET_KEY).update(template).digest('hex');

    if (signature === expectedSignature) {
        console.log(`सफल रिक्वेस्ट! युजर ${user_id} लाई ${reward} पोइन्ट दिनुपर्ने।`);
        
        try {
            // १. पहिले Firebase बाट युजरको हालको ब्यालेन्स कति छ भनेर हेर्ने
            const getUserResponse = await fetch(`${FIREBASE_DB_URL}/${user_id}.json`);
            const userData = await getUserResponse.json();
            
            let currentBalance = 0;
            if (userData && userData.balance) {
                currentBalance = Number(userData.balance);
            }

            // २. पुरानो ब्यालेन्समा GrowDeck ले दिएको नयाँ पुरस्कार (Reward) थप्ने
            const newBalance = currentBalance + Number(reward);

            // ३. नयाँ ब्यालेन्सलाई Firebase Database मा सेभ (Update) गरिदिने
            await fetch(`${FIREBASE_DB_URL}/${user_id}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ balance: newBalance })
            });

            console.log(`Firebase मा युजर ${user_id} को नयाँ ब्यालेन्स ${newBalance} अपडेट भयो।`);
            return res.status(200).send("OK");

        } catch (error) {
            console.error("Firebase मा डेटा राख्दा समस्या आयो:", error);
            return res.status(500).send("Database Error");
        }
    } else {
        console.log("अवैध सिग्नेचर!");
        return res.status(403).send("नक्कली रिक्वेस्ट");
    }
});

app.listen(PORT, () => {
    console.log(`सर्भर पोर्ट ${PORT} मा चलिरहेको छ।`);
});
