// ========================================================
// 🛡️ SECRET TEACHER PASSWORD (Hidden safely on Cloudflare server)
// Students CANNOT see this with Inspect Element!
// (Change this word anytime right here in GitHub)
// ========================================================
const MASTER_TEACHER_PASSWORD = "teacher2026";
// ========================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Auto-create database tables if not existing
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS subjects (name TEXT PRIMARY KEY)").run();
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT, subject TEXT, teacher TEXT, description TEXT, driveUrl TEXT, date TEXT)"
    ).run();

    // --- 1. SECURE LOGIN VERIFICATION API ---
    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        const { password } = await request.json();
        if (password === MASTER_TEACHER_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ error: "Invalid password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
      }
    }

    // Helper: Verify Teacher Secret Key on any Add/Edit/Delete action
    function isAuthorized(req) {
      const providedKey = req.headers.get("X-Teacher-Key");
      return providedKey === MASTER_TEACHER_PASSWORD;
    }

    // --- 2. SUBJECTS API (/api/subjects) ---
    if (url.pathname === "/api/subjects") {
      // Students can READ subjects freely
      if (request.method === "GET") {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM subjects ORDER BY name ASC").all();
          return new Response(JSON.stringify(results || []), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (e) {
          return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
        }
      }

      // ONLY authenticated teachers can ADD subjects
      if (request.method === "POST") {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const { name } = await request.json();
          await env.DB.prepare("INSERT OR IGNORE INTO subjects (name) VALUES (?)").bind(name).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      // ONLY authenticated teachers can RENAME subjects
      if (request.method === "PUT") {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const { oldName, newName } = await request.json();
          await env.DB.prepare("UPDATE subjects SET name = ? WHERE name = ?").bind(newName, oldName).run();
          await env.DB.prepare("UPDATE notes SET subject = ? WHERE subject = ?").bind(newName, oldName).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      // ONLY authenticated teachers can DELETE subjects
      if (request.method === "DELETE") {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const name = url.searchParams.get("name");
          if (name) {
            await env.DB.prepare("DELETE FROM subjects WHERE name = ?").bind(name).run();
            await env.DB.prepare("DELETE FROM notes WHERE subject = ?").bind(name).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }
    }

    // --- 3. NOTES API (/api/notes) ---
    if (url.pathname === "/api/notes") {
      // Students can READ notes freely
      if (request.method === "GET") {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM notes ORDER BY id DESC").all();
          return new Response(JSON.stringify(results || []), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (e) {
          return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
        }
      }

      // ONLY authenticated teachers can PUBLISH notes
      if (request.method === "POST") {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const note = await request.json();
          await env.DB.prepare(
            "INSERT INTO notes (id, title, subject, teacher, description, driveUrl, date) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind(note.id, note.title, note.subject, note.teacher, note.description, note.driveUrl, note.date).run();

          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      // ONLY authenticated teachers can DELETE notes
      if (request.method === "DELETE") {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const id = url.searchParams.get("id");
          if (id) {
            await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }
    }

    // Serve HTML, CSS, JS files automatically to students
    return env.ASSETS.fetch(request);
  }
};
