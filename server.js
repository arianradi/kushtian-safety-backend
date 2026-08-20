import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
app.use(cors());
app.use(express.json());

// Render-এর Environment Variable থেকে API Key গ্রহণ করবে
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ব্যাকএন্ডে সংরক্ষিত ডাটাবেস
let incidentsDatabase = [
  {
    id: 1,
    locationName: "কুষ্টিয়া মজমপুর গেট",
    lat: 23.9015,
    lng: 89.1215,
    incidentType: "ছিনতাই",
    iconType: "robbery",
    riskLevel: "DANGER",
    incidentTime: "রাত ১০:৩০ মিনিট",
    involvedParties: "অজ্ঞাত ছিনতাইকারী ও পথচারী",
    safeTiming: "সকাল ৬টা-সন্ধ্যা ৭টা নিরাপদ, রাত ৮টার পর অতি বিপদজনক",
    summary: "অন্ধকার গলিতে দেশীয় অস্ত্রের মুখে মোবাইল ও নগদ টাকা ছিনতাই।"
  }
];

// ১. ফ্রন্টএন্ডে ডাটা পাঠানোর রুট
app.get('/api/incidents', (req, res) => {
  res.json(incidentsDatabase);
});

// ২. জেমিনি দিয়ে ফেসবুক/নিউজ পোস্ট প্রসেস করার রুট
app.post('/api/analyze-incident', async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: "পোস্টের টেক্সট দিন" });

    const prompt = `তুমি কুষ্টিয়া (বাংলাদেশ) এলাকার ক্রাইম ও সেফটি অ্যানালাইজার। নিচে দেওয়া ফেসবুক পোস্ট বা নিউজ থেকে যাবতীয় তথ্য বের করে শুধুমাত্র ভ্যালিড JSON প্রদান কর।
কুষ্টিয়া সদরের আশেপাশের ল্যান্ডমার্ক অনুযায়ী Lat (23.70 থেকে 23.98) এবং Lng (89.00 থেকে 89.30) সীমার মধ্যে সঠিক কোঅর্ডিনেট বের করবে।

টেক্সট: "${rawText}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `তোমার দায়িত্ব হলো টেক্সট থেকে সঠিক স্থান, সময়, জড়িত পক্ষ এবং ঝুঁকির মাত্রা বের করা। iconType হবে: "robbery", "accident", "fight", "fire", অথবা "safe"। riskLevel হবে: "SAFE", "LOW", "MODERATE", বা "DANGER"।`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            locationName: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            incidentType: { type: Type.STRING },
            iconType: { type: Type.STRING, enum: ["robbery", "accident", "fight", "fire", "safe"] },
            riskLevel: { type: Type.STRING, enum: ["SAFE", "LOW", "MODERATE", "DANGER"] },
            incidentTime: { type: Type.STRING },
            involvedParties: { type: Type.STRING },
            safeTiming: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ["locationName", "lat", "lng", "incidentType", "iconType", "riskLevel", "incidentTime", "involvedParties", "safeTiming", "summary"]
        }
      }
    });

    const parsedData = JSON.parse(response.text);
    parsedData.id = Date.now();
    incidentsDatabase.unshift(parsedData);

    res.json({ success: true, incident: parsedData });
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: "জেমিনি এআই ডাটা প্রসেস করতে ব্যর্থ হয়েছে।" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
