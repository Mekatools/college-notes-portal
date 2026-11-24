// --- STATE ---
let subjects = ["All"];
let notes = [];

// Session State (Zero secrets in browser — protected on Cloudflare server)
let currentTeacher = localStorage.getItem("currentTeacher") || null;
let teacherSecretKey = localStorage.getItem("teacherSecretKey") || null;
let selectedSubject = "All";

// Attachment Mode State
let currentAttachMethod = 'upload'; // 'upload' or 'link'
let selectedFileObject = null;

// Active item being edited/deleted
let targetSubjectForEdit = "";
let targetDeleteAction = null;

// --- FETCH DATA FROM CLOUDFLARE D1 ---
async function fetchGlobalData() {
  try {
    // 1. Fetch Subjects
    const subRes = await fetch('/api/subjects');
    const subData = await subRes.json();
    
    // Seed ONLY ONE single clean testing subject if completely empty
    if (!subData || subData.length === 0) {
      if (teacherSecretKey) {
        await fetch('/api/subjects', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Teacher-Key': teacherSecretKey
          },
          body: JSON.stringify({ name: "Demo Subject" })
        });
      }
      subjects = ["All", "Demo Subject"];
    } else {
      subjects = ["All", ...subData.map(s => s.name)];
    }

    // 2. Fetch Notes
    const notesRes = await fetch('/api/notes');
    notes = await notesRes.json();

    if (!subjects.includes(selectedSubject)) {
      selectedSubject = "All";
    }

    renderStudentView();
    if (currentTeacher && teacherSecretKey) {
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
    if (!currentTeacher || !teacherSecretKey) {
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

// --- SECURE TEACHER LOGIN ---
function openTeacherLogin() {
  if (currentTeacher && teacherSecretKey) {
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

async function verifyTeacherAccess() {
  const name = document.getElementById("loginTeacherName").value.trim();
  const enteredPass = document.getElementById("loginTeacherPin").value.trim();

  if (!name || !enteredPass) {
    showToast("Please enter both Name and Password");
    return;
  }

  showToast("Verifying with Cloudflare security...");

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: enteredPass })
    });

    if (res.ok) {
      currentTeacher = name;
      teacherSecretKey = enteredPass;
      localStorage.setItem("currentTeacher", currentTeacher);
      localStorage.setItem("teacherSecretKey", teacherSecretKey);

      closeAuthModal();
      showToast(`Welcome, ${name}!`);
      switchView("teacher");
    } else {
      showToast("Access Denied: Incorrect Faculty Password!");
    }
  } catch (err) {
    showToast("Network error during login.");
  }
}

function logoutTeacher() {
  currentTeacher = null;
  teacherSecretKey = null;
  localStorage.removeItem("currentTeacher");
  localStorage.removeItem("teacherSecretKey");
  showToast("Logged out successfully.");
  switchView("student");
}

// --- STUDENT VIEW ---
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

  grid.innerHTML = filtered.map(note => {
    // Detect whether file is hosted directly on Cloudflare or linked to Drive
    const isDirectUpload = note.driveUrl && note.driveUrl.startsWith('/api/file');
    const sourceIcon = isDirectUpload ? 'ri-file-cloud-line' : 'ri-google-drive-fill';
    const sourceText = isDirectUpload ? 'Cloudflare Storage' : 'Google Drive';
    const iconColor = isDirectUpload ? '#38bdf8' : '#34d399';

    return `
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
            <i class="${sourceIcon}" style="color: ${iconColor};"></i> ${sourceText}
          </span>
          <a href="${note.driveUrl}" target="_blank" download class="btn-download">
            <i class="ri-download-2-line"></i> View / Download
          </a>
        </div>
      </div>
    `;
  }).join("");
}

// --- ATTACHMENT METHOD TOGGLE & AUTOMATIC SIZE GUARD ---
function setAttachMethod(method) {
  currentAttachMethod = method;
  const uploadBtn = document.getElementById("methodUploadBtn");
  const linkBtn = document.getElementById("methodLinkBtn");
  const uploadSection = document.getElementById("uploadInputSection");
  const linkSection = document.getElementById("linkInputSection");

  if (method === 'upload') {
    uploadBtn.classList.add("active");
    linkBtn.classList.remove("active");
    uploadSection.style.display = "block";
    linkSection.style.display = "none";
  } else {
    linkBtn.classList.add("active");
    uploadBtn.classList.remove("active");
    linkSection.style.display = "block";
    uploadSection.style.display = "none";
  }
}

