export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM notes ORDER BY id DESC").all();
    return new Response(JSON.stringify(results || []), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const note = await context.request.json();
    await context.env.DB.prepare(
      "INSERT INTO notes (id, title, subject, teacher, description, driveUrl, date) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(note.id, note.title, note.subject, note.teacher, note.description, note.driveUrl, note.date).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (id) {
      await context.env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
