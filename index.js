const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// हजुरले दिनुभएका वास्तविक कुञ्जीहरू (Keys)
const PLAYTIME_SECRET_KEY = "f2423d5bf68617d61e57"; 
const POSTBACK_SECRET_KEY = "aa502ea3d1d752f7458a4625e0df43";

// १. GrowDeck Playtime URL जेनेरेट गर्ने लिङ्क
app.get('/get-wall-url', (req, res) => {
    const userId = req.query.user_id || "guest_123";
    const appId = req.query.app_id || "YOUR_APP_ID"; // हजुरको एप आईडी (यदि छ भने)

    // डकुमेन्ट अनुसार: जुनसुकै एउटा र्‍यान्डम स्ट्रिङ जेनेरेट गर्ने
    const randomDeviceId = Math.random().toString(36).substring(2, 15);
    
    // डकुमेन्टको Playtime URL Format अनुसार लिङ्क तयार पारेको
    const wallUrl = `https://websdk.growdeck.io/?app-id=${appId}&secret-key=${PLAYTIME_SECRET_KEY}&external-id=${userId}&device-id=${randomDeviceId}`;
    
    res.json({ url: wallUrl });
});

// २. GrowDeck ले डेटा पठाउने मुख्य Postback URL
app.get('/postback', (req, res) => {
    const { user_id, reward, transaction_id, signature } = req.query;

    // अनिवार्य पारामिटरहरू आएका छन् कि छैनन् जाँच गर्ने
    if (!user_id || !reward || !transaction_id || !signature) {
        return res.status(400).send("अनिवार्य विवरणहरू पुगेनन्।");
    }

    // डकुमेन्टको नियम अनुसार Signature रिक्रिएट गर्ने संरचना: secretKey.user_id.reward.transaction_id
    // पुरस्कारको मानलाई Math.trunc() मा राख्नुपर्ने नियम पालना गरिएको छ
    const template = `${POSTBACK_SECRET_KEY}.${user_id}.${Math.trunc(reward)}.${transaction_id}`;
    const expectedSignature = crypto.createHmac('sha256', POSTBACK_SECRET_KEY).update(template).digest('hex');

    // डकुमेन्टको Step 3: दुवै Signature म्याच गराउने
    if (signature === expectedSignature) {
        console.log(`सफल रिक्वेस्ट! प्रयोगकर्ता ${user_id} ले ${reward} पुरस्कार पाए।`);
        
        // यहाँ पछि हजुरको आवश्यकता अनुसार युजरको खातामा पोइन्ट थप्ने कोड बस्छ।
        
        res.status(200).send("OK"); // GrowDeck लाई सफल भएको संकेत दिन OK पठाउने
    } else {
        console.log("गलत सिग्नेचर! अवैध रिक्वेस्ट।");
        res.status(403).send("नक्कली वा अवैध रिक्वेस्ट।");
    }
});

app.listen(PORT, () => {
    console.log(`सर्भर पोर्ट ${PORT} मा सफलतापूर्वक चलिरहेको छ।`);
});
