// --- INITIAL SAMPLE DATA ---
const defaultSubjects = ["All", "Computer Networks", "Database Systems", "Operating Systems", "Mathematics"];

const defaultNotes = [
  {
    id: "1",
    title: "Unit 1: Relational Algebra & SQL Cheat Sheet",
    subject: "Database Systems",
    teacher: "Prof. Sharma",
    description: "Complete handwritten notes covering joins, queries, and normal forms directly from Google Drive.",
    driveUrl: "https://drive.google.com",
    date: "Nov 20, 2026"
  },
  {
    id: "2",
    title: "Process Synchronization & Semaphores",
    subject: "Operating Systems",
    teacher: "Dr. Verma",
    description: "Full slide deck detailing classical IPC problems and mutex lock algorithms.",
    driveUrl: "https://drive.google.com",
    date: "Nov 18, 2026"
  }
];

// --- STORAGE & STATE ---
let subjects = JSON.parse(localStorage.getItem("eduvault_subjects")) || defaultSubjects;
let notes = JSON.parse(localStorage.getItem("eduvault_notes")) || defaultNotes;
let teachers = JSON.parse(localStorage.getItem("eduvault_teachers")) || {}; // { "Prof. Sharma": "1234" }
let currentTeacher = sessionStorage.getItem("currentTeacher") || null;
let selectedSubject = "All";

function savePortalData() {
  localStorage.setItem("eduvault_subjects", JSON.stringify(subjects));
  localStorage.setItem("eduvault_notes", JSON.stringify(notes));
  localStorage.setItem("eduvault_teachers", JSON.stringify(teachers));
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
    // Check if teacher is logged in
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

  // If teacher exists, check PIN. If new teacher, register them automatically.
  if (teachers[name]) {
    if (teachers[name] !== pin) {
      showToast("Incorrect PIN for this teacher name!");
      return;
    }
    showToast(`Welcome back, ${name}!`);
  } else {
    teachers[name] = pin;
    savePortalData();
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
        <p>No notes found in this category.</p>
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
        <a href="${cleanDriveUrl(note.driveUrl)}" target="_blank" class="btn-download">
          <i class="ri-external-link-line"></i> View / Download
        </a>
      </div>
    </div>
  `).join("");
}

// Convert Google Drive share link into an accessible link
function cleanDriveUrl(url) {
  if (!url) return "#";
  // If teacher pastes a standard share link, make sure it opens directly
  return url.trim();
}

// --- TEACHER ADMIN ACTIONS ---
function renderTeacherPanel() {
  // Populate subject dropdown
  const select = document.getElementById("noteCategorySelect");
  const actualSubjects = subjects.filter(s => s !== "All");
  select.innerHTML = actualSubjects.map(s => `<option value="${s}">${s}</option>`).join("");

  // Show only this teacher's published notes
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

// Publish note with Drive Link
function handleCreateNote(e) {
  e.preventDefault();

  const title = document.getElementById("noteTitle").value.trim();
  const subject = document.getElementById("noteCategorySelect").value;
  const description = document.getElementById("noteDesc").value.trim();
  const driveUrl = document.getElementById("driveLinkInput").value.trim();

  if (!driveUrl.includes("drive.google.com") && !driveUrl.includes("http")) {
    showToast("Please enter a valid link!");
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

  notes.unshift(newNote);
  savePortalData();
  renderTeacherPanel();
  e.target.reset();
  showToast("Note published to students!");
}

// Add new subject
function handleAddCategory() {
  const input = document.getElementById("newCategoryInput");
  const newSub = input.value.trim();
  if (!newSub) return;

  if (subjects.includes(newSub)) {
    showToast("Subject already exists!");
    return;
  }

  subjects.push(newSub);
  savePortalData();
  renderTeacherPanel();
  input.value = "";
  showToast(`Subject "${newSub}" created!`);
}

// Delete note
function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  savePortalData();
  renderTeacherPanel();
  showToast("Note deleted.");
}

// Toast message
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 3000);
}

// Boot up portal
renderStudentView();
