<?php
// Login with OTP verification API
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

// Robust path derivation
$path = $_SERVER['AGILE_API_PATH'] ?? ($_SERVER['PATH_INFO'] ?? '');
if ($path === '' && isset($_SERVER['REDIRECT_URL'])) {
    if (preg_match('~/(login-otp)(/.*)?$~i', $_SERVER['REDIRECT_URL'], $m)) { 
        $path = $m[2] ?? '/'; 
    }
}
if ($path === '' && isset($_SERVER['REQUEST_URI'])) {
    $uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
    if (preg_match('~/(login-otp)(/.*)?$~i', $uriPath, $m)) { 
        $path = $m[2] ?? '/'; 
    }
}
$path = rtrim($path ?: '/', '/');
if ($path === '') $path = '/';

switch ($method . ':' . $path) {
    case 'POST:/send-otp':
        sendLoginOTP($conn);
        break;
    
    case 'POST:/verify-login':
        verifyOTPAndLogin($conn);
        break;
    
    default:
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint not found']);
        break;
}

function sendLoginOTP($conn) {
    $inputData = file_get_contents('php://input');
    $input = json_decode($inputData, true);
    $email = isset($input['email']) ? trim($input['email']) : '';
    $password = isset($input['password']) ? trim($input['password']) : '';
    
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['message' => 'Email and password are required']);
        return;
    }
    
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        // Verify credentials first
        $stmt = $conn->prepare("SELECT id, email, full_name, username, password, last_otp_sent, otp_attempts FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user) {
            http_response_code(401);
            echo json_encode(['message' => 'Invalid credentials']);
            return;
        }
        
        $passwordMatch = password_verify($password, $user['password']);
        if (!$passwordMatch) {
            http_response_code(401);
            echo json_encode(['message' => 'Invalid credentials']);
            return;
        }
        
        // Check rate limiting - max 3 OTP requests per hour
        if ($user['last_otp_sent']) {
            $lastSent = new DateTime($user['last_otp_sent']);
            $now = new DateTime();
            $interval = $now->diff($lastSent);
            
            // If last OTP was sent less than 2 minutes ago
            if ($interval->i < 2 && $interval->h == 0 && $interval->days == 0) {
                http_response_code(429);
                echo json_encode(['message' => 'Please wait 2 minutes before requesting another OTP']);
                return;
            }
            
            // Reset attempts counter if more than 1 hour has passed
            if ($interval->h >= 1 || $interval->days > 0) {
                $updateAttempts = $conn->prepare("UPDATE users SET otp_attempts = 0 WHERE id = ?");
                $updateAttempts->execute([$user['id']]);
                $user['otp_attempts'] = 0;
            }
        }
        
        // Check if user has exceeded maximum attempts
        if ($user['otp_attempts'] >= 3) {
            http_response_code(429);
            echo json_encode(['message' => 'Maximum OTP attempts exceeded. Please try again after 1 hour']);
            return;
        }
        
        // Generate 6-digit OTP
        $otp = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $otpExpiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));
        
        // Store OTP temporarily in session for verification
        $_SESSION['login_otp'] = $otp;
        $_SESSION['login_otp_expiry'] = $otpExpiry;
        $_SESSION['login_email'] = $email;
        $_SESSION['login_user_id'] = $user['id'];
        
        // Update user with OTP details
        $updateStmt = $conn->prepare("UPDATE users SET otp_code = ?, otp_expires = ?, last_otp_sent = ?, otp_attempts = otp_attempts + 1 WHERE id = ?");
        $updateStmt->execute([$otp, $otpExpiry, date('Y-m-d H:i:s'), $user['id']]);
        
        // Send email with OTP
        $subject = "Login Verification - Project Management System";
        $message = createLoginOTPEmail($user['full_name'] ?: $user['username'], $otp);
        
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: Project Management System <noreply@cybaemtech.in>" . "\r\n";
        
        if (mail($email, $subject, $message, $headers)) {
            echo json_encode([
                'success' => true,
                'message' => 'OTP sent successfully to your email address',
                'expires_in_minutes' => 10
            ]);
        } else {
            echo json_encode(['message' => 'Failed to send OTP email. Please try again later']);
        }
        
    } catch (PDOException $e) {
        error_log("Send login OTP error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function verifyOTPAndLogin($conn) {
    $inputData = file_get_contents('php://input');
    $input = json_decode($inputData, true);
    $email = isset($input['email']) ? trim($input['email']) : '';
    $password = isset($input['password']) ? trim($input['password']) : '';
    $otp = isset($input['otp']) ? trim($input['otp']) : '';
    
    if (empty($email) || empty($password) || empty($otp)) {
        http_response_code(400);
        echo json_encode(['message' => 'Email, password and OTP are required']);
        return;
    }
    
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        // Verify OTP from session
        if (!isset($_SESSION['login_otp']) || !isset($_SESSION['login_email']) || 
            $_SESSION['login_email'] !== $email || $_SESSION['login_otp'] !== $otp) {
            http_response_code(400);
            echo json_encode(['message' => 'Invalid or expired OTP']);
            return;
        }
        
        // Check OTP expiry
        $otpExpiry = new DateTime($_SESSION['login_otp_expiry']);
        $now = new DateTime();
        if ($now > $otpExpiry) {
            // Clear session data
            unset($_SESSION['login_otp'], $_SESSION['login_otp_expiry'], $_SESSION['login_email'], $_SESSION['login_user_id']);
            http_response_code(400);
            echo json_encode(['message' => 'OTP has expired. Please request a new OTP']);
            return;
        }
        
        // Get user and verify credentials again
        $stmt = $conn->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user || !password_verify($password, $user['password'])) {
            http_response_code(401);
            echo json_encode(['message' => 'Invalid credentials']);
            return;
        }
        
        // Clear OTP data from database and session
        $updateStmt = $conn->prepare("UPDATE users SET otp_code = NULL, otp_expires = NULL, otp_attempts = 0 WHERE id = ?");
        $updateStmt->execute([$user['id']]);
        
        unset($_SESSION['login_otp'], $_SESSION['login_otp_expiry'], $_SESSION['login_email'], $_SESSION['login_user_id']);
        
        // Update last login
        $updateLoginStmt = $conn->prepare("UPDATE users SET last_login = ? WHERE id = ?");
        $updateLoginStmt->execute([date('Y-m-d H:i:s'), $user['id']]);
        
        // Set login session
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['user_role'];
        
        echo json_encode([
            'success' => true,
            'message' => 'Login successful',
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'fullName' => $user['full_name'],
                'role' => $user['user_role'],
                'avatarUrl' => $user['avatar_url']
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log("Verify login OTP error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function createLoginOTPEmail($userName, $otp) {
    return "
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='UTF-8'>
        <title>Login Verification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background: #fff; border: 3px solid #28a745; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; box-shadow: 0 4px 6px rgba(40, 167, 69, 0.1); }
            .otp { font-size: 36px; font-weight: bold; color: #28a745; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>🔐 Login Verification</h1>
                <p>Project Management System</p>
            </div>
            <div class='content'>
                <h2>Hello " . htmlspecialchars($userName) . ",</h2>
                <p>A sign-in attempt requires verification. Please use the code below to complete your login:</p>
                
                <div class='otp-box'>
                    <p style='margin: 0; font-size: 16px; color: #666; margin-bottom: 10px;'>Your verification code is:</p>
                    <div class='otp'>" . htmlspecialchars($otp) . "</div>
                    <p style='margin: 10px 0 0 0; font-size: 14px; color: #888;'>Valid for 10 minutes</p>
                </div>
                
                <div class='warning'>
                    <strong>🛡️ Security Notice:</strong>
                    <ul style='margin: 10px 0; padding-left: 20px;'>
                        <li>This code is valid for <strong>10 minutes only</strong></li>
                        <li>Do not share this code with anyone</li>
                        <li>If you didn't attempt to sign in, please ignore this email</li>
                        <li>Consider changing your password if you suspect unauthorized access</li>
                    </ul>
                </div>
                
                <p><strong>Login Security Features:</strong></p>
                <ul>
                    <li>🔒 Two-factor authentication via email</li>
                    <li>⏱️ Time-limited verification codes</li>
                    <li>🚫 Rate limiting to prevent abuse</li>
                    <li>📊 Login attempt monitoring</li>
                </ul>
                
                <div class='footer'>
                    <p>This is an automated security message from the Project Management System.<br>
                    Please do not reply to this email.</p>
                    <p style='margin-top: 15px;'><strong>Cybaem Technology</strong><br>
                    Secure • Reliable • Professional</p>
                </div>
            </div>
        </div>
    </body>
    </html>";
}
?>