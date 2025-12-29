<?php
// Configure session for production
ini_set('session.use_cookies', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '0'); // Set to 1 for HTTPS only
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.gc_maxlifetime', 28800); // 8 hours
ini_set('session.cookie_lifetime', 28800); // 8 hours

require_once 'config/cors.php';
require_once 'config/database.php';

session_start();

$database = new Database();
$conn = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];

// Handle OPTIONS preflight requests
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Robust path derivation for all execution scenarios
$path = $_SERVER['AGILE_API_PATH'] ?? ($_SERVER['PATH_INFO'] ?? '');
if ($path === '' && isset($_SERVER['REDIRECT_URL'])) {
    if (preg_match('~/(auth|users|teams|projects)(/.*)?$~i', $_SERVER['REDIRECT_URL'], $m)) { 
        $path = $m[2] ?? '/'; 
    }
}
if ($path === '' && isset($_SERVER['REQUEST_URI'])) {
    $uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
    if (preg_match('~/(auth|users|teams|projects)(/.*)?$~i', $uriPath, $m)) { 
        $path = $m[2] ?? '/'; 
    }
}
$path = rtrim($path ?: '/', '/');
if ($path === '') $path = '/';

switch ($method . ':' . $path) {
    case 'POST:/login':
        login($conn);
        break;
    
    case 'POST:/logout':
        logout();
        break;
    
    case 'GET:/status':
        getAuthStatus();
        break;
    
    case 'GET:/user':
        getCurrentUser($conn);
        break;
    
    case 'POST:/forgot-password':
        forgotPassword($conn);
        break;
    
    case 'POST:/reset-password':
        resetPassword($conn);
        break;
    
    case 'POST:/refresh':
        refreshSession($conn);
        break;
    
    case 'POST:/change-password':
        changePassword($conn);
        break;
    
    default:
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint not found']);
        break;
}

function login($conn) {
    // SECURITY: Direct login disabled - must use OTP verification
    http_response_code(405); // Method Not Allowed
    echo json_encode([
        'success' => false,
        'error' => 'Direct login disabled for security',
        'message' => 'Please use OTP verification for secure authentication',
        'redirect_to' => '/login-otp/send-otp'
    ]);
    return;
        try {
            $roleColumn = 'user_role';
            // Only allow active users to log in
            $stmt = $conn->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            if ($user) {
                error_log('User from DB: ' . print_r($user, true));
            } else {
                error_log('User from DB: EMPTY');
            }
            if (!$user) {
                http_response_code(401);
                echo json_encode(['message' => 'User not found or inactive', 'email' => $email]);
                return;
            }
            $passwordMatch = password_verify($password, $user['password']);
            if (!$passwordMatch) {
                http_response_code(401);
                echo json_encode(['message' => 'Invalid credentials']);
                return;
            }
            
            // Check if email is verified (new security requirement)
            if (isset($user['email_verified']) && !$user['email_verified']) {
                http_response_code(403);
                echo json_encode([
                    'message' => 'Email verification required',
                    'error_code' => 'EMAIL_NOT_VERIFIED',
                    'email' => $email,
                    'require_verification' => true
                ]);
                return;
            }
            // Update last login
            $updateStmt = $conn->prepare("UPDATE users SET last_login = ? WHERE id = ?");
            $updateStmt->execute([date('Y-m-d H:i:s'), $user['id']]);
            // Set session
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_role'] = $user[$roleColumn];
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'fullName' => $user['full_name'],
                    'role' => $user[$roleColumn],
                    'avatarUrl' => $user['avatar_url']
                ]
            ]);
        } catch (PDOException $e) {
            error_log("Login error: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Internal server error']);
        }
}

function logout() {
    session_destroy();
    echo json_encode(['message' => 'Logged out successfully']);
}

function getAuthStatus() {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'authenticated' => true,
            'userRole' => $_SESSION['user_role']
        ]);
    } else {
        echo json_encode(['authenticated' => false]);
    }
}

