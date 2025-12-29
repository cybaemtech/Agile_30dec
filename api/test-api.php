<?php
// Test script to check API connectivity and authentication
header('Content-Type: application/json');
require_once 'config/cors.php';

// Check if this is being called from the API endpoint
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
echo json_encode([
    'message' => 'API Test Endpoint Working',
    'timestamp' => date('Y-m-d H:i:s'),
    'request_uri' => $requestUri,
    'method' => $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN',
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'UNKNOWN',
    'headers' => [
        'host' => $_SERVER['HTTP_HOST'] ?? 'UNKNOWN',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN',
        'referer' => $_SERVER['HTTP_REFERER'] ?? 'UNKNOWN'
    ],
    'php_version' => PHP_VERSION,
    'session_status' => session_status() === PHP_SESSION_NONE ? 'NOT_STARTED' : 
                       (session_status() === PHP_SESSION_ACTIVE ? 'ACTIVE' : 'DISABLED'),
    'working_directory' => getcwd(),
    'script_filename' => __FILE__
]);
?>