<?php
// SECURITY: Simple login disabled - enforces OTP verification
require_once 'config/cors.php';

// Always return error to enforce OTP security
http_response_code(405); // Method Not Allowed
echo json_encode([
    'success' => false,
    'error' => 'Simple login disabled for security',
    'message' => 'Please use OTP verification for secure authentication'
]);
exit;
?>

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim($input['email']) : '';
$password = isset($input['password']) ? trim($input['password']) : '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['message' => 'Email and password are required']);
    exit;
}

try {
    // Find user by email
    $stmt = $conn->prepare("SELECT id, username, email, password, full_name, user_role, is_active FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user) {
        error_log('Simple login: User not found for email: ' . $email);
        http_response_code(401);
        echo json_encode(['message' => 'Invalid credentials']);
        exit;
    }
    
    if (!$user['is_active']) {
        error_log('Simple login: User account inactive for email: ' . $email);
        http_response_code(401);
        echo json_encode(['message' => 'Account is inactive']);
        exit;
    }
    
    // Check password
    if (!password_verify($password, $user['password'])) {
        error_log('Simple login: Invalid password for email: ' . $email);
        http_response_code(401);
        echo json_encode(['message' => 'Invalid credentials']);
        exit;
    }
    
    // Set session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['user_role'];
    $_SESSION['login_time'] = time();
    $_SESSION['last_activity'] = time();
    
    // Regenerate session ID for security
    session_regenerate_id(true);
    
    error_log('Simple login: Successful login for user ID: ' . $user['id'] . ', email: ' . $email);
    
    // Return user data
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'fullName' => $user['full_name'],
            'role' => $user['user_role']
        ],
        'session_id' => session_id()
    ]);
    
} catch (PDOException $e) {
    error_log('Simple login error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Internal server error']);
}
?>