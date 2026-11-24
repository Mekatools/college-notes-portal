// --- STATE ---
let subjects = ["All"];
let notes = [];
let teachers = JSON.parse(localStorage.getItem("eduvault_teachers")) || {};
let currentTeacher = sessionStorage.getItem("currentTeacher") || null;
let selectedSubject = "All";

// --- LOAD NOTES FROM CLOUDFLARE DATABASE GLOBALLY ---
async function fetchGlobalNotes() {
  try {
    const res = await fetch('/api/notes');
    notes = await res.json();

    // Auto-detect subjects from all published notes
    const extractedSubjects = ["All", ...new Set(notes.map(n => n.subject))];
    const savedCustomSubjects = JSON.parse(localStorage.getItem("eduvault_custom_subjects")) || [];
    subjects = [...new Set([...extractedSubjects, ...savedCustomSubjects])];

    renderStudentView();
    if (currentTeacher) {
      renderTeacherPanel();
    }
  } catch (err) {
    console.error("Failed to fetch notes from Cloudflare D1", err);
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

// --- STUDENT PORTAL RENDERING ---
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
        <p>No notes published yet.</p>
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

// --- TEACHER ACTIONS (SAVES TO CLOUDFLARE D1) ---
function renderTeacherPanel() {
  const select = document.getElementById("noteCategorySelect");
  const actualSubjects = subjects.filter(s => s !== "All");
  select.innerHTML = actualSubjects.map(s => `<option value="${s}">${s}</option>`).join("");

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

// Publish note to Cloudflare D1
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

  showToast("Publishing to Cloudflare D1...");

  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNote)
    });

    if (res.ok) {
      showToast("Published globally to all students!");
      e.target.reset();
      fetchGlobalNotes();
    } else {
      showToast("Error saving note to database.");
    }
  } catch (err) {
    showToast("Network error. Please try again.");
  }
}

// Add Subject
function handleAddCategory() {
  const input = document.getElementById("newCategoryInput");
  const newSub = input.value.trim();
  if (!newSub) return;

  if (subjects.includes(newSub)) {
    showToast("Subject already exists!");
    return;
  }

  subjects.push(newSub);
  const saved = JSON.parse(localStorage.getItem("eduvault_custom_subjects")) || [];
  saved.push(newSub);
  localStorage.setItem("eduvault_custom_subjects", JSON.stringify(saved));

  renderTeacherPanel();
  renderCategoryPills();
  input.value = "";
  showToast(`Subject "${newSub}" created!`);
}

// Delete note from Cloudflare D1
async function deleteNote(id) {
  try {
    const res = await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast("Note deleted from database.");
      fetchGlobalNotes();
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

// Initial Boot: fetch live notes from cloud
fetchGlobalNotes();
