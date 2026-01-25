// Get room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomKey = urlParams.get('id');
let currentRoom = null;
let currentUser = null;
let fileToDelete = null; // Store file info for deletion
let selectedFiles = new Set(); // Track selected files

// Initialize Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check if we have access
let savedPin = sessionStorage.getItem(`room_pin_${roomKey}`);

if (!roomKey) {
  window.location.href = '/';
}

// Error display functions
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <span class="error-text">${message}</span>
      <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  document.body.appendChild(errorDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentElement) {
      errorDiv.remove();
    }
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.innerHTML = `
    <div class="success-content">
      <span class="success-icon">✅</span>
      <span class="success-text">${message}</span>
      <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  document.body.appendChild(successDiv);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (successDiv.parentElement) {
      successDiv.remove();
    }
  }, 3000);
}

// Check authentication and load room
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = {
      id: session.user.id,
      email: session.user.email
    };
  }

  updateAuthUI();

  if (savedPin) {
    await loadRoom();
  } else {
    // Show PIN Auth Modal
    const modal = document.getElementById('pinAuthModal');
    if (modal) {
      modal.classList.add('active');
      document.getElementById('roomPinAuth').focus();
    }
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      currentUser = {
        id: session.user.id,
        email: session.user.email
      };
    } else {
      currentUser = null;
    }
    updateAuthUI();
    updateUploadButtonVisibility();
  });
});

// Update auth UI based on user state
function updateAuthUI() {
  const authButtons = document.getElementById('authButtons');

  if (currentUser) {
    authButtons.innerHTML = `
      <div class="profile-icon-btn" onclick="toggleProfileDropdown()" onmouseenter="showProfileDropdownOnHover()" onmouseleave="hideProfileDropdownOnHover()">
        <span class="icon-user"></span>
        <div class="profile-dropdown" id="profileDropdown">
          <div class="profile-dropdown-header">
            <div class="profile-dropdown-email">${currentUser.email}</div>
            <div class="profile-dropdown-label">Signed in as</div>
          </div>
          <div class="profile-dropdown-actions">
            <button class="btn btn-ghost" onclick="window.location.href='profile.html'">
              <span class="icon-eye"></span>
              View Profile
            </button>
            <button class="btn btn-ghost" onclick="handleLogout()">
              <span class="icon-logout"></span>
              Logout
            </button>
          </div>
        </div>
      </div>
    `;
  } else {
    authButtons.innerHTML = `
      <button class="btn btn-ghost" onclick="showLoginModal()">Login</button>
    `;
  }
}

// Profile dropdown functions
function toggleProfileDropdown() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

function showProfileDropdownOnHover() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) {
    dropdown.classList.add('show');
  }
}

function hideProfileDropdownOnHover() {
  setTimeout(() => {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown && !dropdown.matches(':hover')) {
      dropdown.classList.remove('show');
    }
  }, 100);
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const profileBtn = e.target.closest('.profile-icon-btn');
  const dropdown = document.getElementById('profileDropdown');

  if (!profileBtn && dropdown) {
    dropdown.classList.remove('show');
  }
});

// Update upload button visibility based on user and room ownership
function updateUploadButtonVisibility() {
  const uploadButton = document.getElementById('uploadButton');
  const isOwner = currentRoom && currentUser && currentRoom.created_by === currentUser.id;

  if (isOwner) {
    uploadButton.style.display = 'flex';
  } else {
    uploadButton.style.display = 'none';
  }
}

// Modal Management
function showLoginModal() {
  const modal = document.getElementById('loginModal');
  modal.classList.add('active');
  document.getElementById('loginEmail').focus();

  // Clear any previous errors
  const existingErrors = modal.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());
}

function showRegisterModal() {
  const modal = document.getElementById('registerModal');
  modal.classList.add('active');
  document.getElementById('registerEmail').focus();

  // Clear any previous errors
  const existingErrors = modal.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());
}

function hideModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
    // Clear errors when closing modals
    const errors = modal.querySelectorAll('.error-message, .success-message');
    errors.forEach(error => error.remove());
  });
}

// Delete Modal Management
function showDeleteModal(fileId, fileName) {
  fileToDelete = { id: fileId, name: fileName };

  const modal = document.getElementById('deleteModal');
  const fileNameElement = document.getElementById('deleteFileName');

  fileNameElement.textContent = fileName;
  modal.classList.add('active');
}

function hideDeleteModal() {
  const modal = document.getElementById('deleteModal');
  modal.classList.remove('active');
  fileToDelete = null;
}

function confirmDeleteFile() {
  if (fileToDelete) {
    deleteFile(fileToDelete.id);
    hideDeleteModal();
  }
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    hideModals();
  }
});

// Authentication functions
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const modal = document.getElementById('loginModal');

  // Clear previous errors
  const existingErrors = modal.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());

  // Validation
  if (!email) {
    showError('Email is required');
    return;
  }

  if (!password) {
    showError('Password is required');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters long');
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address');
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      // Handle specific Supabase auth errors
      let errorMessage = 'Login failed';

      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and confirm your account before logging in.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many login attempts. Please wait a moment and try again.';
      } else {
        errorMessage = error.message;
      }

      showError(errorMessage);
      return;
    }

    if (!data.user) {
      showError('Login failed. Please try again.');
      return;
    }

    currentUser = {
      id: data.user.id,
      email: data.user.email
    };
    updateAuthUI();
    updateUploadButtonVisibility();
    hideModals();

    // Clear form
    e.target.reset();

    // Show success message
    showSuccess('Login successful!');

    // Refresh the UI to show delete buttons if user is room owner
    updateUI();
  } catch (err) {
    console.error('Login error:', err);
    showError('An unexpected error occurred. Please try again.');
  }
}

async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const modal = document.getElementById('registerModal');

  // Clear previous errors
  const existingErrors = modal.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());

  // Validation
  if (!email) {
    showError('Email is required');
    return;
  }

  if (!password) {
    showError('Password is required');
    return;
  }

  if (!confirmPassword) {
    showError('Please confirm your password');
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters long');
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  // Password strength validation
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    showError('Password should contain at least one uppercase letter, one lowercase letter, and one number');
    return;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password
    });

    if (error) {
      // Handle specific Supabase auth errors
      let errorMessage = 'Registration failed';

      if (error.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please try logging in instead.';
      } else if (error.message.includes('Password should be at least 6 characters')) {
        errorMessage = 'Password must be at least 6 characters long';
      } else if (error.message.includes('Unable to validate email address')) {
        errorMessage = 'Please enter a valid email address';
      } else {
        errorMessage = error.message;
      }

      showError(errorMessage);
      return;
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      showSuccess('Please check your email to confirm your account before logging in.');
      setTimeout(() => {
        hideModals();
        e.target.reset();
      }, 2000);
      return;
    }

    if (!data.user) {
      showError('Registration failed. Please try again.');
      return;
    }

    currentUser = {
      id: data.user.id,
      email: data.user.email
    };
    updateAuthUI();
    updateUploadButtonVisibility();
    hideModals();

    // Clear form
    e.target.reset();

    // Show success message
    showSuccess('Registration successful! Welcome to ArcRoom!');

    // Refresh the UI to show delete buttons if user is room owner
    updateUI();
  } catch (err) {
    console.error('Registration error:', err);
    showError('An unexpected error occurred. Please try again.');
  }
}

// Robust logout function
async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Supabase signOut error:', error);
    }
  } catch (err) {
    console.warn('Logout exception:', err);
  } finally {
    currentUser = null;
    updateAuthUI();
    updateUploadButtonVisibility();
    showSuccess('Logging out...');

    // Refresh the UI to hide delete buttons
    updateUI();

    // Optional: Redirect to home or just stay on room page as guest
    // User requested "go back to home page" on logout generally, 
    // but typically logging out while in a room might just degrade rights.
    // However, for consistency with the request "go back to home page",
    // let's redirect.
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 500);
  }
}

// Load room data
async function loadRoom() {
  try {
    // Get room with files only (no folders since they don't exist in schema)
    const { data: room, error } = await supabase
      .from('rooms')
      .select(`
        *,
        files (*)
      `)
      .eq('key', roomKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        showError('Room not found');
        setTimeout(() => window.location.href = '/', 2000);
        return;
      }
      throw new Error(error.message);
    }

    if (!room) {
      showError('Room not found');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }

    // Verify PIN
    if (room.pin !== savedPin) {
      sessionStorage.removeItem(`room_pin_${roomKey}`);
      showError('Invalid PIN. Redirecting...');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }

    currentRoom = {
      ...room,
      files: room.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.url,
        uploadedAt: new Date(file.uploaded_at)
      }))
    };

    updateUI();
    updateUploadButtonVisibility();
  } catch (err) {
    console.error('Load room error:', err);
    showError('Failed to load room: ' + err.message);
    setTimeout(() => window.location.href = '/', 3000);
  }
}

// Dynamic room name sizing function
function getDynamicTitleStyle(name) {
  const length = name.length;
  const screenWidth = window.innerWidth;

  let fontSize;

  // Base font size calculation based on character length
  if (length <= 15) {
    fontSize = screenWidth >= 768 ? '1.75rem' : '1.25rem'; // Large
  } else if (length <= 25) {
    fontSize = screenWidth >= 768 ? '1.5rem' : '1.125rem'; // Medium
  } else if (length <= 35) {
    fontSize = screenWidth >= 768 ? '1.25rem' : '1rem'; // Small
  } else {
    fontSize = screenWidth >= 768 ? '1rem' : '0.875rem'; // Extra small
  }

  return {
    fontSize: fontSize,
    lineHeight: '1.2',
    maxWidth: screenWidth >= 768 ? '400px' : '200px'
  };
}

// Update UI with room data
function updateUI() {
  // Update room name with dynamic sizing
  const roomNameElement = document.getElementById('roomName');
  if (roomNameElement && currentRoom) {
    roomNameElement.textContent = currentRoom.name;
    const titleStyle = getDynamicTitleStyle(currentRoom.name);
    Object.assign(roomNameElement.style, titleStyle);
  }

  // Update files list
  const filesList = document.getElementById('filesList');

  if (currentRoom.files.length === 0) {
    filesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>No files yet</h3>
        <p>Upload files to get started</p>
      </div>
    `;
    return;
  }

  // Check if current user is the room creator
  const isOwner = currentUser && currentRoom.created_by === currentUser.id;

  let html = '';

  // Show selection actions if items are selected
  const totalSelected = selectedFiles.size;
  if (totalSelected > 0 && isOwner) {
    html += `
      <div class="selection-actions">
        <div class="selection-info">
          ${totalSelected} file${totalSelected > 1 ? 's' : ''} selected
        </div>
        <div class="selection-buttons">
          <button class="btn btn-danger btn-sm" onclick="deleteSelectedItems()">
            <span class="icon-trash"></span>
            Delete
          </button>
          <button class="btn btn-ghost btn-sm" onclick="clearSelection()">
            Clear Selection
          </button>
        </div>
      </div>
    `;
  }

  // Render files
  currentRoom.files.forEach(file => {
    const isSelected = selectedFiles.has(file.id);
    html += `
      <div class="file-item ${isSelected ? 'selected' : ''}" onclick="viewFile('${file.id}')">
        ${isOwner ? `
          <div class="file-checkbox ${isSelected ? 'checked' : ''}" onclick="event.stopPropagation(); toggleFileSelection('${file.id}')">
            ${isSelected ? '<span class="icon-check"></span>' : ''}
          </div>
        ` : ''}
        <div class="file-icon ${getFileIconClass(file.type)}"></div>
        <div class="file-info">
          <h3 title="${file.name}">${truncateFileName(file.name, 25)}</h3>
          <p>${formatFileSize(file.size)}</p>
        </div>
        <div class="file-actions">
          <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation(); openInNewTab('${file.url}')" title="Open in new tab">
            <span class="icon-external"></span>
          </button>
          <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation(); downloadFile('${file.url}', '${file.name}')" title="Download">
            <span class="icon-download"></span>
          </button>
          ${isOwner ? `
            <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation(); showDeleteModal('${file.id}', '${file.name}')" title="Delete">
              <span class="icon-trash"></span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });

  filesList.innerHTML = html;
}

