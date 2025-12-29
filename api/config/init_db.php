<?php
require_once 'database.php';
require_once 'MySQLSessionHandler.php';
$database = new Database();
$pdo = $database->getConnection();
$handler = new MySQLSessionHandler($pdo, ['db_table' => 'sessions']);
session_set_save_handler($handler, true);
session_name('PHPSESSID'); // Ensure session name matches Node.js
session_start();
function initializeDatabase() {
    $database = new Database();
    $conn = $database->getConnection();
    
    try {
        // Insert sample users for MySQL database
        $admin_password = password_hash('admin123', PASSWORD_BCRYPT);
        $scrum_password = password_hash('scrum123', PASSWORD_BCRYPT);
        $user_password = password_hash('user123', PASSWORD_BCRYPT);
        
        // Check if users already exist before inserting
        $stmt = $conn->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
        
        $users = [
            ['admin', 'admin@cybaemtech.com', 'Admin User', $admin_password, 'ADMIN'],
            ['scrummaster', 'scrum@cybaemtech.com', 'Scrum Master', $scrum_password, 'SCRUM_MASTER'],
            ['developer', 'dev@cybaemtech.com', 'Developer User', $user_password, 'USER'],
            ['manager', 'manager@cybaemtech.com', 'Project Manager', $user_password, 'SCRUM_MASTER'],
            ['tester', 'tester@cybaemtech.com', 'QA Tester', $user_password, 'USER']
        ];
        
        foreach ($users as $user) {
            $stmt->execute([$user[0]]);
            if ($stmt->fetchColumn() == 0) {
                $insertStmt = $conn->prepare("INSERT INTO users (username, email, full_name, password, user_role) VALUES (?, ?, ?, ?, ?)");
                $insertStmt->execute($user);
            }
        }
        
        echo json_encode(['message' => 'Database initialized successfully with sample users']);
        
    } catch(PDOException $e) {
        echo json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]);
    }
}

// If script is called directly, initialize database
if (basename(__FILE__) == basename($_SERVER['SCRIPT_NAME'])) {
    initializeDatabase();
}


?>