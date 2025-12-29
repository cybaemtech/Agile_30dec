<?php
require_once 'config/cors.php';
require_once 'config/database.php';

header('Content-Type: application/json');
session_start();

$database = new Database();
$conn = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];

// Handle OPTIONS preflight
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Helper function to check project aFccess
function canAccessProject($conn, $userId, $projectId) {
    // Check if user is admin
    $stmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) return false;
    if ($user['user_role'] === 'ADMIN') return true;
    
    // Check if project exists and get team
    $stmt = $conn->prepare("SELECT team_id FROM projects WHERE id = ?");
    $stmt->execute([$projectId]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$project || !$project['team_id']) return false;
    
    // Check if user is member of project's team
    $stmt = $conn->prepare("SELECT id FROM team_members WHERE team_id = ? AND user_id = ?");
    $stmt->execute([$project['team_id'], $userId]);
    
    return $stmt->fetch() !== false;
}

$path = $_SERVER['AGILE_API_PATH'] ?? ($_SERVER['PATH_INFO'] ?? '/');
$path = rtrim($path, '/');
if ($path === '') $path = '/';

if ($method . ':' . $path === 'GET:/' || $method . ':' . $path === 'GET:') {
    getProjects($conn);
} elseif ($method . ':' . $path === 'POST:/' || $method . ':' . $path === 'POST:') {
    createProject($conn);
} elseif (preg_match('/^\/(\d+)$/', $path, $matches)) {
    $projectId = $matches[1];
    if ($method === 'GET') getProject($conn, $projectId);
    elseif ($method === 'PATCH') updateProject($conn, $projectId);
    elseif ($method === 'DELETE') deleteProject($conn, $projectId);
    else {
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint not found']);
    }
} elseif (preg_match('/^\/(\d+)\/work-items$/', $path, $matches)) {
    $projectId = $matches[1];
    if ($method === 'GET') {
        getWorkItems($conn, $projectId);
    } else {
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint not found']);
    }
} elseif (preg_match('/^\/(\d+)\/team-members$/', $path, $matches)) {
    $projectId = $matches[1];
    if ($method === 'GET') {
        getProjectTeamMembers($conn, $projectId);
    } else {
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint not found']);
    }
} else {
    http_response_code(404);
    echo json_encode(['message' => 'Endpoint not found']);
}

function getProjects($conn) {
    try {
        $stmt = $conn->prepare("SELECT * FROM projects ORDER BY created_at DESC");
        $stmt->execute();
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $projects = array_map(fn($p) => formatProject($p), $projects);
        echo json_encode($projects);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error', 'error' => $e->getMessage()]);
    }
}

function getProject($conn, $id) {
    try {
        $stmt = $conn->prepare("SELECT * FROM projects WHERE id = ?");
        $stmt->execute([$id]);
        $p = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$p) {
            http_response_code(404);
            echo json_encode(['message' => 'Project not found']);
            return;
        }
        echo json_encode(formatProject($p));

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error', 'error' => $e->getMessage()]);
    }
}

