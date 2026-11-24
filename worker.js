export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Database API for Notes
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

          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }

      if (request.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (id) {
          await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Serve HTML, CSS, JS files automatically
    return env.ASSETS.fetch(request);
  }
};
