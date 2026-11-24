// --- STATE ---
let subjects = ["All"];
let notes = [];
let teachers = JSON.parse(localStorage.getItem("eduvault_teachers")) || {};
let currentTeacher = sessionStorage.getItem("currentTeacher") || null;
let selectedSubject = "All";

// --- FETCH DATA FROM CLOUDFLARE D1 ---
async function fetchGlobalData() {
  try {
    // 1. Fetch Subjects
    const subRes = await fetch('/api/subjects');
    const subData = await subRes.json();
    
    // Seed default subjects if database is brand new
    if (!subData || subData.length === 0) {
      const defaults = ["Computer Networks", "Database Systems", "Operating Systems", "Mathematics"];
      for (const d of defaults) {
        await fetch('/api/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: d })
        });
      }
      subjects = ["All", ...defaults];
    } else {
      subjects = ["All", ...subData.map(s => s.name)];
    }

    // 2. Fetch Notes
    const notesRes = await fetch('/api/notes');
    notes = await notesRes.json();

    // Render Portal
    renderStudentView();
    if (currentTeacher) {
      renderTeacherPanel();
    }
  } catch (err) {
    console.error("Failed to load cloud data", err);
  }
}

// --- TAB SWITCHER ---
function switchView(viewName) {
  const studentView = document.getElementById("studentView");
  const teacherView = document.getElementById("teacherView");
  const tabStudentBtn = document.getElementById("tabStudentBtn");
  const tabTeacherBtn = document.getElementById("tabTeacherBtn");

  if (viewName === "student") {
    studentView.classList.add("active");
    teacherView.classList.remove("active");
    tabStudentBtn.classList.add("active");
    tabTeacherBtn.classList.remove("active");
    renderStudentView();
  } else {
    if (!currentTeacher) {
      openTeacherLogin();
      return;
    }
    teacherView.classList.add("active");
    studentView.classList.remove("active");
    tabTeacherBtn.classList.add("active");
    tabStudentBtn.classList.remove("active");
    document.getElementById("teacherNameDisplay").innerText = currentTeacher;
    renderTeacherPanel();
  }
}

// --- TEACHER LOGIN & REGISTRATION ---
function openTeacherLogin() {
  if (currentTeacher) {
    switchView("teacher");
    return;
  }
  document.getElementById("teacherAuthModal").classList.add("active");
  document.getElementById("loginTeacherName").value = "";
  document.getElementById("loginTeacherPin").value = "";
}

function closeAuthModal() {
  document.getElementById("teacherAuthModal").classList.remove("active");
}

function loginOrRegisterTeacher() {
  const name = document.getElementById("loginTeacherName").value.trim();
  const pin = document.getElementById("loginTeacherPin").value.trim();

  if (!name || !pin) {
    showToast("Please enter both Name and PIN");
    return;
  }

  if (teachers[name]) {
    if (teachers[name] !== pin) {
      showToast("Incorrect PIN for this teacher name!");
      return;
    }
    showToast(`Welcome back, ${name}!`);
  } else {
    teachers[name] = pin;
    localStorage.setItem("eduvault_teachers", JSON.stringify(teachers));
    showToast(`Registered successfully as ${name}!`);
  }

  currentTeacher = name;
  sessionStorage.setItem("currentTeacher", currentTeacher);
  closeAuthModal();
  switchView("teacher");
}

function logoutTeacher() {
  currentTeacher = null;
  sessionStorage.removeItem("currentTeacher");
  showToast("Logged out.");
  switchView("student");
}

// --- STUDENT VIEW RENDERING ---
function renderStudentView() {
  renderCategoryPills();
  renderNotesGrid();
}

function renderCategoryPills() {
  const bar = document.getElementById("categoryFilterBar");
  bar.innerHTML = subjects.map(sub => `
    <button class="category-chip ${selectedSubject === sub ? 'active' : ''}" onclick="filterBySubject('${sub}')">
      ${sub}
    </button>
  `).join("");
}

function filterBySubject(sub) {
  selectedSubject = sub;
  renderStudentView();
}

function handleSearch() {
  renderNotesGrid();
}