function updateProject($conn, $id) {
    $input = json_decode(file_get_contents('php://input'), true);

    try {
        // Check if user is authenticated
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['message' => 'Unauthorized: Please log in']);
            return;
        }

        $userId = $_SESSION['user_id'];

        // Check if user has permission to update projects 
        $stmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            http_response_code(401);
            echo json_encode(['message' => 'Unauthorized: User not found']);
            return;
        }

        // For project key updates, only Admin can do it
        if (isset($input['key'])) {
            if ($user['user_role'] !== 'ADMIN') {
                http_response_code(403);
                echo json_encode(['message' => 'Forbidden: Only Admin can reset project keys']);
                return;
            }
        } else {
            // For other updates, Admin or Scrum Master can do it
            if ($user['user_role'] !== 'ADMIN' && $user['user_role'] !== 'SCRUM_MASTER') {
                http_response_code(403);
                echo json_encode(['message' => 'Forbidden: Only Admin and Scrum Master can edit project details']);
                return;
            }
        }

        $check = $conn->prepare("SELECT id FROM projects WHERE id = ?");
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['message' => 'Project not found']);
            return;
        }

        $fields = [];
        $params = [];

        // Special handling for project key updates
        if (isset($input['key'])) {
            $newKey = strtoupper(trim($input['key']));
            
            // Validate project key format
            if (!preg_match('/^[A-Z0-9]{2,10}$/', $newKey)) {
                http_response_code(400);
                echo json_encode(['message' => 'Project key must be 2-10 uppercase letters and numbers only']);
                return;
            }
            
            // Check if key already exists in another project
            $keyCheck = $conn->prepare("SELECT id FROM projects WHERE `key` = ? AND id != ?");
            $keyCheck->execute([$newKey, $id]);
            if ($keyCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['message' => 'Project key already exists. Please choose a different key.']);
                return;
            }
            
            $fields[] = "`key` = ?";
            $params[] = $newKey;
        }

        foreach (['name','description','status','teamId','startDate','targetDate'] as $col) {
            if (isset($input[$col])) {
                $dbCol = $col === 'teamId' ? 'team_id' : strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $col));
                $fields[] = "$dbCol = ?";
                $params[] = $input[$col];
            }
        }

        if (!$fields) {
            http_response_code(400);
            echo json_encode(['message' => 'No fields to update']);
            return;
        }

        $sql = "UPDATE projects SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?";
        $params[] = $id;

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);

        getProject($conn, $id);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error', 'error' => $e->getMessage()]);
    }
}

function deleteProject($conn, $id) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }

    // Check if user has admin or scrum master role
    $stmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    
    if (!$user || !in_array($user['user_role'], ['ADMIN', 'SCRUM_MASTER'])) {
        http_response_code(403);
        echo json_encode(['message' => 'Only administrators or scrum masters can delete projects']);
        return;
    }

    try {
        // Delete the project (cascade will handle related records)
        $stmt = $conn->prepare("DELETE FROM projects WHERE id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['message' => 'Project not found']);
            return;
        }
        
        echo json_encode(['message' => 'Project deleted successfully']);

    } catch (PDOException $e) {
        error_log("Error deleting project: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error', 'error' => $e->getMessage()]);
    }
}

