<?php
require_once 'config/cors.php';
require_once 'config/database.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

// Handle OPTIONS preflight
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Test endpoint
$result = [
    'status' => 'ok',
    'timestamp' => date('Y-m-d H:i:s'),
    'method' => $method,
    'uri' => $_SERVER['REQUEST_URI'] ?? 'not set',
    'path_info' => $_SERVER['PATH_INFO'] ?? 'not set',
    'agile_api_path' => $_SERVER['AGILE_API_PATH'] ?? 'not set',
    'php_version' => phpversion(),
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'not set',
    'http_host' => $_SERVER['HTTP_HOST'] ?? 'not set',
];

// Test database connection
try {
    $database = new Database();
    $conn = $database->getConnection();
    
    if ($conn) {
        $result['database'] = 'connected';
        
        // Test a simple query
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM users");
        $stmt->execute();
        $userCount = $stmt->fetch(PDO::FETCH_ASSOC);
        $result['user_count'] = $userCount['count'];
        
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM projects");
        $stmt->execute();
        $projectCount = $stmt->fetch(PDO::FETCH_ASSOC);
        $result['project_count'] = $projectCount['count'];
        
    } else {
        $result['database'] = 'failed - no connection';
    }
} catch (Exception $e) {
    $result['database'] = 'error: ' . $e->getMessage();
}

// Test POST data if method is POST
if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $result['raw_input'] = $rawInput;
    $result['decoded_input'] = json_decode($rawInput, true);
    $result['json_error'] = json_last_error_msg();
}

echo json_encode($result, JSON_PRETTY_PRINT);
?>