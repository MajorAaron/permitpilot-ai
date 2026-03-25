import { createClient } from "@libsql/client";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }
    });
  }

  try {
    const { email, name, businessType } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
    }

    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables");
      return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Create table if not exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        business_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert subscriber
    await db.execute({
      sql: "INSERT OR IGNORE INTO subscribers (email, name, business_type) VALUES (?, ?, ?)",
      args: [email, name || "", businessType || ""],
    });

    // Send thank you email via Resend
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PermitPilot AI <onboarding@resend.dev>",
          to: [email],
          subject: "Welcome to PermitPilot AI! 🧭",
          html: `
            <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: #E2E8F0; padding: 40px; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3B82F6; font-size: 28px;">🧭 PermitPilot AI</h1>
              </div>
              <h2 style="color: #F1F5F9;">Thanks for signing up${name ? ', ' + name : ''}!</h2>
              <p style="color: #94A3B8; line-height: 1.6;">You're now on the list to get early access to PermitPilot AI — the smartest way to navigate business permits and licenses.</p>
              <p style="color: #94A3B8; line-height: 1.6;">We're building something that saves entrepreneurs weeks of research and thousands in consulting fees. Here's what you'll get:</p>
              <ul style="color: #CBD5E1; line-height: 2;">
                <li>AI-powered permit analysis for any business type</li>
                <li>State and city-specific requirements</li>
                <li>Cost estimates and timeline projections</li>
                <li>Step-by-step compliance checklists</li>
              </ul>
              <p style="color: #94A3B8;">We'll keep you posted on updates and early access.</p>
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155;">
                <p style="color: #475569; font-size: 12px;">PermitPilot AI — Navigate permits, not paperwork.</p>
              </div>
            </div>
          `,
        }),
      });
      console.log("Email sent:", resendRes.status);
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
    }

    return new Response(JSON.stringify({ success: true, message: "You're on the list!" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    console.error("Signup error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again later." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/api/signup" };
