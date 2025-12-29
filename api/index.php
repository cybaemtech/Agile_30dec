<?php
// Simple PHP router for the API
require_once 'config/cors.php';

$requestUri = $_SERVER['REQUEST_URI'];

// Remove query string if present
$path = parse_url($requestUri, PHP_URL_PATH);

// Robust path extraction for all API endpoints
if (preg_match('~/(?:.+/)?api/(?:index\.php/)?(auth|users|teams|projects|work-items|test|invite|email-verification|login-otp|auth-debug|setup-users|simple-login)(/.*)?$~i', $path, $matches)) {
    $resource = strtolower($matches[1]);
    $subpath = rtrim($matches[2] ?? '/', '/');
    if ($subpath === '') $subpath = '/';
    
    // Pass parsed path to endpoint files
    $_SERVER['AGILE_API_PATH'] = $subpath;
    $_SERVER['AGILE_RESOURCE'] = $resource;
    
    // Route to appropriate endpoint file
    switch ($resource) {
        case 'auth':
            include 'auth.php';
            break;
        case 'users':
            include 'users.php';
            break;
        case 'teams':
            include 'teams.php';
            break;
        case 'projects':
            include 'projects.php';
            break;
        case 'work-items':
            include 'work-items.php';
            break;
        case 'test':
            include 'test.php';
            break;
        case 'invite':
            include 'invite.php';
            break;
        case 'email-verification':
            include 'email-verification.php';
            break;
        case 'login-otp':
            include 'login-otp.php';
            break;
        case 'auth-debug':
            include 'auth-debug.php';
            break;
        case 'setup-users':
            include 'setup-users.php';
            break;
        case 'simple-login':
            include 'simple-login.php';
            break;
    }
} else {
    http_response_code(404);
    echo json_encode(['message' => 'API endpoint not found']);
}
?>