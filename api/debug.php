<?php
require_once 'config/cors.php';
require_once 'config/database.php';

session_start();

header('Content-Type: application/json');

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    $response = [
        'debug' => [
            'session_id' => session_id(),
            'session_user_id' => $_SESSION['user_id'] ?? null,
            'database_connected' => $conn ? true : false,
            'request_method' => $_SERVER['REQUEST_METHOD'],
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'not_set',
            'path_info' => $_SERVER['PATH_INFO'] ?? 'not_set',
            'agile_api_path' => $_SERVER['AGILE_API_PATH'] ?? 'not_set',
            'post_data' => file_get_contents('php://input')
        ]
    ];
    
    // Test database query if connected
    if ($conn) {
        try {
            // Check user permissions
            if (isset($_SESSION['user_id'])) {
                $stmt = $conn->prepare("SELECT id, username, user_role FROM users WHERE id = ?");
                $stmt->execute([$_SESSION['user_id']]);
                $user = $stmt->fetch();
                $response['debug']['current_user'] = $user;
            }
            
            // Check team_members table structure
            $stmt = $conn->prepare("SHOW COLUMNS FROM team_members WHERE Field = 'role'");
            $stmt->execute();
            $roleColumn = $stmt->fetch();
            $response['debug']['role_enum'] = $roleColumn['Type'] ?? 'not_found';
            
            // Test a sample team member
            $stmt = $conn->prepare("SELECT id, team_id, user_id, role FROM team_members LIMIT 1");
            $stmt->execute();
            $sampleMember = $stmt->fetch();
            $response['debug']['sample_member'] = $sampleMember;
            
        } catch (PDOException $e) {
            $response['debug']['db_error'] = $e->getMessage();
        }
    }
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'debug' => [
            'session_id' => session_id(),
            'session_user_id' => $_SESSION['user_id'] ?? null
        ]
    ], JSON_PRETTY_PRINT);
}
?>