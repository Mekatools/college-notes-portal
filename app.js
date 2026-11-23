// Default Initial Data (Persisted to localStorage on first load)
const initialCategories = ["All", "Computer Networks", "Database Systems", "Operating Systems", "Mathematics"];

const initialNotes = [
  {
    id: "1",
    title: "Unit 1: Relational Algebra & SQL Queries",
    subject: "Database Systems",
    description: "Complete handwritten notes covering joins, nested subqueries, and normalization theorems.",
    fileName: "Unit1_DBMS_SQL.pdf",
    fileUrl: "data:text/plain;charset=utf-8,Sample%20DBMS%20Study%20Material%20File%20Content",
    date: "Nov 20, 2026"
  },
  {
    id: "2",
    title: "OS Process Synchronization & Semaphores",
    subject: "Operating Systems",
    description: "Lecture slides detailing Peterson's Algorithm, classical IPC problems, and Mutex locks.",
    fileName: "OS_Sync_Unit3.pdf",
    fileUrl: "data:text/plain;charset=utf-8,Sample%20OS%20Lecture%20Notes",
    date: "Nov 18, 2026"
  },
  {
    id: "3",
    title: "OSI vs TCP/IP Protocol Stack Reference",
    subject: "Computer Networks",
    description: "Quick revision sheet for all 7 layers, packet structures, and routing algorithms.",
    fileName: "Networks_Reference_Chart.pdf",
    fileUrl: "data:text/plain;charset=utf-8,Sample%20Networking%20Chart",
    date: "Nov 14, 2026"
  }
];

// Teacher Security PIN
const ADMIN_PIN = "1234";

// Local Storage Handlers
let categories = JSON.parse(localStorage.getItem("eduvault_categories")) || initialCategories;
let notes = JSON.parse(localStorage.getItem("eduvault_notes")) || initialNotes;
let selectedCategory = "All";

// Save to storage
function saveData() {
  localStorage.setItem("eduvault_categories", JSON.stringify(categories));
  localStorage.setItem("eduvault_notes", JSON.stringify(notes));
}

// ----------------- TABS & VIEWS ----------------- //
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
    teacherView.classList.add("active");
    studentView.classList.remove("active");
    tabTeacherBtn.classList.add("active");
    tabStudentBtn.classList.remove("active");
    renderAdminView();
  }
}

// ----------------- TEACHER PIN AUTH ----------------- //
function openAdminAuthModal() {
  // If already authenticated during current session, go straight in
  if (sessionStorage.getItem("isAdminLoggedIn") === "true") {
    switchView("teacher");
    return;
  }
  document.getElementById("authModal").classList.add("active");
  document.getElementById("adminPassInput").value = "";
  document.getElementById("adminPassInput").focus();
}

function closeAuthModal() {
  document.getElementById("authModal").classList.remove("active");
}

function verifyAdminPass() {
  const enteredPass = document.getElementById("adminPassInput").value;
  if (enteredPass === ADMIN_PIN) {
    sessionStorage.setItem("isAdminLoggedIn", "true");
    closeAuthModal();
    switchView("teacher");
    showToast("Teacher Dashboard Unlocked!");
  } else {
    showToast("Incorrect Passcode! Try 1234");
  }
}

// ----------------- STUDENT VIEW RENDERING ----------------- //
function renderStudentView() {
  renderCategoryPills();
  renderNotesGrid();
}

function renderCategoryPills() {
  const container = document.getElementById("categoryFilterBar");
  container.innerHTML = categories.map(cat => `
    <button class="category-chip ${selectedCategory === cat ? 'active' : ''}" onclick="filterByCategory('${cat}')">
      ${cat}
    </button>
  `).join("");
}

function filterByCategory(cat) {
  selectedCategory = cat;
  renderCategoryPills();
  renderNotesGrid();
}

function handleSearch() {
  renderNotesGrid();
}

function renderNotesGrid() {
  const grid = document.getElementById("notesListGrid");
  const query = document.getElementById("searchInput").value.toLowerCase();

  const filtered = notes.filter(n => {
    const matchesCategory = selectedCategory === "All" || n.subject === selectedCategory;
    const matchesQuery = n.title.toLowerCase().includes(query) || 
                         n.description.toLowerCase().includes(query) ||
                         n.subject.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="ri-inbox-2-line" style="font-size: 3rem;"></i>
        <p style="margin-top: 10px;">No notes found matching your criteria.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(note => `
    <div class="glass-card note-card">
      <div>
        <div class="note-header">
          <span class="note-cat-tag">${note.subject}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${note.date}</span>
        </div>
        <h4 class="note-title">${note.title}</h4>
        <p class="note-desc">${note.description}</p>
      </div>
      <div class="note-footer">
        <span><i class="ri-file-text-line"></i> ${note.fileName}</span>
        <a href="${note.fileUrl}" download="${note.fileName}" class="btn-download">
          <i class="ri-download-2-line"></i> Download
        </a>
      </div>
    </div>
  `).join("");
}

// ----------------- TEACHER ADMIN FUNCTIONALITY ----------------- //
function renderAdminView() {
  // Populate category select dropdown
  const select = document.getElementById("noteCategorySelect");
  const actualCategories = categories.filter(c => c !== "All");
  select.innerHTML = actualCategories.map(cat => `<option value="${cat}">${cat}</option>`).join("");

  // Populate Admin notes list
  const list = document.getElementById("adminNotesList");
  if (notes.length === 0) {
    list.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted);">No notes created yet.</p>`;
    return;
  }

  list.innerHTML = notes.map(n => `
    <div class="admin-note-item">
      <div>
        <span>${n.title}</span>
        <p style="font-size: 0.72rem; color: var(--accent-cyan);">${n.subject}</p>
      </div>
      <button class="btn-del" onclick="handleDeleteNote('${n.id}')" title="Delete Note">
        <i class="ri-delete-bin-6-line"></i>
      </button>
    </div>
  `).join("");
}

// Add new subject/category
function handleAddCategory() {
  const input = document.getElementById("newCategoryInput");
  const newCat = input.value.trim();

  if (!newCat) return;
  if (categories.includes(newCat)) {
    showToast("Subject already exists!");
    return;
  }

  categories.push(newCat);
  input.value = "";
  saveData();
  renderAdminView();
  showToast(`Subject "${newCat}" added!`);
}

// Handle file upload and add note
function handleCreateNote(e) {
  e.preventDefault();

  const title = document.getElementById("noteTitle").value.trim();
  const subject = document.getElementById("noteCategorySelect").value;
  const description = document.getElementById("noteDesc").value.trim();
  const fileInput = document.getElementById("noteFileInput");

  if (!fileInput.files || fileInput.files.length === 0) {
    showToast("Please select a file to attach.");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  // Convert uploaded file into clean data URI so students can download it without a backend server
  reader.onload = function(event) {
    const newNote = {
      id: Date.now().toString(),
      title: title,
      subject: subject,
      description: description,
      fileName: file.name,
      fileUrl: event.target.result,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    notes.unshift(newNote);
    saveData();
    renderAdminView();
    e.target.reset();
    showToast("Note published successfully!");
  };

  reader.readAsDataURL(file);
}

// Delete note
function handleDeleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  saveData();
  renderAdminView();
  showToast("Note removed.");
}

// ----------------- TOAST MESSAGE ----------------- //
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

// Initial Boot
renderStudentView();
