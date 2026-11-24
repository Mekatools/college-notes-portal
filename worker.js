export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Auto-create tables if they don't exist
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS subjects (name TEXT PRIMARY KEY)").run();
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT, subject TEXT, teacher TEXT, description TEXT, driveUrl TEXT, date TEXT)"
    ).run();

    // --- API: SUBJECTS (/api/subjects) ---
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
        try {
          const { name } = await request.json();
          await env.DB.prepare("INSERT OR IGNORE INTO subjects (name) VALUES (?)").bind(name).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      if (request.method === "PUT") {
        try {
          const { oldName, newName } = await request.json();
          // Update subject name in subjects table
          await env.DB.prepare("UPDATE subjects SET name = ? WHERE name = ?").bind(newName, oldName).run();
          // Automatically update all notes under this subject to the new name
          await env.DB.prepare("UPDATE notes SET subject = ? WHERE subject = ?").bind(newName, oldName).run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      if (request.method === "DELETE") {
        try {
          const name = url.searchParams.get("name");
          if (name) {
            // 1. Delete the subject
            await env.DB.prepare("DELETE FROM subjects WHERE name = ?").bind(name).run();
            // 2. Cascade Delete: Delete all notes and files belonging to this subject!
            await env.DB.prepare("DELETE FROM notes WHERE subject = ?").bind(name).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }
    }

    // --- API: NOTES (/api/notes) ---
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
