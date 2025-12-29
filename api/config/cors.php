<?php
// CORS Headers - Improved for production
// Allow specific origins with credentials

$allowedOrigins = [
    'http://localhost:5000',
    'http://localhost:3000',
    'http://127.0.0.1:5000',
    'https://cybaemtech.in',
    'https://www.cybaemtech.in'
];

// Get the origin from the request
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';

// Extract domain from referer if origin is not set
if (empty($requestOrigin) && !empty($_SERVER['HTTP_REFERER'])) {
    $requestOrigin = parse_url($_SERVER['HTTP_REFERER'], PHP_URL_SCHEME) . '://' . parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST);
}

// Log CORS debug info
error_log('CORS Debug - Origin: ' . $requestOrigin . ', Method: ' . $_SERVER['REQUEST_METHOD']);

// Allow the origin if it's in our allowed list
if (in_array($requestOrigin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: {$requestOrigin}");
    header('Access-Control-Allow-Credentials: true');
    error_log('CORS: Allowing origin ' . $requestOrigin);
} else {
    // For production, always allow the main domain
    header("Access-Control-Allow-Origin: https://cybaemtech.in");
    header('Access-Control-Allow-Credentials: true');
    error_log('CORS: Default origin set to https://cybaemtech.in, requested was: ' . $requestOrigin);
}

header('Access-Control-Max-Age: 86400');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, PUT, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    http_response_code(200);
    exit(0);
}

header('Content-Type: application/json');
?>