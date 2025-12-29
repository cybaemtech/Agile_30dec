<?php
header('Content-Type: text/plain');
header('Access-Control-Allow-Origin: https://cybaemtech.in');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

echo "=== AUTHENTICATION DEBUG REPORT ===\n";
echo "Timestamp: " . date('Y-m-d H:i:s') . "\n";
echo "Server: " . ($_SERVER['HTTP_HOST'] ?? 'Unknown') . "\n";
echo "Request URI: " . ($_SERVER['REQUEST_URI'] ?? 'Unknown') . "\n\n";

// Check session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

echo "=== SESSION INFO ===\n";
echo "Session ID: " . session_id() . "\n";
echo "Session Status: " . session_status() . "\n";
echo "Session Data: " . json_encode($_SESSION) . "\n\n";

echo "=== COOKIES ===\n";
echo "Cookies: " . json_encode($_COOKIE) . "\n\n";

// Database check
echo "=== DATABASE CHECK ===\n";
try {
    $pdo = new PDO("mysql:host=localhost;dbname=cybaemtechin_agile;charset=utf8mb4", 
                   "cybaemtechin_admin", "Cybaem@2024", [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    echo "Database: Connected ✓\n";
    
    // Check user count
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
    $userCount = $stmt->fetch()['count'];
    echo "Total Users: $userCount\n";
    
    // Check if user is logged in
    if (isset($_SESSION['user_id'])) {
        $stmt = $pdo->prepare("SELECT id, name, email, role FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        if ($user) {
            echo "Current User: " . $user['email'] . " (" . $user['role'] . ") ✓\n";
            echo "Authentication: AUTHENTICATED ✓\n";
        } else {
            echo "Current User: Session user ID not found in database ✗\n";
            echo "Authentication: INVALID SESSION ✗\n";
        }
    } else {
        echo "Current User: None (not logged in)\n";
        echo "Authentication: NOT AUTHENTICATED ✗\n";
    }
    
} catch (Exception $e) {
    echo "Database: Error - " . $e->getMessage() . " ✗\n";
}

echo "\n=== EXPECTED BEHAVIOR ===\n";
echo "If NOT AUTHENTICATED: Frontend should show LOGIN PAGE immediately\n";
echo "If AUTHENTICATED: Frontend should show DASHBOARD\n";
echo "NO BLANK LOADING PAGES should appear\n";

echo "\n=== TROUBLESHOOTING ===\n";
echo "1. Clear browser cookies/storage\n";
echo "2. Visit main page: https://cybaemtech.in/Agile/\n";
echo "3. Should see LOGIN PAGE immediately (no loading spinner)\n";
echo "4. Login should work and redirect to dashboard\n";

echo "\n=== END REPORT ===\n";
?>