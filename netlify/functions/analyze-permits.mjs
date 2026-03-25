import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }
    });
  }

  try {
    const { businessType, state, city, description } = await req.json();
    if (!businessType || !state) {
      return new Response(JSON.stringify({ error: "Business type and state are required" }), { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
      "applicationUrl": "URL if known or 'Varies by jurisdiction'",
      "tips": "Key tip for this permit"
    }
  ],
  "complianceChecklist": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "warnings": ["Any critical warnings or common mistakes"],
  "industrySpecificNotes": "Any industry-specific regulatory notes"
}

Be thorough and accurate. Include federal (EIN, etc), state, local, and industry-specific requirements. Return ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Analysis failed: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/api/analyze-permits" };
