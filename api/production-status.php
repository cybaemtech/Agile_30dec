<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://cybaemtech.in');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database configuration
$host = "localhost";
$dbname = "cybaemtechin_agile";
$username = "cybaemtechin_admin";
$password = "Cybaem@2024";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    
    $status = [
        'timestamp' => date('Y-m-d H:i:s'),
        'server_info' => [
            'php_version' => phpversion(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'request_method' => $_SERVER['REQUEST_METHOD'],
            'request_uri' => $_SERVER['REQUEST_URI'] ?? '',
            'http_host' => $_SERVER['HTTP_HOST'] ?? '',
            'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
        ],
        'session_info' => [
            'session_status' => session_status(),
            'session_id' => session_id(),
            'session_name' => session_name(),
            'session_save_path' => session_save_path(),
            'session_cookie_params' => session_get_cookie_params()
        ],
        'headers' => [],
        'cookies' => $_COOKIE,
        'database_status' => 'connected',
        'user_count' => 0,
        'current_user' => null
    ];
    
    // Get all headers
    if (function_exists('getallheaders')) {
        $status['headers'] = getallheaders();
    } else {
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) == 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
                $status['headers'][$header] = $value;
            }
        }
    }
    
    // Get user count
    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM users");
    $stmt->execute();
    $status['user_count'] = $stmt->fetch()['count'];
    
    // Start session and check authentication
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $status['session_data'] = $_SESSION ?? [];
    
    // Check if user is logged in
    if (isset($_SESSION['user_id'])) {
        $stmt = $pdo->prepare("SELECT id, name, email, role FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $status['current_user'] = $stmt->fetch();
        $status['authenticated'] = true;
    } else {
        $status['authenticated'] = false;
    }
    
    // Test user lookup
    $stmt = $pdo->prepare("SELECT id, name, email, role FROM users LIMIT 5");
    $stmt->execute();
    $status['sample_users'] = $stmt->fetchAll();
    
    echo json_encode($status, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT);
}
?>