function renderNotesGrid() {
  const grid = document.getElementById("notesListGrid");
  const query = document.getElementById("searchInput").value.toLowerCase();

  const filtered = notes.filter(n => {
    const matchesSub = selectedSubject === "All" || n.subject === selectedSubject;
    const matchesQuery = n.title.toLowerCase().includes(query) ||
                         n.description.toLowerCase().includes(query) ||
                         n.teacher.toLowerCase().includes(query) ||
                         n.subject.toLowerCase().includes(query);
    return matchesSub && matchesQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 45px; color: var(--text-muted);">
        <i class="ri-inbox-line" style="font-size: 2.5rem; display: block; margin-bottom: 8px;"></i>
        <p>No notes published in this subject.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(note => `
    <div class="glass-card note-card">
      <div>
        <div class="note-header">
          <span class="note-cat-tag">${note.subject}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${note.date}</span>
        </div>
        <div class="teacher-tag">
          <i class="ri-user-follow-line"></i> ${note.teacher}
        </div>
        <h4 class="note-title">${note.title}</h4>
        <p class="note-desc">${note.description}</p>
      </div>
      <div class="note-footer">
        <span style="font-size: 0.75rem; color: var(--text-muted);">
          <i class="ri-google-drive-fill" style="color: #34d399;"></i> Google Drive
        </span>
        <a href="${note.driveUrl}" target="_blank" class="btn-download">
          <i class="ri-external-link-line"></i> View / Download
        </a>
      </div>
    </div>
  `).join("");
}

// --- TEACHER ACTIONS (SUBJECTS & NOTES) ---
function renderTeacherPanel() {
  // Populate dropdown
  const select = document.getElementById("noteCategorySelect");
  const actualSubjects = subjects.filter(s => s !== "All");
  select.innerHTML = actualSubjects.map(s => `<option value="${s}">${s}</option>`).join("");

  // Populate Subject Management List with Edit & Delete Buttons
  const subList = document.getElementById("adminSubjectsList");
  if (actualSubjects.length === 0) {
    subList.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-muted);">No subjects created yet.</p>`;
  } else {
    subList.innerHTML = actualSubjects.map(sub => `
      <div class="admin-note-item">
        <span><i class="ri-book-line" style="color: var(--accent-blue); margin-right: 5px;"></i>${sub}</span>
        <div class="action-btns">
          <button class="btn-edit" onclick="handleEditCategory('${sub}')" title="Rename Subject">
            <i class="ri-pencil-line"></i>
          </button>
          <button class="btn-del" onclick="handleDeleteCategory('${sub}')" title="Delete Subject">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    `).join("");
  }

  // Populate Published Notes List
  const list = document.getElementById("adminNotesList");
  const myNotes = notes.filter(n => n.teacher === currentTeacher);

  if (myNotes.length === 0) {
    list.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-muted);">You haven't posted any notes yet.</p>`;
    return;
  }

  list.innerHTML = myNotes.map(n => `
    <div class="admin-note-item">
      <div>
        <span>${n.title}</span>
        <p style="font-size: 0.72rem; color: var(--accent-blue);">${n.subject}</p>
      </div>
      <button class="btn-del" onclick="deleteNote('${n.id}')" title="Delete note">
        <i class="ri-delete-bin-line"></i>
      </button>
    </div>
  `).join("");
}

// 1. ADD SUBJECT
async function handleAddCategory() {
  const input = document.getElementById("newCategoryInput");
  const newSub = input.value.trim();
  if (!newSub) return;

  if (subjects.includes(newSub)) {
    showToast("Subject already exists!");
    return;
  }

  try {
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSub })
    });

    if (res.ok) {
      input.value = "";
      showToast(`Subject "${newSub}" added!`);
      fetchGlobalData();
    }
  } catch (err) {
    showToast("Failed to add subject.");
  }
}

// 2. EDIT / RENAME SUBJECT
async function handleEditCategory(oldName) {
  const newName = prompt(`Rename subject "${oldName}" to:`, oldName);
  if (!newName || newName.trim() === "" || newName.trim() === oldName) return;

  const trimmed = newName.trim();
  showToast("Updating subject...");

  try {
    const res = await fetch('/api/subjects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName: oldName, newName: trimmed })
    });

    if (res.ok) {
      showToast(`Renamed to "${trimmed}"!`);
      fetchGlobalData();
    }
  } catch (err) {
    showToast("Failed to rename subject.");
  }
}

// 3. DELETE SUBJECT
async function handleDeleteCategory(name) {
  const ok = confirm(`Are you sure you want to delete "${name}"?`);
  if (!ok) return;

  showToast("Deleting subject...");

  try {
    const res = await fetch(`/api/subjects?name=${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast(`Subject "${name}" deleted.`);
      fetchGlobalData();
    }
  } catch (err) {
    showToast("Failed to delete subject.");
  }
}

// 4. PUBLISH NOTE
async function handleCreateNote(e) {
  e.preventDefault();

  const title = document.getElementById("noteTitle").value.trim();
  const subject = document.getElementById("noteCategorySelect").value;
  const description = document.getElementById("noteDesc").value.trim();
  const driveUrl = document.getElementById("driveLinkInput").value.trim();

  if (!driveUrl) {
    showToast("Please enter a link!");
    return;
  }

  const newNote = {
    id: Date.now().toString(),
    title: title,
    subject: subject,
    teacher: currentTeacher,
    description: description,
    driveUrl: driveUrl,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };

  showToast("Publishing note...");

  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNote)
    });

    if (res.ok) {
      showToast("Published globally to all students!");
      e.target.reset();
      fetchGlobalData();
    } else {
      showToast("Error saving note.");
    }
  } catch (err) {
    showToast("Network error. Please try again.");
  }
}

// 5. DELETE NOTE
async function deleteNote(id) {
  try {
    const res = await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast("Note deleted from database.");
      fetchGlobalData();
    }
  } catch (err) {
    showToast("Failed to delete note.");
  }
}

// Toast Alert
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 3000);
}

// Boot up portal
fetchGlobalData();
