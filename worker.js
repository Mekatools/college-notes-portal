// ========================================================
// 🛡️ SECRET TEACHER PASSWORD (Hidden on Cloudflare server)
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

    // Helper: Verify Teacher Secret Key on any Admin action
    function isAuthorized(req) {
      const providedKey = req.headers.get("X-Teacher-Key");
      return providedKey === MASTER_TEACHER_PASSWORD;
    }

    // --- 1. SECURE LOGIN API ---
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

    // --- 2. DIRECT FILE UPLOAD API (/api/upload) ---
    if (url.pathname === "/api/upload" && request.method === "POST") {
      if (!isAuthorized(request)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
          return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
        }

        // Generate unique key
        const key = `file-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const arrayBuffer = await file.arrayBuffer();

        // Save binary file into Cloudflare KV
        await env.FILES_KV.put(key, arrayBuffer, {
          metadata: {
            name: file.name,
            type: file.type || "application/octet-stream"
          }
        });

        return new Response(JSON.stringify({
          success: true,
          fileName: file.name,
          downloadUrl: `/api/file?key=${encodeURIComponent(key)}`
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // --- 3. SERVE / DOWNLOAD FILE API (/api/file) ---
    if (url.pathname === "/api/file" && request.method === "GET") {
      try {
        const key = url.searchParams.get("key");
        if (!key) return new Response("Missing file key", { status: 400 });

        const { value, metadata } = await env.FILES_KV.getWithMetadata(key, { type: "arrayBuffer" });
        if (!value) return new Response("File not found or expired", { status: 404 });

        const fileName = metadata?.name || "lecture_notes.pdf";
        const fileType = metadata?.type || "application/pdf";

        return new Response(value, {
          headers: {
            "Content-Type": fileType,
            "Content-Disposition": `inline; filename="${fileName}"`
          }
        });
      } catch (err) {
        return new Response("Error retrieving file", { status: 500 });
      }
    }

    // --- 4. SUBJECTS API (/api/subjects) ---
    if (url.pathname === "/api/subjects") {
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

      if (request.method === "POST") {
        if (!isAuthorized(request)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        try {
          const { name } = await request.json();
          await env.DB.prepare("INSERT OR IGNORE INTO subjects (name) VALUES (?)").bind(name).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      if (request.method === "PUT") {
        if (!isAuthorized(request)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        try {
          const { oldName, newName } = await request.json();
          await env.DB.prepare("UPDATE subjects SET name = ? WHERE name = ?").bind(newName, oldName).run();
          await env.DB.prepare("UPDATE notes SET subject = ? WHERE subject = ?").bind(newName, oldName).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      if (request.method === "DELETE") {
        if (!isAuthorized(request)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
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

    // --- 5. NOTES API (/api/notes) ---
    if (url.pathname === "/api/notes") {
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

      if (request.method === "POST") {
        if (!isAuthorized(request)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
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

      if (request.method === "DELETE") {
        if (!isAuthorized(request)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
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

    // Serve HTML, CSS, JS files automatically
    return env.ASSETS.fetch(request);
  }
};