function getCurrentUser($conn) {
    // Debug session information
    error_log('=== GET CURRENT USER DEBUG ===');
    error_log('Session ID: ' . session_id());
    error_log('Session status: ' . session_status());
    error_log('Session data: ' . print_r($_SESSION, true));
    error_log('Cookie data: ' . print_r($_COOKIE, true));
    
    if (!isset($_SESSION['user_id'])) {
        error_log('No user_id in session - returning 401');
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    if (!$conn) {
        error_log('Database connection failed');
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        $roleColumn = 'user_role'; // Consistent with login function
        
        $stmt = $conn->prepare("SELECT id, username, email, full_name, user_role, avatar_url FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        if (!$user) {
            error_log('User not found in database for ID: ' . $_SESSION['user_id']);
            http_response_code(404);
            echo json_encode(['message' => 'User not found']);
            return;
        }
        
        $userResponse = [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'fullName' => $user['full_name'],
            'role' => $user[$roleColumn],
            'avatarUrl' => $user['avatar_url']
        ];
        
        error_log('User data returned successfully: ' . json_encode($userResponse));
        echo json_encode($userResponse);
        
    } catch (PDOException $e) {
        error_log("Get user error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function forgotPassword($conn) {
    $inputData = file_get_contents('php://input');
    $input = json_decode($inputData, true);
    $email = isset($input['email']) ? trim($input['email']) : '';
    
    if (empty($email)) {
        http_response_code(400);
        echo json_encode(['message' => 'Email is required']);
        return;
    }
    
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        // Check if user exists
        $stmt = $conn->prepare("SELECT id, email, username, full_name FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user) {
            // Don't reveal if email exists for security
            echo json_encode(['message' => 'If this email exists, a password reset link has been sent']);
            return;
        }
        
        // Generate a secure reset token
        $resetToken = bin2hex(random_bytes(32));
        $resetExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));
        
        // Store reset token in database
        $updateStmt = $conn->prepare("UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?");
        $updateStmt->execute([$resetToken, $resetExpiry, $user['id']]);
        
        // Generate new temporary password instead of sending token
        $newPassword = generateRandomPassword();
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
        
        // Update password directly
        $passwordStmt = $conn->prepare("UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?");
        $passwordStmt->execute([$hashedPassword, $user['id']]);
        
        // Send email with new password
        $subject = "Password Reset - Project Management System";
        $message = createPasswordResetEmail($user['full_name'] ?: $user['username'], $newPassword);
        
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: Project Management System <noreply@cybaemtech.in>" . "\r\n";
        
        if (mail($email, $subject, $message, $headers)) {
            echo json_encode(['message' => 'A new password has been sent to your email address']);
        } else {
            echo json_encode(['message' => 'Failed to send email. Please try again later']);
        }
        
    } catch (PDOException $e) {
        error_log("Forgot password error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function resetPassword($conn) {
    $inputData = file_get_contents('php://input');
    $input = json_decode($inputData, true);
    $token = isset($input['token']) ? trim($input['token']) : '';
    $newPassword = isset($input['password']) ? trim($input['password']) : '';
    
    if (empty($token) || empty($newPassword)) {
        http_response_code(400);
        echo json_encode(['message' => 'Reset token and new password are required']);
        return;
    }
    
    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['message' => 'Password must be at least 6 characters long']);
        return;
    }
    
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        // Find user with valid reset token
        $stmt = $conn->prepare("SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW() AND is_active = 1");
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        
        if (!$user) {
            http_response_code(400);
            echo json_encode(['message' => 'Invalid or expired reset token']);
            return;
        }
        
        // Update password and clear reset token
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
        $updateStmt = $conn->prepare("UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?");
        $updateStmt->execute([$hashedPassword, $user['id']]);
        
        echo json_encode(['message' => 'Password reset successfully']);
        
    } catch (PDOException $e) {
        error_log("Reset password error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function changePassword($conn) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    $inputData = file_get_contents('php://input');
    $input = json_decode($inputData, true);
    $currentPassword = isset($input['currentPassword']) ? trim($input['currentPassword']) : '';
    $newPassword = isset($input['newPassword']) ? trim($input['newPassword']) : '';
    
    if (empty($currentPassword) || empty($newPassword)) {
        http_response_code(400);
        echo json_encode(['message' => 'Current password and new password are required']);
        return;
    }
    
    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['message' => 'New password must be at least 6 characters long']);
        return;
    }
    
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        // Get user's current password
        $stmt = $conn->prepare("SELECT password FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['message' => 'User not found']);
            return;
        }
        
        // Verify current password
        if (!password_verify($currentPassword, $user['password'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Current password is incorrect']);
            return;
        }
        
        // Update to new password
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
        $updateStmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
        $updateStmt->execute([$hashedPassword, $_SESSION['user_id']]);
        
        echo json_encode(['message' => 'Password changed successfully']);
        
    } catch (PDOException $e) {
        error_log("Change password error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function generateRandomPassword($length = 8) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $password = '';
    for ($i = 0; $i < $length; $i++) {
        $password .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $password;
}

function createPasswordResetEmail($userName, $newPassword) {
    return "
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='UTF-8'>
        <title>Password Reset</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .password-box { background: #fff; border: 2px solid #007bff; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center; }
            .password { font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 2px; }
            .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>Password Reset</h1>
                <p>Project Management System</p>
            </div>
            <div class='content'>
                <h2>Hello " . htmlspecialchars($userName) . ",</h2>
                <p>Your password has been reset as requested. Here is your new temporary password:</p>
                
                <div class='password-box'>
                    <div class='password'>" . htmlspecialchars($newPassword) . "</div>
                </div>
                
                <p><strong>Important:</strong></p>
                <ul>
                    <li>Please log in with this new password immediately</li>
                    <li>We recommend changing this password to something memorable after logging in</li>
                    <li>Go to your profile settings and click 'Change Password'</li>
                </ul>
                
                <p>If you did not request this password reset, please contact your system administrator immediately.</p>
                
                <div class='footer'>
                    <p>This is an automated message from the Project Management System.<br>
                    Please do not reply to this email.</p>
                </div>
            </div>
        </div>
    </body>
    </html>";
}

function refreshSession($conn) {
    // Debug session information
    error_log('=== REFRESH SESSION DEBUG ===');
    error_log('Session ID: ' . session_id());
    error_log('Session status: ' . session_status());
    error_log('Session data: ' . print_r($_SESSION, true));
    
    if (!isset($_SESSION['user_id'])) {
        error_log('No user_id in session during refresh - returning 401');
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    // Regenerate session ID for security
    session_regenerate_id(true);
    
    // Update session timestamp if needed
    $_SESSION['last_activity'] = time();
    
    error_log('Session refreshed successfully');
    echo json_encode([
        'message' => 'Session refreshed',
        'sessionId' => session_id(),
        'timestamp' => time()
    ]);
}
?>