<?php
// Simple authentication test and setup for production
require_once 'config/cors.php';
require_once 'config/database.php';

// Configure session properly
ini_set('session.use_cookies', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '0'); // Set to 1 for HTTPS only
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.gc_maxlifetime', 28800); // 8 hours
ini_set('session.cookie_lifetime', 28800); // 8 hours

session_start();

$database = new Database();
$conn = $database->getConnection();

// Debug information
echo json_encode([
    'message' => 'Authentication debug endpoint',
    'session_id' => session_id(),
    'session_status' => session_status(),
    'session_data' => $_SESSION,
    'cookie_data' => $_COOKIE,
    'server_info' => [
        'host' => $_SERVER['HTTP_HOST'] ?? 'UNKNOWN',
        'request_uri' => $_SERVER['REQUEST_URI'] ?? 'UNKNOWN',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN'
    ],
    'database_connected' => $conn ? true : false,
    'php_version' => PHP_VERSION
]);
?>