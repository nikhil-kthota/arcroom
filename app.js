// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// User state management
let currentUser = null;
let showProfileDropdown = false;

// Check for saved user on load
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already logged in
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = {
      id: session.user.id,
      email: session.user.email
    };
    updateUIForUser();
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
    updateUIForUser();
  });
});

// UI Updates
function updateUIForUser() {
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
      <button class="btn btn-primary" onclick="showRegisterModal()">Register</button>
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

// Error display functions
function showError(message, containerId = null) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <span class="error-text">${message}</span>
      <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  if (containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      // Remove existing errors
      const existingErrors = container.querySelectorAll('.error-message');
      existingErrors.forEach(error => error.remove());

      // Add new error at the top
      container.insertBefore(errorDiv, container.firstChild);
      return;
    }
  }

  // Default: add to body
  document.body.appendChild(errorDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentElement) {
      errorDiv.remove();
    }
  }, 5000);
}

function showSuccess(message, containerId = null) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.innerHTML = `
    <div class="success-content">
      <span class="success-icon">✅</span>
      <span class="success-text">${message}</span>
      <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  if (containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      // Remove existing messages
      const existingMessages = container.querySelectorAll('.success-message, .error-message');
      existingMessages.forEach(msg => msg.remove());

      // Add new message at the top
      container.insertBefore(successDiv, container.firstChild);
      return;
    }
  }

  // Default: add to body
  document.body.appendChild(successDiv);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (successDiv.parentElement) {
      successDiv.remove();
    }
  }, 3000);
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

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    hideModals();
  }
});

// Create Room
function handleCreateRoom() {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  window.location.href = 'create-room.html';
}

// Authentication
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
    showError('Email is required', 'loginModal');
    return;
  }

  if (!password) {
    showError('Password is required', 'loginModal');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters long', 'loginModal');
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address', 'loginModal');
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

      showError(errorMessage, 'loginModal');
      return;
    }

    if (!data.user) {
      showError('Login failed. Please try again.', 'loginModal');
      return;
    }

    currentUser = {
      id: data.user.id,
      email: data.user.email
    };
    updateUIForUser();
    hideModals();

    // Clear form
    e.target.reset();

    // Show success message
    showSuccess('Login successful!');
  } catch (err) {
    console.error('Login error:', err);
    showError('An unexpected error occurred. Please try again.', 'loginModal');
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
    showError('Email is required', 'registerModal');
    return;
  }

  if (!password) {
    showError('Password is required', 'registerModal');
    return;
  }

  if (!confirmPassword) {
    showError('Please confirm your password', 'registerModal');
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address', 'registerModal');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters long', 'registerModal');
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match', 'registerModal');
    return;
  }

  // Password strength validation
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    showError('Password should contain at least one uppercase letter, one lowercase letter, and one number', 'registerModal');
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

      showError(errorMessage, 'registerModal');
      return;
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      showSuccess('Please check your email to confirm your account before logging in.', 'registerModal');
      setTimeout(() => {
        hideModals();
        e.target.reset();
      }, 2000);
      return;
    }

    if (!data.user) {
      showError('Registration failed. Please try again.', 'registerModal');
      return;
    }

    currentUser = {
      id: data.user.id,
      email: data.user.email
    };
    updateUIForUser();
    hideModals();

    // Clear form
    e.target.reset();

    // Show success message
    showSuccess('Registration successful! Welcome to ArcRoom!');
  } catch (err) {
    console.error('Registration error:', err);
    showError('An unexpected error occurred. Please try again.', 'registerModal');
  }
}

async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    currentUser = null;
    updateUIForUser();

    showSuccess('Logged out successfully');

    // Redirect to home page after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (err) {
    console.error('Logout error:', err);
    showError('Failed to logout. Please try again.');
  }
}

// Room Management
async function handleJoinRoom(e) {
  e.preventDefault();

  const roomKey = document.getElementById('roomId').value.trim().toLowerCase();
  const pin = document.getElementById('roomPin').value.trim();
  const form = e.target;

  // Clear previous errors
  const existingErrors = form.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());

  // Validation
  if (!roomKey) {
    showError('Room key is required', 'joinRoomForm');
    return;
  }

  if (!pin) {
    showError('PIN is required', 'joinRoomForm');
    return;
  }

  // Validate room key format
  if (!/^[a-zA-Z0-9-]+$/.test(roomKey)) {
    showError('Room key can only contain letters, numbers, and hyphens', 'joinRoomForm');
    return;
  }

  // Validate PIN format (4 digits)
  if (!/^\d{4}$/.test(pin)) {
    showError('PIN must be exactly 4 digits', 'joinRoomForm');
    return;
  }

  try {
    // Check if room exists and verify PIN
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('key', roomKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        showError('Room not found. Please check the room key and try again.', 'joinRoomForm');
      } else {
        showError('Failed to connect to room. Please try again.', 'joinRoomForm');
      }
      return;
    }

    if (!room) {
      showError('Room not found. Please check the room key and try again.', 'joinRoomForm');
      return;
    }

    if (room.pin !== pin) {
      showError('Invalid PIN. Please check the PIN and try again.', 'joinRoomForm');
      return;
    }

    // Store PIN in session storage
    sessionStorage.setItem(`room_pin_${roomKey}`, pin);

    // Show success and redirect
    showSuccess('Joining room...');

    setTimeout(() => {
      window.location.href = `room.html?id=${roomKey}`;
    }, 500);

  } catch (err) {
    console.error('Join room error:', err);
    showError('An unexpected error occurred. Please try again.', 'joinRoomForm');
  }
}

// Helper function to add error container to forms
function addErrorContainer(formId) {
  const form = document.getElementById(formId);
  if (form && !form.querySelector('.error-container')) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-container';
    form.insertBefore(errorContainer, form.firstChild);
  }
}

// Initialize error containers when page loads
document.addEventListener('DOMContentLoaded', () => {
  addErrorContainer('joinRoomForm');
});

// Expose functions to window for HTML access
window.handleCreateRoom = handleCreateRoom;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.handleJoinRoom = handleJoinRoom;
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.toggleProfileDropdown = toggleProfileDropdown;
window.showProfileDropdownOnHover = showProfileDropdownOnHover;
window.hideProfileDropdownOnHover = hideProfileDropdownOnHover;