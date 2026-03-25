export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }
    });
  }

  try {
    const { email, name, businessType } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const TURSO_URL = process.env.TURSO_DATABASE_URL;
    const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
    const RESEND_KEY = process.env.RESEND_API_KEY;

    // Use Turso HTTP API
    const tursoUrl = TURSO_URL.replace("libsql://", "https://");

    // Create table
    await fetch(tursoUrl + "/v2/pipeline", {
      method: "POST",
      headers: { "Authorization": "Bearer " + TURSO_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT, business_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)" } },
          { type: "execute", stmt: { sql: "INSERT OR IGNORE INTO subscribers (email, name, business_type) VALUES (?, ?, ?)", args: [{ type: "text", value: email }, { type: "text", value: name || "" }, { type: "text", value: businessType || "" }] } },
          { type: "close" }
        ]
      })
    });

    // Send thank you email via Resend
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "PermitPilot AI <onboarding@resend.dev>",
          to: [email],
          subject: "Welcome to PermitPilot AI!",
          html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0F172A;color:#E2E8F0;padding:40px;border-radius:16px"><h1 style="color:#3B82F6;text-align:center">PermitPilot AI</h1><h2 style="color:#F1F5F9">Thanks for signing up' + (name ? ', ' + name : '') + '!</h2><p style="color:#94A3B8;line-height:1.6">You are now on the list to get early access to PermitPilot AI — the smartest way to navigate business permits and licenses.</p><ul style="color:#CBD5E1;line-height:2"><li>AI-powered permit analysis for any business type</li><li>State and city-specific requirements</li><li>Cost estimates and timeline projections</li><li>Step-by-step compliance checklists</li></ul><p style="color:#94A3B8">We will keep you posted on updates and early access.</p><div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #334155"><p style="color:#475569;font-size:12px">PermitPilot AI — Navigate permits, not paperwork.</p></div></div>'
        })
      });
    } catch (e) {
      console.error("Email error:", e);
    }

    return new Response(JSON.stringify({ success: true, message: "You're on the list!" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Signup failed: " + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/api/signup" };
