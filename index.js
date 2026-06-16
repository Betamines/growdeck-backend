const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// १. GrowDeck ड्यासबोर्डबाट पाएको Postback Secret Key
const POSTBACK_SECRET_KEY = "aa502ea3d1d752f7458a4625e0df43";

// २. तपाईंको वास्तविक Firebase Realtime Database URL
const FIREBASE_DB_URL = "https://sajilokamai-72496-default-rtdb.firebaseio.com/users";

app.get('/postback', async (req, res) => {
    const { user_id, reward, transaction_id, signature } = req.query;

    // विवरण नपुगे रिक्वेस्ट रोक्ने
    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("विवरण अपूर्ण छ");
    }

    // डकुमेन्ट अनुसार Signature बनाउने वास्तविक तरिका
    const template = `${POSTBACK_SECRET_KEY}.${user_id}.${Math.trunc(reward)}.${transaction_id}`;
    const expectedSignature = crypto.createHmac('sha256', POSTBACK_SECRET_KEY).update(template).digest('hex');

    // सुरक्षा जाँच: सिग्नेचर मिले मात्र भित्र छिर्ने
    if (signature === expectedSignature) {
        try {
            // क) Firebase बाट यो युजरको हालको डाटा तान्ने
            const getUserResponse = await fetch(`${FIREBASE_DB_URL}/${user_id}.json`);
            const userData = await getUserResponse.json();
            
            // ख) पुराना कोइन वा ब्यालेन्स कति छ हेर्ने (एपको स्ट्रक्चर जे भए पनि नबिग्रियोस्)
            let currentCoins = 0;
            if (userData) {
                currentCoins = Number(userData.coins || userData.balance || 0);
            }

            // ग) पुरानो कोइनमा GrowDeck को नयाँ रिवार्ड थप्ने
            const newCoins = currentCoins + Number(reward);

            // घ) Firebase मा पुराना डाटाहरू (नाम, इमेल, आदि) नबिगारीकन कोइन मात्र अपडेट गर्ने (PATCH)
            await fetch(`${FIREBASE_DB_URL}/${user_id}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    coins: newCoins,   // एपले coins खोजे पनि भेट्छ
                    balance: newCoins  // एपले balance खोजे पनि भेट्छ
                })
            });

            console.log(`सफलतापूर्वक युजर ${user_id} को नयाँ ब्यालेन्स ${newCoins} अपडेट भयो।`);
            return res.status(200).send("OK");

        } catch (error) {
            console.error("Firebase Database Error:", error);
            return res.status(500).send("Database Error");
        }
    } else {
        console.log("सुरक्षा जाँच असफल: अवैध सिग्नेचर!");
        return res.status(403).send("अवैध रिक्वेस्ट");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
