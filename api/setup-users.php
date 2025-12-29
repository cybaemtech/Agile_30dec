<?php
// Setup default users for production if they don't exist
require_once 'config/cors.php';
require_once 'config/database.php';

// Configure session
ini_set('session.use_cookies', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '0');
ini_set('session.cookie_samesite', 'Lax');

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

try {
    // Check if any users exist
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM users");
    $stmt->execute();
    $userCount = $stmt->fetch()['count'];
    
    if ($userCount == 0) {
        // Create default admin user
        $passwordHash = password_hash('admin123', PASSWORD_DEFAULT);
        
        $stmt = $conn->prepare("
            INSERT INTO users (username, email, password, full_name, user_role, is_active, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        
        $stmt->execute([
            'admin',
            'admin@example.com', 
            $passwordHash,
            'Default Admin',
            'ADMIN',
            1
        ]);
        
        echo json_encode([
            'message' => 'Default admin user created',
            'username' => 'admin',
            'email' => 'admin@example.com',
            'password' => 'admin123',
            'role' => 'ADMIN'
        ]);
    } else {
        // Show existing users
        $stmt = $conn->prepare("SELECT id, username, email, full_name, user_role, is_active FROM users LIMIT 5");
        $stmt->execute();
        $users = $stmt->fetchAll();
        
        echo json_encode([
            'message' => 'Users already exist in database',
            'user_count' => $userCount,
            'sample_users' => $users
        ]);
    }
    
} catch (PDOException $e) {
    echo json_encode([
        'error' => 'Database error: ' . $e->getMessage()
    ]);
}
?>