function getWorkItems($conn, $projectId) {
    try {
        $stmt = $conn->prepare("SELECT * FROM work_items WHERE project_id = ? ORDER BY created_at DESC");
        $stmt->execute([$projectId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $items = array_map(function($i) {
            return [
                'id' => (int)$i['id'],
                'externalId' => $i['external_id'],
                'title' => $i['title'],
                'description' => $i['description'],
                'tags' => $i['tags'],
                'type' => $i['type'],
                'status' => $i['status'],
                'priority' => $i['priority'],
                'projectId' => (int)$i['project_id'],
                'parentId' => $i['parent_id'] ? (int)$i['parent_id'] : null,
                'assigneeId' => $i['assignee_id'] ? (int)$i['assignee_id'] : null,
                'reporterId' => $i['reporter_id'] ? (int)$i['reporter_id'] : null,
                'estimate' => $i['estimate'],
                'startDate' => $i['start_date'],
                'endDate' => $i['end_date'],
                'completedAt' => $i['completed_at'],
                'createdAt' => $i['created_at'],
                'updatedAt' => $i['updated_at']
            ];
        }, $items);

        echo json_encode($items);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error', 'error' => $e->getMessage()]);
    }
}

function getProjectTeamMembers($conn, $projectId) {
    try {
        // Get team_id for the project
        $stmt = $conn->prepare("SELECT team_id FROM projects WHERE id = ?");
        $stmt->execute([$projectId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || !$row['team_id']) {
            http_response_code(404);
            echo json_encode(['message' => 'Project or team not found']);
            return;
        }
        $teamId = $row['team_id'];

        // Get users in the team AND include all ADMIN and SCRUM_MASTER users
        $stmt = $conn->prepare("
            SELECT DISTINCT u.id, u.username, u.full_name, u.email, u.avatar_url, u.is_active, u.user_role
            FROM users u
            LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
            WHERE (tm.user_id IS NOT NULL OR u.user_role IN ('ADMIN', 'SCRUM_MASTER'))
            AND u.is_active = 1
            ORDER BY u.user_role DESC, u.full_name ASC
        ");
        $stmt->execute([$teamId]);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Map DB fields to frontend expectations
        $users = array_map(function($user) {
            return [
                'id' => (int)$user['id'],
                'username' => $user['username'],
                'fullName' => $user['full_name'],
                'email' => $user['email'],
                'avatarUrl' => $user['avatar_url'],
                'isActive' => (bool)$user['is_active'],
                'role' => $user['user_role']
            ];
        }, $users);

        echo json_encode($users);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error', 'error' => $e->getMessage()]);
    }
}

function createProject($conn) {
    try {
        // Enable detailed error logging for debugging
        error_log("=== PROJECT CREATION DEBUG START ===");
        error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
        error_log("Request URI: " . $_SERVER['REQUEST_URI']);
        error_log("Content Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'Not set'));
        
        $rawInput = file_get_contents('php://input');
        error_log("Raw input: " . $rawInput);
        
        $input = json_decode($rawInput, true);
        error_log("Decoded input: " . json_encode($input));
        error_log("JSON decode error: " . json_last_error_msg());
        
        // Validate input data
        if (!$input) {
            error_log("ERROR: No data provided or invalid JSON");
            http_response_code(400);
            echo json_encode(['message' => 'No data provided or invalid JSON', 'error' => 'Invalid JSON input', 'debug' => ['raw' => $rawInput, 'json_error' => json_last_error_msg()]]);
            return;
        }
        
        // Test database connection
        if (!$conn) {
            error_log("ERROR: Database connection failed");
            http_response_code(500);
            echo json_encode(['message' => 'Database connection failed', 'error' => 'No database connection']);
            return;
        }
        
        // Validate required fields
        $errors = [];
        if (empty($input['name'])) {
            $errors[] = ['path' => 'name', 'message' => 'Project name is required'];
        }
        if (empty($input['key'])) {
            $errors[] = ['path' => 'key', 'message' => 'Project key is required'];
        }
        if (empty($input['createdBy'])) {
            $errors[] = ['path' => 'createdBy', 'message' => 'Created by is required'];
        }
        
        // Validate project key format
        if (!empty($input['key']) && !preg_match('/^[A-Z0-9]{2,10}$/', $input['key'])) {
            $errors[] = ['path' => 'key', 'message' => 'Project key must be 2-10 uppercase letters and numbers only'];
        }
        
        if (!empty($errors)) {
            error_log("ERROR: Validation failed - " . json_encode($errors));
            http_response_code(400);
            echo json_encode(['message' => 'Validation failed', 'errors' => $errors]);
            return;
        }
        
        // Check if project key already exists
        try {
            $checkStmt = $conn->prepare("SELECT id FROM projects WHERE `key` = ?");
            $checkStmt->execute([$input['key']]);
            if ($checkStmt->fetch()) {
                error_log("ERROR: Project key already exists - " . $input['key']);
                http_response_code(409);
                echo json_encode([
                    'message' => 'Project key already exists', 
                    'errors' => [['path' => 'key', 'message' => 'A project with this key already exists']]
                ]);
                return;
            }
        } catch (PDOException $e) {
            error_log("ERROR: Database error checking key - " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Database error checking key', 'error' => $e->getMessage()]);
            return;
        }
        
        // Validate team exists if provided
        if (!empty($input['teamId']) && $input['teamId'] !== null) {
            try {
                $teamStmt = $conn->prepare("SELECT id FROM teams WHERE id = ?");
                $teamStmt->execute([$input['teamId']]);
                if (!$teamStmt->fetch()) {
                    error_log("ERROR: Invalid team ID - " . $input['teamId']);
                    http_response_code(400);
                    echo json_encode([
                        'message' => 'Invalid team ID', 
                        'errors' => [['path' => 'teamId', 'message' => 'The specified team does not exist']]
                    ]);
                    return;
                }
            } catch (PDOException $e) {
                error_log("ERROR: Database error checking team - " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['message' => 'Database error checking team', 'error' => $e->getMessage()]);
                return;
            }
        }
        
        // Validate user exists
        try {
            $userStmt = $conn->prepare("SELECT id FROM users WHERE id = ?");
            $userStmt->execute([$input['createdBy']]);
            if (!$userStmt->fetch()) {
                error_log("ERROR: Invalid user ID - " . $input['createdBy']);
                http_response_code(400);
                echo json_encode([
                    'message' => 'Invalid user ID', 
                    'errors' => [['path' => 'createdBy', 'message' => 'The specified user does not exist']]
                ]);
                return;
            }
        } catch (PDOException $e) {
            error_log("ERROR: Database error checking user - " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Database error checking user', 'error' => $e->getMessage()]);
            return;
        }
        
        // Start transaction
        $conn->beginTransaction();
        error_log("Transaction started");
        
        try {
            // Prepare the insert statement
            $stmt = $conn->prepare("
                INSERT INTO projects (
                    `key`, name, description, status, created_by, team_id, start_date, target_date, github_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            // Set default values
            $teamId = (!empty($input['teamId']) && $input['teamId'] !== null) ? $input['teamId'] : null;
            $status = $input['status'] ?? 'ACTIVE';
            $description = $input['description'] ?? '';
            $startDate = !empty($input['startDate']) ? $input['startDate'] : null;
            $targetDate = !empty($input['targetDate']) ? $input['targetDate'] : null;
            $githubUrl = !empty($input['githubUrl']) ? $input['githubUrl'] : null;
            
            $insertData = [
                $input['key'],
                $input['name'],
                $description,
                $status,
                $input['createdBy'],
                $teamId,
                $startDate,
                $targetDate,
                $githubUrl
            ];
            
            error_log("Insert data: " . json_encode($insertData));
            
            // Execute the insert
            $result = $stmt->execute($insertData);
            
            if (!$result) {
                $errorInfo = $stmt->errorInfo();
                error_log("ERROR: Failed to insert project - " . json_encode($errorInfo));
                throw new Exception("Failed to insert project: " . implode(", ", $errorInfo));
            }
            
            $projectId = $conn->lastInsertId();
            error_log("Project inserted with ID: " . $projectId);
            
            // Commit transaction
            $conn->commit();
            error_log("Transaction committed");
            
            // Fetch and return the created project
            $selectStmt = $conn->prepare("SELECT * FROM projects WHERE id = ?");
            $selectStmt->execute([$projectId]);
            $project = $selectStmt->fetch(PDO::FETCH_ASSOC);
            
            error_log("Project created successfully - " . json_encode($project));
            error_log("=== PROJECT CREATION DEBUG END ===");
            
            http_response_code(201);
            echo json_encode(formatProject($project));
            
        } catch (Exception $e) {
            $conn->rollback();
            error_log("ERROR: Transaction rolled back - " . $e->getMessage());
            throw $e;
        }
        
    } catch (PDOException $e) {
        error_log("ERROR: Database error in createProject - " . $e->getMessage());
        error_log("Error info: " . json_encode($e->errorInfo ?? []));
        http_response_code(500);
        echo json_encode(['message' => 'Database error', 'error' => $e->getMessage(), 'debug' => $e->errorInfo ?? []]);
    } catch (Exception $e) {
        error_log("ERROR: General error in createProject - " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error', 'error' => $e->getMessage()]);
    }
}

function formatProject($p) {
    return [
        'id' => (int)$p['id'],
        'key' => $p['key'],
        'name' => $p['name'],
        'description' => $p['description'],
        'status' => $p['status'],
        'createdBy' => $p['created_by'] ? (int)$p['created_by'] : null,
        'teamId' => $p['team_id'] ? (int)$p['team_id'] : null,
        'startDate' => $p['start_date'],
        'targetDate' => $p['target_date'],
        'createdAt' => $p['created_at'],
        'updatedAt' => $p['updated_at']
    ];
}
?>