// Selection functions
function toggleFileSelection(fileId) {
  if (selectedFiles.has(fileId)) {
    selectedFiles.delete(fileId);
  } else {
    selectedFiles.add(fileId);
  }
  updateUI();
}

function clearSelection() {
  selectedFiles.clear();
  updateUI();
}

function deleteSelectedItems() {
  const totalSelected = selectedFiles.size;
  if (totalSelected === 0) return;

  const confirmMessage = `Are you sure you want to delete ${totalSelected} selected file${totalSelected > 1 ? 's' : ''}?`;
  if (confirm(confirmMessage)) {
    // Delete selected files
    selectedFiles.forEach(fileId => {
      deleteFile(fileId);
    });

    clearSelection();
  }
}

// File viewer with simplified PDF handling
function viewFile(fileId) {
  const file = currentRoom.files.find(f => f.id === fileId);
  if (!file) return;

  const viewer = document.getElementById('fileViewer');
  const type = file.type.toLowerCase();

  let content = '';

  if (type.includes('image')) {
    content = `
      <div class="file-preview">
        <div class="preview-header">
          <h3>${file.name}</h3>
          <div class="preview-actions">
            <button class="btn btn-ghost" onclick="openInNewTab('${file.url}')">
              <span class="icon-external"></span> Open
            </button>
            <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')">
              <span class="icon-download"></span> Download
            </button>
          </div>
        </div>
        <div class="preview-content">
          <img src="${file.url}" alt="${file.name}" style="max-width: 100%; max-height: 600px; object-fit: contain; display: block; margin: 0 auto;">
        </div>
      </div>
    `;
  }
  else if (type.includes('pdf')) {
    // Simplified PDF viewer - just show unavailable card
    content = `
      <div class="file-preview">
        <div class="preview-header">
          <h3>${file.name}</h3>
          <div class="preview-actions">
            <button class="btn btn-ghost" onclick="openInNewTab('${file.url}')">
              <span class="icon-external"></span> Open in New Tab
            </button>
            <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')">
              <span class="icon-download"></span> Download
            </button>
          </div>
        </div>
        <div class="preview-content">
          <div style="text-align: center; padding: 3rem; background: var(--primary-700); border-radius: 0.5rem; border: 1px solid var(--silver-800);">
            <div class="file-icon icon-pdf" style="width: 4rem; height: 4rem; margin: 0 auto 1.5rem; background-color: var(--silver-300);"></div>
            <h3 style="color: var(--silver-200); margin-bottom: 1rem;">PDF Preview Unavailable</h3>
            <p style="color: var(--silver-400); margin-bottom: 1rem;">PDF files cannot be previewed directly in the browser viewer.</p>
            <p style="color: var(--silver-500); margin-bottom: 2rem; font-size: 0.875rem;">
              Use the options above to open the PDF in a new tab or download it to your device for viewing.
            </p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-ghost" onclick="openInNewTab('${file.url}')" style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="icon-external"></span> Open in New Tab
              </button>
              <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')" style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="icon-download"></span> Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  else if (type.includes('text') || type.includes('plain')) {
    content = `
      <div class="file-preview">
        <div class="preview-header">
          <h3>${file.name}</h3>
          <div class="preview-actions">
            <button class="btn btn-ghost" onclick="openInNewTab('${file.url}')">
              <span class="icon-external"></span> Open
            </button>
            <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')">
              <span class="icon-download"></span> Download
            </button>
          </div>
        </div>
        <div class="preview-content">
          <div style="padding: 1rem;">
            <p style="text-align: center; color: var(--silver-500); margin-bottom: 1rem;">Text file preview - download to view full content</p>
            <div style="background: var(--primary-700); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--silver-800);">
              <p style="color: var(--silver-300); font-family: monospace;">Loading preview...</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  else if (
    type.includes('word') ||
    type.includes('spreadsheet') ||
    type.includes('presentation') ||
    type.includes('excel') ||
    type.includes('powerpoint') ||
    type.includes('docx') ||
    type.includes('xlsx') ||
    type.includes('pptx')
  ) {
    content = `
      <div class="file-preview">
        <div class="preview-header">
          <h3>${file.name}</h3>
          <div class="preview-actions">
            <button class="btn btn-ghost" onclick="openInNewTab('${file.url}')">
              <span class="icon-external"></span> Open
            </button>
            <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')">
              <span class="icon-download"></span> Download
            </button>
          </div>
        </div>
        <div class="preview-content">
          <div style="text-align: center; padding: 2rem;">
            <div class="file-icon ${getFileIconClass(file.type)}" style="width: 4rem; height: 4rem; margin: 0 auto 1rem; background-color: var(--silver-300);"></div>
            <h3 style="color: var(--silver-200); margin-bottom: 1rem;">${file.name}</h3>
            <p style="color: var(--silver-400); margin-bottom: 1.5rem;">Office document preview is not available in the browser.</p>
            <p style="color: var(--silver-500); margin-bottom: 1.5rem; font-size: 0.875rem;">Download the file to view it in the appropriate application.</p>
            <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')">
              <span class="icon-download"></span> Download File
            </button>
          </div>
        </div>
      </div>
    `;
  }
  else {
    content = `
      <div class="file-preview">
        <div class="preview-header">
          <h3>${file.name}</h3>
          <div class="preview-actions">
            <button class="btn btn-ghost" onclick="openInNewTab('${file.url}')">
              <span class="icon-external"></span> Open
            </button>
            <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')">
              <span class="icon-download"></span> Download
            </button>
          </div>
        </div>
        <div class="preview-content">
          <div style="text-align: center; padding: 2rem;">
            <div class="file-icon ${getFileIconClass(file.type)}" style="width: 4rem; height: 4rem; margin: 0 auto 1rem; background-color: var(--silver-300);"></div>
            <h3 style="color: var(--silver-200); margin-bottom: 1rem;">Preview not available</h3>
            <p style="color: var(--silver-400); margin-bottom: 1.5rem;">This file type cannot be previewed in the browser.</p>
            <p style="color: var(--silver-500); margin-bottom: 1.5rem; font-size: 0.875rem;">File type: ${file.type}</p>
            <button class="btn btn-primary" onclick="downloadFile('${file.url}', '${file.name}')">
              <span class="icon-download"></span> Download File
            </button>
          </div>
        </div>
      </div>
    `;
  }

  viewer.innerHTML = content;
}

function openInNewTab(url) {
  window.open(url, '_blank');
  showSuccess('File opened in new tab');
}

// File upload with better error handling
async function handleFileUpload(event) {
  const files = event.target.files;
  if (!files.length) return;

  if (!currentUser) {
    showLoginModal();
    showError('You must be logged in to upload files');
    return;
  }

  if (currentRoom.created_by !== currentUser.id) {
    showError('Only the room creator can upload files');
    return;
  }

  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const maxFiles = 10;

  // Validate files
  const validFiles = [];
  const errors = [];

  for (const file of files) {
    if (file.size > maxFileSize) {
      errors.push(`${file.name} is too large (max 10MB)`);
      continue;
    }

    if (currentRoom.files.length + validFiles.length >= maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed per room`);
      break;
    }

    validFiles.push(file);
  }

  if (errors.length > 0) {
    showError(errors.join(', '));
  }

  if (validFiles.length === 0) {
    event.target.value = '';
    return;
  }

  try {
    let uploadedCount = 0;

    for (const file of validFiles) {
      try {
        // Generate unique file name
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${roomKey}/${fileName}`;

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('room-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          showError(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('room-files')
          .getPublicUrl(filePath);

        // Insert file metadata into database
        const { data: fileData, error: fileError } = await supabase
          .from('files')
          .insert({
            room_id: currentRoom.id,
            name: file.name,
            type: file.type,
            size: file.size,
            url: publicUrl
          })
          .select()
          .single();

        if (fileError) {
          // Clean up uploaded file if database insert fails
          await supabase.storage.from('room-files').remove([filePath]);
          showError(`Failed to save ${file.name}: ${fileError.message}`);
          continue;
        }

        // Add to current room files
        currentRoom.files.push({
          id: fileData.id,
          name: fileData.name,
          type: fileData.type,
          size: fileData.size,
          url: fileData.url,
          uploadedAt: new Date(fileData.uploaded_at)
        });

        uploadedCount++;
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        showError(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    if (uploadedCount > 0) {
      updateUI();
      showSuccess(`Successfully uploaded ${uploadedCount} file${uploadedCount > 1 ? 's' : ''}!`);
    }
  } catch (err) {
    console.error('Upload error:', err);
    showError('Upload failed: ' + err.message);
  }

  // Reset input
  event.target.value = '';
}

// File deletion with better error handling
async function deleteFile(fileId) {
  if (!currentUser || currentRoom.created_by !== currentUser.id) {
    showError('Only the room creator can delete files');
    return;
  }

  try {
    // Get file info first
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('url, name')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      showError('File not found');
      return;
    }

    // Extract file path from URL
    const url = new URL(file.url);
    const filePath = url.pathname.split('/').slice(-2).join('/'); // Get last two parts (roomKey/filename)

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('room-files')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      showError(`Failed to delete file: ${dbError.message}`);
      return;
    }

    currentRoom.files = currentRoom.files.filter(f => f.id !== fileId);
    updateUI();

    showSuccess(`${file.name} deleted successfully`);

    // Clear viewer if deleted file was being viewed
    const viewer = document.getElementById('fileViewer');
    viewer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>Select a file to view</h3>
        <p>Choose a file from the list to preview it here</p>
      </div>
    `;
  } catch (err) {
    console.error('Delete error:', err);
    showError('Failed to delete file: ' + err.message);
  }
}

// Share functionality with dynamic room ID and PIN
// Share functionality with dynamic room ID and PIN
function handleShare() {
  try {
    const modal = document.getElementById('shareModal');
    const shareRoomKey = document.getElementById('shareRoomKey');
    const shareRoomPin = document.getElementById('shareRoomPin');
    const shareRoomLink = document.getElementById('shareRoomLink');

    if (!modal || !shareRoomKey || !shareRoomPin) {
      console.error('Share modal elements not found');
      return;
    }

    // Set dynamic room information
    if (currentRoom) {
      shareRoomKey.textContent = currentRoom.key;
      // Use savedPin from session or fallback
      shareRoomPin.textContent = savedPin || '****';

      if (shareRoomLink) {
        shareRoomLink.value = window.location.href;
      }
    }

    modal.classList.add('active');
  } catch (err) {
    console.error('Error in handleShare:', err);
    showError('Failed to open share modal');
  }
}

function copyShareLink() {
  const linkInput = document.getElementById('shareRoomLink');
  if (linkInput) {
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(linkInput.value).then(() => {
      showSuccess('Link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      showError('Failed to copy link');
    });
  }
}

// Utility functions
function getFileIconClass(type) {
  type = type.toLowerCase();
  if (type.includes('image')) return 'icon-image';
  if (type.includes('pdf')) return 'icon-pdf';
  if (type.includes('word') || type.includes('docx')) return 'icon-document';
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xlsx')) return 'icon-spreadsheet';
  if (type.includes('presentation') || type.includes('powerpoint') || type.includes('pptx')) return 'icon-presentation';
  return 'icon-file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
// Truncate file name helper
function truncateFileName(name, maxLength = 20) {
  if (name.length <= maxLength) return name;

  const lastDotIndex = name.lastIndexOf('.');
  // If no extension or extension is the whole name (hidden file), just truncate
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return name.substring(0, maxLength) + '...';
  }

  const extension = name.substring(lastDotIndex);
  const nameWithoutExt = name.substring(0, lastDotIndex);

  // Calculate how much space we have for the name part
  // We need to reserve space for "..." (3 chars) and the extension
  const availableLength = maxLength - 3 - extension.length;

  if (availableLength <= 0) {
    // If extension plus ellipsis is longer than maxLength, just show start...ext
    return name.substring(0, Math.max(1, maxLength - 3 - extension.length)) + '...' + extension;
  }

  return nameWithoutExt.substring(0, availableLength) + '...' + extension;
}

// Enhanced download function that actually downloads to device
async function downloadFile(url, filename) {
  try {
    showSuccess('Starting download...');

    // Fetch the file as a blob
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch file');
    }

    const blob = await response.blob();

    // Create a temporary URL for the blob
    const blobUrl = window.URL.createObjectURL(blob);

    // Create a temporary anchor element and trigger download
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up the blob URL
    window.URL.revokeObjectURL(blobUrl);

    showSuccess(`Downloaded: ${filename}`);
  } catch (error) {
    console.error('Download failed:', error);
    showError('Download failed. Opening in new tab instead...');
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

// Add window resize listener to update title sizing
window.addEventListener('resize', () => {
  if (currentRoom) {
    const roomNameElement = document.getElementById('roomName');
    if (roomNameElement) {
      const titleStyle = getDynamicTitleStyle(currentRoom.name);
      Object.assign(roomNameElement.style, titleStyle);
    }
  }
});


// PIN Authentication Handler
async function handlePinAuth(e) {
  e.preventDefault();
  const inputPin = document.getElementById('roomPinAuth').value;

  try {
    const { data: room, error } = await supabase
      .from('rooms')
      .select('pin')
      .eq('key', roomKey)
      .single();

    if (error || !room) {
      showError('Room not found');
      return;
    }

    if (room.pin === inputPin) {
      savedPin = inputPin;
      sessionStorage.setItem(`room_pin_${roomKey}`, inputPin);

      // Hide modal
      const modal = document.getElementById('pinAuthModal');
      if (modal) modal.classList.remove('active');

      showSuccess('Access granted!');
      loadRoom();
    } else {
      showError('Incorrect PIN');
    }

  } catch (err) {
    console.error(err);
    showError('Authentication failed');
  }
}

// Expose functions to window for HTML access
window.handlePinAuth = handlePinAuth;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.toggleProfileDropdown = toggleProfileDropdown;
window.showProfileDropdownOnHover = showProfileDropdownOnHover;
window.hideProfileDropdownOnHover = hideProfileDropdownOnHover;
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.deleteSelectedItems = deleteSelectedItems;
window.clearSelection = clearSelection;
window.viewFile = viewFile;
window.toggleFileSelection = toggleFileSelection;
window.openInNewTab = openInNewTab;
window.downloadFile = downloadFile;
window.showDeleteModal = showDeleteModal;
window.hideDeleteModal = hideDeleteModal;
window.confirmDeleteFile = confirmDeleteFile;
window.handleShare = handleShare;
window.hideModals = hideModals;
window.handleFileUpload = handleFileUpload;
window.copyShareLink = copyShareLink;