// AUTOMATIC SIZE GUARD: Checks file size to ensure 0% blurry text and 0% phone crashes
function handleFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const MAX_LIMIT_MB = 25;
  const MAX_BYTES = MAX_LIMIT_MB * 1024 * 1024;

  if (file.size > MAX_BYTES) {
    const currentMB = (file.size / (1024 * 1024)).toFixed(1);
    showToast(`File is ${currentMB}MB (Max: 25MB). Switched to Link to keep crystal-clear quality!`);
    
    // Automatically switch to link tab to prevent blurry compression or memory crash
    setAttachMethod('link');
    document.getElementById('driveLinkInput').focus();
    selectedFileObject = null;
    document.getElementById('fileSelectedInfo').style.display = "none";
    return;
  }

  // File is within optimal size (<25MB)
  selectedFileObject = file;
  const infoBadge = document.getElementById("fileSelectedInfo");
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  infoBadge.innerHTML = `
    <span><i class="ri-file-check-line" style="color: var(--accent-emerald);"></i> <b>${file.name}</b> (${fileSizeMB} MB)</span>
    <button type="button" onclick="clearSelectedFile()" style="background:transparent; border:none; color:var(--danger); cursor:pointer;"><i class="ri-close-line"></i></button>
  `;
  infoBadge.style.display = "flex";
}

function clearSelectedFile() {
  selectedFileObject = null;
  document.getElementById("fileUploadInput").value = "";
  document.getElementById("fileSelectedInfo").style.display = "none";
}

// Drag & Drop event setup
function setupDragAndDrop() {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      document.getElementById("fileUploadInput").files = files;
      handleFileSelected({ target: { files: files } });
    }
  });
}

