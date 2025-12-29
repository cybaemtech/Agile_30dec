<?php
// Email Verification API
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
    if (preg_match('~/(email-verification)(/.*)?$~i', $_SERVER['REDIRECT_URL'], $m)) { 
        $path = $m[2] ?? '/'; 
    }
}
if ($path === '' && isset($_SERVER['REQUEST_URI'])) {
    $uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
    if (preg_match('~/(email-verification)(/.*)?$~i', $uriPath, $m)) { 
        $path = $m[2] ?? '/'; 
    }
}
$path = rtrim($path ?: '/', '/');
if ($path === '') $path = '/';

switch ($method . ':' . $path) {
    case 'POST:/send-otp':
        sendOTP($conn);
        break;
    
    case 'POST:/verify-otp':
        verifyOTP($conn);
        break;
    
    case 'POST:/resend-otp':
        resendOTP($conn);
        break;
    
    case 'GET:/status':
        getVerificationStatus($conn);
        break;
    
    default:
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint not found']);
        break;
}

function sendOTP($conn) {
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
        // Check if user exists and is active
        $stmt = $conn->prepare("SELECT id, email, full_name, username, email_verified, last_otp_sent, otp_attempts FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['message' => 'User not found or inactive']);
            return;
        }
        
        if ($user['email_verified']) {
            http_response_code(400);
            echo json_encode(['message' => 'Email is already verified']);
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
        $otpExpiry = date('Y-m-d H:i:s', strtotime('+10 minutes')); // OTP valid for 10 minutes
        
        // Update user with OTP
        $updateStmt = $conn->prepare("UPDATE users SET otp_code = ?, otp_expires = ?, last_otp_sent = ?, otp_attempts = otp_attempts + 1 WHERE id = ?");
        $updateStmt->execute([$otp, $otpExpiry, date('Y-m-d H:i:s'), $user['id']]);
        
        // Send email with OTP
        $subject = "Email Verification - Project Management System";
        $message = createOTPEmail($user['full_name'] ?: $user['username'], $otp);
        
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: Project Management System <noreply@cybaemtech.in>" . "\r\n";
        
        if (mail($email, $subject, $message, $headers)) {
            echo json_encode([
                'message' => 'OTP sent successfully to your email address',
                'expires_in_minutes' => 10
            ]);
        } else {
            echo json_encode(['message' => 'Failed to send OTP email. Please try again later']);
        }
        
    } catch (PDOException $e) {
        error_log("Send OTP error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function verifyOTP($conn) {
    $inputData = file_get_contents('php://input');
    $input = json_decode($inputData, true);
    $email = isset($input['email']) ? trim($input['email']) : '';
    $otp = isset($input['otp']) ? trim($input['otp']) : '';
    
    if (empty($email) || empty($otp)) {
        http_response_code(400);
        echo json_encode(['message' => 'Email and OTP are required']);
        return;
    }
    
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        // Get user with OTP
        $stmt = $conn->prepare("SELECT id, email, full_name, username, email_verified, otp_code, otp_expires FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['message' => 'User not found or inactive']);
            return;
        }
        
        if ($user['email_verified']) {
            http_response_code(400);
            echo json_encode(['message' => 'Email is already verified']);
            return;
        }
        
        if (!$user['otp_code'] || !$user['otp_expires']) {
            http_response_code(400);
            echo json_encode(['message' => 'No OTP found. Please request a new OTP']);
            return;
        }
        
        // Check if OTP is expired
        $otpExpiry = new DateTime($user['otp_expires']);
        $now = new DateTime();
        if ($now > $otpExpiry) {
            http_response_code(400);
            echo json_encode(['message' => 'OTP has expired. Please request a new OTP']);
            return;
        }
        
        // Verify OTP
        if ($user['otp_code'] !== $otp) {
            http_response_code(400);
            echo json_encode(['message' => 'Invalid OTP. Please check and try again']);
            return;
        }
        
        // Mark email as verified and clear OTP data
        $updateStmt = $conn->prepare("UPDATE users SET email_verified = TRUE, otp_code = NULL, otp_expires = NULL, otp_attempts = 0 WHERE id = ?");
        $updateStmt->execute([$user['id']]);
        
        echo json_encode([
            'message' => 'Email verified successfully',
            'success' => true
        ]);
        
    } catch (PDOException $e) {
        error_log("Verify OTP error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function resendOTP($conn) {
    // Reuse sendOTP function
    sendOTP($conn);
}

function getVerificationStatus($conn) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['message' => 'Database connection failed']);
        return;
    }
    
    try {
        $stmt = $conn->prepare("SELECT email_verified, email FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['message' => 'User not found']);
            return;
        }
        
        echo json_encode([
            'email_verified' => (bool)$user['email_verified'],
            'email' => $user['email']
        ]);
        
    } catch (PDOException $e) {
        error_log("Get verification status error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function createOTPEmail($userName, $otp) {
    return "
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='UTF-8'>
        <title>Email Verification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background: #fff; border: 3px solid #007bff; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; box-shadow: 0 4px 6px rgba(0, 123, 255, 0.1); }
            .otp { font-size: 36px; font-weight: bold; color: #007bff; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #666; }
            .btn { display: inline-block; background: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>🔐 Email Verification</h1>
                <p>Project Management System</p>
            </div>
            <div class='content'>
                <h2>Hello " . htmlspecialchars($userName) . ",</h2>
                <p>Thank you for registering with our Project Management System. To complete your registration and secure your account, please verify your email address using the OTP below:</p>
                
                <div class='otp-box'>
                    <p style='margin: 0; font-size: 16px; color: #666; margin-bottom: 10px;'>Your verification code is:</p>
                    <div class='otp'>" . htmlspecialchars($otp) . "</div>
                    <p style='margin: 10px 0 0 0; font-size: 14px; color: #888;'>Valid for 10 minutes</p>
                </div>
                
                <div class='warning'>
                    <strong>⚠️ Security Notice:</strong>
                    <ul style='margin: 10px 0; padding-left: 20px;'>
                        <li>This OTP is valid for <strong>10 minutes only</strong></li>
                        <li>Do not share this code with anyone</li>
                        <li>If you didn't request this verification, please ignore this email</li>
                        <li>You can request a new OTP if this one expires</li>
                    </ul>
                </div>
                
                <p><strong>Why verify your email?</strong></p>
                <ul>
                    <li>🔒 Secures your account access</li>
                    <li>📧 Ensures you receive important notifications</li>
                    <li>🔑 Enables password recovery if needed</li>
                    <li>✅ Confirms account authenticity</li>
                </ul>
                
                <p>If you have any questions or need assistance, please contact our support team.</p>
                
                <div class='footer'>
                    <p>This is an automated message from the Project Management System.<br>
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