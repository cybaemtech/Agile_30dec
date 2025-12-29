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

// Only allow POST method
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    // Initialize database connection
    $database = new Database();
    $pdo = $database->getConnection();
    
    if (!$pdo || !($pdo instanceof PDO)) {
        error_log("Invite API: Database connection failed");
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }
    
    error_log("Invite API: Database connection successful");
    
} catch (Exception $e) {
    error_log("Invite API: Database connection error - " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

try {
    // Get and validate input data
    $rawInput = file_get_contents('php://input');
    error_log("Invite API: Raw input - " . $rawInput);
    
    $data = json_decode($rawInput, true);
    error_log("Invite API: Decoded data - " . json_encode($data));
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("Invite API: JSON decode error - " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON data: ' . json_last_error_msg()]);
        exit;
    }
    
} catch (Exception $e) {
    error_log("Invite API: Input processing error - " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Error processing input data']);
    exit;
}

// Validate required fields
if (!$data || empty($data['email'])) {
    error_log("Invite API: Missing email field");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email is required']);
    exit;
}

$email = filter_var($data['email'], FILTER_VALIDATE_EMAIL);
if (!$email) {
    error_log("Invite API: Invalid email format - " . $data['email']);
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit;
}

// Map frontend roles to database user_role values
$roleMapping = [
    'ADMIN' => 'ADMIN',
    'MANAGER' => 'SCRUM_MASTER',
    'LEAD' => 'SCRUM_MASTER',
    'MEMBER' => 'USER'
];

$frontendRole = !empty($data['role']) ? strtoupper($data['role']) : 'MEMBER';
$role = isset($roleMapping[$frontendRole]) ? $roleMapping[$frontendRole] : 'USER';
$teamId = isset($data['teamId']) ? $data['teamId'] : null;

error_log("Invite API: Frontend role: $frontendRole, Mapped to DB role: $role, Team ID: " . ($teamId ?? 'null'));

// Check if user already exists
try {
    $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $checkStmt->execute([$email]);
    if ($checkStmt->fetch()) {
        error_log("Invite API: User already exists with email - " . $email);
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'User with this email already exists']);
        exit;
    }
} catch (PDOException $e) {
    error_log("Invite API: Error checking existing user - " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error checking user']);
    exit;
}

// Generate secure random password
$dummyPassword = bin2hex(random_bytes(4)); // 8-char random password
$hashedPassword = password_hash($dummyPassword, PASSWORD_DEFAULT);

try {
    $pdo->beginTransaction();
    error_log("Invite API: Transaction started");

    // Generate unique username from email
    $username = explode('@', $email)[0];
    $baseUsername = $username;
    $count = 1;
    
    // Ensure username is unique
    $usernameStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
    $usernameStmt->execute([$username]);
    while ($usernameStmt->fetchColumn() > 0) {
        $username = $baseUsername . $count++;
        $usernameStmt->execute([$username]);
    }
    
    error_log("Invite API: Generated username - " . $username);
    
    // Insert user into database
    try {
        $stmt = $pdo->prepare("
            INSERT INTO users (username, email, full_name, password, user_role, is_active) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        $userData = [
            $username,
            $email,
            $email, // Using email as initial full_name
            $hashedPassword,
            $role,
            1
        ];
        
        error_log("Invite API: Inserting user with data - " . json_encode(array_merge($userData, ['password' => '[HIDDEN]'])));
        
        $stmt->execute($userData);
        $userId = $pdo->lastInsertId();
        
        if (!$userId) {
            throw new Exception("Failed to get user ID after insertion");
        }
        
        error_log("Invite API: User created successfully with ID - " . $userId);
        
    } catch (PDOException $e) {
        error_log("Invite API: Database error during user creation - " . $e->getMessage());
        throw new Exception("Failed to create user: " . $e->getMessage());
    }

    // Add user to team if teamId is provided
    if ($teamId) {
        try {
            // Verify team exists
            $teamCheckStmt = $pdo->prepare("SELECT id FROM teams WHERE id = ?");
            $teamCheckStmt->execute([$teamId]);
            if (!$teamCheckStmt->fetch()) {
                error_log("Invite API: Team not found with ID - " . $teamId);
                throw new Exception("Team not found");
            }
            
            // Map role for team membership
            $teamRole = 'MEMBER'; // Default
            if ($role === 'ADMIN' || $role === 'SCRUM_MASTER') {
                $teamRole = 'ADMIN';
            }
            
            error_log("Invite API: Adding user to team - User ID: $userId, Team ID: $teamId, Team Role: $teamRole");
            
            $teamStmt = $pdo->prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)");
            $teamStmt->execute([$teamId, $userId, $teamRole]);
            
            error_log("Invite API: User successfully added to team");
            
        } catch (Exception $e) {
            error_log("Invite API: Error adding user to team - " . $e->getMessage());
            // Continue without failing - user is created, team assignment is optional
        }
    }

    $pdo->commit();
    error_log("Invite API: Transaction committed successfully");

    // Send invitation email
    $inviteUrl = "https://cybaemtech.in/Agile/";
    $subject = "Invitation to Agile Project Management Platform";
    $headers = "From: Agile Team <noreply@cybaemtech.in>\r\n";
    $headers .= "Reply-To: noreply@cybaemtech.in\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    
    $message = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f8fafc; padding: 30px; border-radius: 0 0 5px 5px; }
            .credentials { background-color: #e2e8f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>Welcome to Agile Platform</h1>
            </div>
            <div class='content'>
                <h2>You've been invited!</h2>
                <p>You have been invited to join our Agile Project Management platform. Your account has been created with the following credentials:</p>
                
                <div class='credentials'>
                    <p><strong>Email:</strong> $email</p>
                    <p><strong>Username:</strong> $username</p>
                    <p><strong>Temporary Password:</strong> $dummyPassword</p>
                    <p><strong>Role:</strong> $frontendRole</p>
                </div>
                
                <p>Please click the button below to access the platform and change your password:</p>
                
                <a href='$inviteUrl' class='button'>Access Agile Platform</a>
                
                <p><small>If the button doesn't work, copy and paste this link into your browser:<br>
                <a href='$inviteUrl'>$inviteUrl</a></small></p>
                
                <p><strong>Important:</strong> Please change your password immediately after logging in for security purposes.</p>
            </div>
            <div class='footer'>
                <p>This is an automated message from the Agile Project Management system.</p>
            </div>
        </div>
    </body>
    </html>";

    // Attempt to send email
    $mailSent = false;
    try {
        error_log("Invite API: Attempting to send email to - " . $email);
        $mailSent = mail($email, $subject, $message, $headers);
        error_log("Invite API: Email send result - " . ($mailSent ? "SUCCESS" : "FAILED"));
    } catch (Exception $e) {
        error_log("Invite API: Exception sending email - " . $e->getMessage());
    }
    
    // Return success response
    $response = [
        'success' => true,
        'message' => $mailSent ? 
            'User invited successfully and email sent' : 
            'User created successfully, but email could not be sent',
        'user' => [
            'id' => $userId,
            'username' => $username,
            'email' => $email,
            'role' => $frontendRole
        ]
    ];
    
    if (!$mailSent) {
        $response['temp_password'] = $dummyPassword;
        $response['login_url'] = $inviteUrl;
    }
    
    error_log("Invite API: Sending success response - " . json_encode($response));
    http_response_code(201);
    echo json_encode($response);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
        error_log("Invite API: Transaction rolled back");
    }
    
    error_log("Invite API: Error in invitation process - " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Failed to create user invitation: ' . $e->getMessage()
    ]);
}
?>