// --- TEACHER ACTIONS ---
function renderTeacherPanel() {
  const select = document.getElementById("noteCategorySelect");
  const actualSubjects = subjects.filter(s => s !== "All");
  select.innerHTML = actualSubjects.map(s => `<option value="${s}">${s}</option>`).join("");

  // Subjects Manager with In-Site Modals
  const subList = document.getElementById("adminSubjectsList");
  if (actualSubjects.length === 0) {
    subList.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-muted);">No subjects created yet.</p>`;
  } else {
    subList.innerHTML = actualSubjects.map(sub => `
      <div class="admin-note-item">
        <span><i class="ri-book-line" style="color: var(--accent-blue); margin-right: 5px;"></i>${sub}</span>
        <div class="action-btns">
          <button class="btn-edit" onclick="openEditModal('${sub}')" title="Rename Subject">
            <i class="ri-pencil-line"></i>
          </button>
          <button class="btn-del" onclick="triggerDeleteSubject('${sub}')" title="Delete Subject">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    `).join("");
  }

  // Published Notes List
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
      <button class="btn-del" onclick="triggerDeleteNote('${n.id}', '${n.title}')" title="Delete note">
        <i class="ri-delete-bin-line"></i>
      </button>
    </div>
  `).join("");

  setupDragAndDrop();
}

// Publish note (Handles direct upload or link)
async function handleCreateNote(e) {
  e.preventDefault();

  const title = document.getElementById("noteTitle").value.trim();
  const subject = document.getElementById("noteCategorySelect").value;
  const description = document.getElementById("noteDesc").value.trim();

  let finalFileUrl = "";

  if (currentAttachMethod === 'upload') {
    if (!selectedFileObject) {
      showToast("Please drop or choose a lecture file first!");
      return;
    }

    showToast("Uploading file to Cloudflare storage...");
    const formData = new FormData();
    formData.append("file", selectedFileObject);

    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'X-Teacher-Key': teacherSecretKey },
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.downloadUrl) {
        showToast("Upload failed: " + (uploadData.error || "File error"));
        return;
      }
      finalFileUrl = uploadData.downloadUrl;
    } catch (err) {
      showToast("Error uploading file to cloud.");
      return;
    }
  } else {
    const driveUrl = document.getElementById("driveLinkInput").value.trim();
    if (!driveUrl) {
      showToast("Please paste a cloud link!");
      return;
    }
    finalFileUrl = driveUrl;
  }

  const newNote = {
    id: Date.now().toString(),
    title: title,
    subject: subject,
    teacher: currentTeacher,
    description: description,
    driveUrl: finalFileUrl,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };

  showToast("Publishing note to students...");

  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Teacher-Key': teacherSecretKey
      },
      body: JSON.stringify(newNote)
    });

    if (res.ok) {
      showToast("Published globally to all students!");
      e.target.reset();
      clearSelectedFile();
      fetchGlobalData();
    } else {
      showToast("Access Denied: You must be logged in as a teacher.");
    }
  } catch (err) {
    showToast("Network error. Please try again.");
  }
}

// In-Site Subject Editing
function openEditModal(subName) {
  targetSubjectForEdit = subName;
  document.getElementById("editSubjectInput").value = subName;
  document.getElementById("editSubjectModal").classList.add("active");
  document.getElementById("editSubjectInput").focus();
}

function closeEditModal() {
  document.getElementById("editSubjectModal").classList.remove("active");
  targetSubjectForEdit = "";
}

async function confirmEditSubject() {
  const newName = document.getElementById("editSubjectInput").value.trim();
  if (!newName || newName === targetSubjectForEdit) {
    closeEditModal();
    return;
  }

  showToast("Updating subject...");
  try {
    const res = await fetch('/api/subjects', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'X-Teacher-Key': teacherSecretKey
      },
      body: JSON.stringify({ oldName: targetSubjectForEdit, newName: newName })
    });

    if (res.ok) {
      showToast(`Renamed to "${newName}"!`);
      closeEditModal();
      fetchGlobalData();
    } else {
      showToast("Access Denied: Unauthorized.");
    }
  } catch (err) {
    showToast("Failed to rename subject.");
  }
}

// In-Site Deletion
function closeDeleteModal() {
  document.getElementById("deleteConfirmModal").classList.remove("active");
  targetDeleteAction = null;
}

function triggerDeleteSubject(subName) {
  if (localStorage.getItem("skip_delete_confirm") === "true") {
    executeDeleteSubject(subName);
    return;
  }

  document.getElementById("deleteModalTitle").innerText = `Delete "${subName}"?`;
  document.getElementById("deleteModalDesc").innerText = "This will permanently delete this subject and all notes inside it.";
  
  targetDeleteAction = () => executeDeleteSubject(subName);
  document.getElementById("deleteConfirmModal").classList.add("active");
}

function triggerDeleteNote(id, title) {
  if (localStorage.getItem("skip_delete_confirm") === "true") {
    executeDeleteNote(id);
    return;
  }

  document.getElementById("deleteModalTitle").innerText = `Delete Note?`;
  document.getElementById("deleteModalDesc").innerText = `Remove "${title}" from the portal?`;

  targetDeleteAction = () => executeDeleteNote(id);
  document.getElementById("deleteConfirmModal").classList.add("active");
}

document.getElementById("confirmDeleteActionBtn").onclick = function() {
  if (document.getElementById("dontAskDeleteAgain").checked) {
    localStorage.setItem("skip_delete_confirm", "true");
  }
  if (targetDeleteAction) {
    targetDeleteAction();
  }
  closeDeleteModal();
};

async function executeDeleteSubject(name) {
  showToast("Deleting subject & its notes...");
  try {
    const res = await fetch(`/api/subjects?name=${encodeURIComponent(name)}`, { 
      method: 'DELETE',
      headers: { 'X-Teacher-Key': teacherSecretKey }
    });
    if (res.ok) {
      if (selectedSubject === name) {
        selectedSubject = "All";
      }
      showToast(`Subject "${name}" & its files removed.`);
      fetchGlobalData();
    } else {
      showToast("Access Denied: Unauthorized.");
    }
  } catch (err) {
    showToast("Failed to delete subject.");
  }
}

async function executeDeleteNote(id) {
  try {
    const res = await fetch(`/api/notes?id=${id}`, { 
      method: 'DELETE',
      headers: { 'X-Teacher-Key': teacherSecretKey }
    });
    if (res.ok) {
      showToast("Note deleted.");
      fetchGlobalData();
    } else {
      showToast("Access Denied: Unauthorized.");
    }
  } catch (err) {
    showToast("Failed to delete note.");
  }
}

// Add Subject
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
      headers: { 
        'Content-Type': 'application/json',
        'X-Teacher-Key': teacherSecretKey
      },
      body: JSON.stringify({ name: newSub })
    });

    if (res.ok) {
      input.value = "";
      showToast(`Subject "${newSub}" created!`);
      fetchGlobalData();
    } else {
      showToast("Access Denied: Unauthorized.");
    }
  } catch (err) {
    showToast("Failed to add subject.");
  }
}

// Privacy & Terms Modals
function openPrivacyModal() { document.getElementById("privacyModal").classList.add("active"); }
function closePrivacyModal() { document.getElementById("privacyModal").classList.remove("active"); }
function openTermsModal() { document.getElementById("termsModal").classList.add("active"); }
function closeTermsModal() { document.getElementById("termsModal").classList.remove("active"); }

// Toast Alert
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 3000);
}

// Boot up portal
fetchGlobalData();
