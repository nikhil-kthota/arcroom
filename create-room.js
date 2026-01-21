// Check authentication
let currentUser = null;

// Initialize Supabase
// Initialize Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check authentication on load
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }

  currentUser = {
    id: session.user.id,
    email: session.user.email
  };

  // Update the user email in the profile dropdown
  updateUserEmail();
});

// Update user email in profile dropdown
function updateUserEmail() {
  const userEmailElement = document.getElementById('userEmail');
  if (userEmailElement && currentUser) {
    userEmailElement.textContent = currentUser.email;
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

// Error display functions that show within the form container
function showError(message, containerId = 'createRoomForm') {
  // Remove any existing error messages first
  clearMessages(containerId);

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <span class="error-text">${message}</span>
      <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  const container = document.getElementById(containerId);
  if (container) {
    // Insert error at the top of the form
    container.insertBefore(errorDiv, container.firstChild);
  } else {
    // Fallback to body if container not found
    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds for body-level errors
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }
}

function showSuccess(message, containerId = 'createRoomForm') {
  // Remove any existing messages first
  clearMessages(containerId);

  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.innerHTML = `
    <div class="success-content">
      <span class="success-icon">✅</span>
      <span class="success-text">${message}</span>
      <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  const container = document.getElementById(containerId);
  if (container) {
    // Insert success message at the top of the form
    container.insertBefore(successDiv, container.firstChild);
  } else {
    // Fallback to body if container not found
    document.body.appendChild(successDiv);

    // Auto-remove after 3 seconds for body-level messages
    setTimeout(() => {
      if (successDiv.parentElement) {
        successDiv.remove();
      }
    }, 3000);
  }
}

// Helper function to clear existing messages
function clearMessages(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    const existingMessages = container.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(msg => msg.remove());
  }
}

// File upload handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const dataDisclaimer = document.getElementById('dataDisclaimer');
let selectedFiles = [];

// Drag and drop handling
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files);
  handleFiles(files);
});

uploadArea.addEventListener('click', () => {
  fileInput.click();
});

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  handleFiles(files);
}

function handleFiles(files) {
  // Validate files
  const validFiles = [];
  const errors = [];

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      errors.push(`File ${file.name} is too large. Maximum size is 10MB.`);
      continue;
    }

    if (selectedFiles.length + validFiles.length >= 10) {
      errors.push(`Maximum 10 files allowed per room`);
      break;
    }

    validFiles.push(file);
  }

  if (errors.length > 0) {
    showError(errors.join(', '));
  }

  if (validFiles.length === 0) {
    return;
  }

  selectedFiles = [...selectedFiles, ...validFiles];
  updateFileList();

  // Show disclaimer if files are selected
  if (selectedFiles.length > 0) {
    dataDisclaimer.style.display = 'block';
  }
}

function updateFileList() {
  if (selectedFiles.length === 0) {
    fileList.innerHTML = '';
    dataDisclaimer.style.display = 'none';
    return;
  }

  fileList.innerHTML = `
    <h3>Selected Files (${selectedFiles.length})</h3>
    <ul>
      ${selectedFiles.map((file, index) => `
        <li>
          <div class="file-icon ${getFileIconClass(file.type)}"></div>
          <div class="file-info">
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
          </div>
          <button 
            type="button" 
            class="btn btn-ghost btn-icon"
            onclick="removeFile(${index})"
          >
            <span class="icon-trash"></span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFileList();
}

// Room creation with enhanced error handling
async function handleCreateRoom(e) {
  e.preventDefault();

  const roomName = document.getElementById('roomName').value.trim();
  const roomId = document.getElementById('roomId').value.trim().toLowerCase();
  const roomPin = document.getElementById('roomPin').value.trim();
  const dataAgreement = document.getElementById('dataAgreement').checked;

  // Clear any existing messages
  clearMessages('createRoomForm');

  try {
    // Validate inputs
    if (!roomName) {
      showError('Room name is required');
      return;
    }

    if (!roomId) {
      showError('Room ID is required');
      return;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(roomId)) {
      showError('Room ID can only contain letters, numbers, and hyphens');
      return;
    }

    if (!/^\d{4}$/.test(roomPin)) {
      showError('PIN must be exactly 4 digits');
      return;
    }

    // Check data agreement if files are selected
    if (selectedFiles.length > 0 && !dataAgreement) {
      showError('Please agree to the data storage terms before uploading files');
      return;
    }

    // Check if room key already exists
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('key', roomId)
      .single();

    if (existingRoom) {
      showError('Room ID already exists. Please choose a different one.');
      return;
    }

    // Create room
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        key: roomId,
        name: roomName,
        created_by: currentUser.id,
        pin: roomPin
      })
      .select()
      .single();

    if (error) {
      // Handle specific database errors
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.message.includes('rooms_key_key')) {
          showError('Room ID already exists. Please choose a different one.');
        } else {
          showError('A room with these details already exists. Please try different values.');
        }
      } else {
        showError(`Failed to create room: ${error.message}`);
      }
      return;
    }

    // Upload files if any
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        try {
          // Generate unique file name
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${roomId}/${fileName}`;

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
          const { error: fileError } = await supabase
            .from('files')
            .insert({
              room_id: room.id,
              name: file.name,
              type: file.type,
              size: file.size,
              url: publicUrl
            });

          if (fileError) {
            // Clean up uploaded file if database insert fails
            await supabase.storage.from('room-files').remove([filePath]);
            showError(`Failed to save file metadata: ${fileError.message}`);
            continue;
          }
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          showError(`Failed to upload ${file.name}: ${error.message}`);
        }
      }
    }

    // Store PIN in session storage
    sessionStorage.setItem(`room_pin_${room.key}`, roomPin);

    // Show success message
    showSuccess('Room created successfully! Redirecting...');

    // Redirect to room after a short delay
    setTimeout(() => {
      window.location.href = `room.html?id=${room.key}`;
    }, 1500);
  } catch (err) {
    console.error('Create room error:', err);
    showError(err.message || 'Failed to create room');
  }
}

// Utility functions
function getFileIconClass(type) {
  type = type.toLowerCase();
  if (type.includes('image')) return 'icon-image';
  if (type.includes('pdf')) return 'icon-pdf';
  if (type.includes('word')) return 'icon-document';
  if (type.includes('spreadsheet') || type.includes('excel')) return 'icon-spreadsheet';
  if (type.includes('presentation') || type.includes('powerpoint')) return 'icon-presentation';
  return 'icon-file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Add logout functionality
async function handleLogout() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

// Expose functions to window for HTML access
window.handleCreateRoom = handleCreateRoom;
window.handleFileSelect = handleFileSelect;
window.handleLogout = handleLogout;
window.removeFile = removeFile;
window.toggleProfileDropdown = toggleProfileDropdown;
window.showProfileDropdownOnHover = showProfileDropdownOnHover;
window.hideProfileDropdownOnHover = hideProfileDropdownOnHover;