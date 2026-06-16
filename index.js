const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// तपाईंको वास्तविक Firebase Realtime Database URL
const FIREBASE_DB_URL = "https://sajilokamai-72496-default-rtdb.firebaseio.com/users";

app.get('/postback', async (req, res) => {
    // वेब लिङ्कबाट आउने user_id र reward मात्र लिने
    const { user_id, reward } = req.query;

    if (!user_id || !reward) {
        return res.status(400).send("विवरण अपूर्ण छ");
    }

    try {
        // क) Firebase बाट यो युजरको हालको डाटा तान्ने
        const getUserResponse = await fetch(`${FIREBASE_DB_URL}/${user_id}.json`);
        const userData = await getUserResponse.json();
        
        let currentCoins = 0;
        if (userData) {
            // एपले 'coins' वा 'balance' जुन प्रयोग गरे पनि डेटा तान्ने
            currentCoins = Number(userData.coins || userData.balance || 0);
        }

        // ख) पुरानो कोइनमा नयाँ रिवार्ड थप्ने
        const newCoins = currentCoins + Number(reward);

        // ग) Firebase मा 'coins' र 'balance' दुवै ठाउँमा अपडेट गरिदिने (PATCH)
        await fetch(`${FIREBASE_DB_URL}/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                coins: newCoins,
                balance: newCoins
            })
        });

        console.log(`सफलतापूर्वक युजर ${user_id} को नयाँ ब्यालेन्स ${newCoins} भयो।`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("Firebase Error:", error);
        return res.status(500).send("Database Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
