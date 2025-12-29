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

$health = [
    'status' => 'healthy',
    'timestamp' => date('Y-m-d H:i:s'),
    'version' => '1.0.0',
    'environment' => 'production',
    'services' => [
        'api' => 'online',
        'database' => 'checking...'
    ]
];

// Test database connection
try {
    $pdo = new PDO("mysql:host=localhost;dbname=cybaemtechin_agile;charset=utf8mb4", 
                   "cybaemtechin_admin", "Cybaem@2024", [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    $stmt = $pdo->query("SELECT 1");
    $health['services']['database'] = 'online';
    
} catch (Exception $e) {
    $health['services']['database'] = 'offline';
    $health['database_error'] = $e->getMessage();
    $health['status'] = 'degraded';
}

http_response_code(200);
echo json_encode($health, JSON_PRETTY_PRINT);
?>