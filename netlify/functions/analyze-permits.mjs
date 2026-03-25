export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }
    });
  }

  try {
    const { businessType, state, city, description } = await req.json();
    if (!businessType || !state) {
      return new Response(JSON.stringify({ error: "Business type and state are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const prompt = `You are PermitPilot AI, an expert on US business permits, licenses, and regulatory compliance. A user wants to start a business. Analyze what they need.

Business Type: ${businessType}
State: ${state}
City: ${city || "Not specified"}
Additional Details: ${description || "None"}

Provide a comprehensive permit/license analysis in the following JSON format:
{
  "summary": "Brief 2-sentence summary of what they'll need",
  "riskLevel": "low|medium|high",
  "estimatedTotalCost": "$X,XXX - $X,XXX",
  "estimatedTimeline": "X-X weeks",
  "permits": [
    {
      "name": "Permit/License name",
      "category": "federal|state|local|industry",
      "description": "What this is and why it's needed",
      "estimatedCost": "$XXX",
      "processingTime": "X-X weeks",
      "renewalFrequency": "Annual/One-time/etc",
      "difficulty": "easy|moderate|complex",
      "tips": "Key tip for this permit"
    }
  ],
  "complianceChecklist": ["Step 1: ...", "Step 2: ..."],
  "warnings": ["Any critical warnings or common mistakes"],
  "industrySpecificNotes": "Any industry-specific regulatory notes"
}

Be thorough and accurate. Include federal (EIN, etc), state, local, and industry-specific requirements. Return ONLY valid JSON.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(analysis), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Analysis failed: " + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/api/analyze-permits" };
