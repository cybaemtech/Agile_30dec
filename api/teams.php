<?php
require_once 'config/cors.php';
require_once 'config/database.php';

// Add debugging to see what's happening
error_log("=== TEAMS API START ===");
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
error_log("REQUEST_URI: " . $_SERVER['REQUEST_URI']);
error_log("AGILE_API_PATH: " . ($_SERVER['AGILE_API_PATH'] ?? 'NOT SET'));
error_log("PATH_INFO: " . ($_SERVER['PATH_INFO'] ?? 'NOT SET'));

session_start();

error_log("SESSION USER_ID: " . ($_SESSION['user_id'] ?? 'NOT SET'));

$database = new Database();
$conn = $database->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['message' => 'Database connection failed']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Handle OPTIONS preflight requests
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get path from centralized parsing in index.php or PATH_INFO fallback
$path = $_SERVER['AGILE_API_PATH'] ?? ($_SERVER['PATH_INFO'] ?? '/');
$path = rtrim($path, '/');
if ($path === '') $path = '/';

error_log("PARSED PATH: " . $path);
error_log("METHOD: " . $method);
error_log("SWITCH CASE: " . $method . ':' . $path);

switch ($method . ':' . $path) {
    case 'GET:':
    case 'GET:/':
        error_log("ROUTING: getTeams");
        getTeams($conn);
        break;
    
    case 'POST:':
    case 'POST:/':
        error_log("ROUTING: createTeam");
        createTeam($conn);
        break;
    
    default:
        error_log("ROUTING: Checking patterns for path: $path");
        if (preg_match('/^\/(\d+)$/', $path, $matches)) {
            $teamId = $matches[1];
            error_log("ROUTING: Single team pattern matched, teamId: $teamId, method: $method");
            if ($method === 'GET') {
                getTeam($conn, $teamId);
            } elseif ($method === 'DELETE') {
                deleteTeam($conn, $teamId);
            }
        } elseif (preg_match('/^\/(\d+)\/members$/', $path, $matches)) {
            $teamId = $matches[1];
            error_log("ROUTING: Team members pattern matched, teamId: $teamId, method: $method");
            if ($method === 'GET') {
                getTeamMembers($conn, $teamId);
            } elseif ($method === 'POST') {
                addTeamMember($conn, $teamId);
            }
        } elseif (preg_match('/^\/(\d+)\/members\/(\d+)$/', $path, $matches)) {
            $teamId = $matches[1];
            $userId = $matches[2];
            error_log("ROUTING: Specific team member pattern matched, teamId: $teamId, userId: $userId, method: $method");
            if ($method === 'DELETE') {
                removeTeamMember($conn, $teamId, $userId);
            } elseif ($method === 'PATCH') {
                updateTeamMemberRole($conn, $teamId, $userId);
            }
        } else {
            error_log("ROUTING: No pattern matched for path: $path");
            http_response_code(404);
            echo json_encode(['message' => 'Endpoint not found', 'path' => $path, 'method' => $method]);
        }
        break;
}

function getTeams($conn) {
    try {
        $stmt = $conn->prepare("SELECT * FROM teams ORDER BY created_at DESC");
        $stmt->execute();
        $teams = $stmt->fetchAll();
        
        $teams = array_map(function($team) {
            return [
                'id' => (int)$team['id'],
                'name' => $team['name'],
                'description' => $team['description'],
                'createdBy' => (int)$team['created_by'],
                'isActive' => (bool)$team['is_active'],
                'createdAt' => $team['created_at'],
                'updatedAt' => $team['updated_at']
            ];
        }, $teams);
        
        echo json_encode($teams);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function getTeam($conn, $teamId) {
    try {
        $stmt = $conn->prepare("SELECT * FROM teams WHERE id = ?");
        $stmt->execute([$teamId]);
        $team = $stmt->fetch();
        
        if (!$team) {
            http_response_code(404);
            echo json_encode(['message' => 'Team not found']);
            return;
        }
        
        $team = [
            'id' => (int)$team['id'],
            'name' => $team['name'],
            'description' => $team['description'],
            'createdBy' => (int)$team['created_by'],
            'isActive' => (bool)$team['is_active'],
            'createdAt' => $team['created_at'],
            'updatedAt' => $team['updated_at']
        ];
        
        echo json_encode($team);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function createTeam($conn) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['name'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Team name is required']);
        return;
    }
    
    try {
        $stmt = $conn->prepare("
            INSERT INTO teams (name, description, created_by, is_active, created_at, updated_at) 
            VALUES (?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([
            $input['name'],
            $input['description'] ?? null,
            $_SESSION['user_id'],
            1 // is_active
        ]);
        $teamId = $conn->lastInsertId();

        // Add creator as ADMIN in team_members
        $addMemberStmt = $conn->prepare("
            INSERT INTO team_members (team_id, user_id, role, joined_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
        ");
        $addMemberStmt->execute([
            $teamId,
            $_SESSION['user_id'],
            'ADMIN'
        ]);

        // Return created team
        getTeam($conn, $teamId);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function getTeamMembers($conn, $teamId) {
    try {
        $stmt = $conn->prepare("
            SELECT tm.*, u.username, u.email, u.full_name, u.avatar_url 
            FROM team_members tm 
            JOIN users u ON tm.user_id = u.id 
            WHERE tm.team_id = ? AND u.is_active = 1
        ");
        $stmt->execute([$teamId]);
        $members = $stmt->fetchAll();
        
        $members = array_map(function($member) {
            return [
                'id' => (int)$member['id'],
                'teamId' => (int)$member['team_id'],
                'userId' => (int)$member['user_id'],
                'role' => $member['role'],
                'joinedAt' => $member['joined_at'],
                'updatedAt' => $member['updated_at'],
                'user' => [
                    'id' => (int)$member['user_id'],
                    'username' => $member['username'],
                    'email' => $member['email'],
                    'fullName' => $member['full_name'],
                    'avatarUrl' => $member['avatar_url']
                ]
            ];
        }, $members);
        
        echo json_encode($members);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function addTeamMember($conn, $teamId) {
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
        echo json_encode(['message' => 'Only administrators or scrum masters can add team members']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['userId'])) {
        http_response_code(400);
        echo json_encode(['message' => 'User ID is required']);
        return;
    }

    // Check if user is active
    $userCheckStmt = $conn->prepare("SELECT is_active FROM users WHERE id = ?");
    $userCheckStmt->execute([$input['userId']]);
    $userRow = $userCheckStmt->fetch();
    if (!$userRow || !$userRow['is_active']) {
        http_response_code(400);
        echo json_encode(['message' => 'Cannot add inactive user as team member']);
        return;
    }
    
    try {
        $role = isset($input['role']) ? trim($input['role']) : 'MEMBER';
        
        // Validate role matches database enum values
        $validRoles = ['ADMIN', 'MANAGER', 'LEAD', 'MEMBER', 'VIEWER', 'SCRUM_MASTER'];
        if (!in_array($role, $validRoles)) {
            http_response_code(400);
            echo json_encode(['message' => 'Invalid role: ' . $role . '. Valid roles: ' . implode(', ', $validRoles)]);
            return;
        }
        
        $stmt = $conn->prepare("
            INSERT INTO team_members (team_id, user_id, role, joined_at, updated_at) 
            VALUES (?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$teamId, $input['userId'], $role]);
        
        http_response_code(201);
        echo json_encode(['message' => 'Team member added successfully']);
        
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            http_response_code(409);
            echo json_encode(['message' => 'User is already a member of this team']);
        } else {
            http_response_code(500);
            echo json_encode(['message' => 'Internal server error']);
        }
    }
}

function removeTeamMember($conn, $teamId, $userId) {
    // Log the incoming request
    error_log("=== removeTeamMember START ===");
    error_log("teamId: $teamId, userId: $userId");
    error_log("session user_id: " . ($_SESSION['user_id'] ?? 'NOT SET'));
    
    // Validate inputs
    if (!is_numeric($teamId) || !is_numeric($userId)) {
        error_log("removeTeamMember: Invalid input - teamId: $teamId, userId: $userId");
        http_response_code(400);
        echo json_encode(['message' => 'Invalid team ID or user ID']);
        return;
    }
    
    if (!isset($_SESSION['user_id'])) {
        error_log("removeTeamMember: User not authenticated");
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    // Check if user has admin or scrum master role
    try {
        $stmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        error_log("removeTeamMember: Current user role: " . ($user['user_role'] ?? 'NOT FOUND'));
        
        if (!$user || !in_array($user['user_role'], ['ADMIN', 'SCRUM_MASTER'])) {
            error_log("removeTeamMember: Permission denied for role: " . ($user['user_role'] ?? 'NOT FOUND'));
            http_response_code(403);
            echo json_encode(['message' => 'Only administrators or scrum masters can remove team members']);
            return;
        }
        
        // First check if team exists
        $stmt = $conn->prepare("SELECT id, name FROM teams WHERE id = ?");
        $stmt->execute([$teamId]);
        $team = $stmt->fetch();
        
        if (!$team) {
            error_log("removeTeamMember: Team $teamId does not exist");
            http_response_code(404);
            echo json_encode(['message' => 'Team not found']);
            return;
        }
        
        error_log("removeTeamMember: Working with team: {$team['name']} (ID: {$team['id']})");
        
        // Check if team member exists
        $stmt = $conn->prepare("SELECT tm.id, u.full_name FROM team_members tm LEFT JOIN users u ON tm.user_id = u.id WHERE tm.team_id = ? AND tm.user_id = ?");
        $stmt->execute([$teamId, $userId]);
        $member = $stmt->fetch();
        
        error_log("removeTeamMember: Team member query result: " . json_encode($member));
        
        if (!$member) {
            error_log("removeTeamMember: Team member not found in database");
            http_response_code(404);
            echo json_encode(['message' => 'Team member not found']);
            return;
        }
        
        error_log("removeTeamMember: Found member to remove: {$member['full_name']} (member_id: {$member['id']})");
        
        // Remove team member
        $stmt = $conn->prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?");
        $stmt->execute([$teamId, $userId]);
        $rowCount = $stmt->rowCount();
        
        error_log("removeTeamMember: DELETE affected $rowCount rows");
        
        if ($rowCount > 0) {
            error_log("removeTeamMember: SUCCESS - Team member removed");
            
            // Auto-cleanup: Check if user is part of any other teams
            // If not, remove them from the system entirely (except admins)
            try {
                // First check if user is an admin (never remove admins)
                $adminCheckStmt = $conn->prepare("SELECT role FROM users WHERE id = ?");
                $adminCheckStmt->execute([$userId]);
                $userRole = $adminCheckStmt->fetch()['role'] ?? '';
                
                if ($userRole === 'ADMIN') {
                    error_log("removeTeamMember: Skipping auto-cleanup for admin user $userId");
                    echo json_encode([
                        'message' => 'Team member removed successfully',
                        'removed_member' => $member['full_name'],
                        'team_name' => $team['name'],
                        'note' => 'Admin users are preserved in the system'
                    ]);
                    return;
                }
                
                $checkTeamsStmt = $conn->prepare("SELECT COUNT(*) as team_count FROM team_members WHERE user_id = ?");
                $checkTeamsStmt->execute([$userId]);
                $teamCountResult = $checkTeamsStmt->fetch();
                $remainingTeams = $teamCountResult['team_count'];
                
                error_log("removeTeamMember: User $userId has $remainingTeams remaining team memberships");
                
                if ($remainingTeams == 0) {
                    error_log("removeTeamMember: Auto-cleanup triggered - User $userId has no team memberships left");
                    
                    // Remove user from system since they're not part of any team
                    // First, get user details for logging
                    $userStmt = $conn->prepare("SELECT email, full_name FROM users WHERE id = ?");
                    $userStmt->execute([$userId]);
                    $userDetails = $userStmt->fetch();
                    
                    if ($userDetails) {
                        // Remove user account
                        $deleteUserStmt = $conn->prepare("DELETE FROM users WHERE id = ?");
                        $deleteUserStmt->execute([$userId]);
                        $deletedRows = $deleteUserStmt->rowCount();
                        
                        if ($deletedRows > 0) {
                            error_log("removeTeamMember: Auto-cleanup SUCCESS - User '{$userDetails['full_name']}' ({$userDetails['email']}) removed from system");
                            
                            echo json_encode([
                                'message' => 'Team member removed successfully. User removed from system as they were not part of any other teams.',
                                'removed_member' => $member['full_name'],
                                'team_name' => $team['name'],
                                'user_removed_from_system' => true,
                                'removed_user_email' => $userDetails['email']
                            ]);
                        } else {
                            error_log("removeTeamMember: Auto-cleanup FAILED - Could not remove user from system");
                            // Still report success for team removal
                            echo json_encode([
                                'message' => 'Team member removed successfully, but failed to remove user from system',
                                'removed_member' => $member['full_name'],
                                'team_name' => $team['name'],
                                'user_removed_from_system' => false
                            ]);
                        }
                    } else {
                        error_log("removeTeamMember: Auto-cleanup FAILED - User details not found");
                        echo json_encode([
                            'message' => 'Team member removed successfully',
                            'removed_member' => $member['full_name'],
                            'team_name' => $team['name']
                        ]);
                    }
                } else {
                    error_log("removeTeamMember: No auto-cleanup needed - User still has $remainingTeams team memberships");
                    echo json_encode([
                        'message' => 'Team member removed successfully',
                        'removed_member' => $member['full_name'],
                        'team_name' => $team['name']
                    ]);
                }
            } catch (PDOException $cleanupError) {
                error_log("removeTeamMember: Auto-cleanup check failed: " . $cleanupError->getMessage());
                // Still report success for the main team removal
                echo json_encode([
                    'message' => 'Team member removed successfully',
                    'removed_member' => $member['full_name'],
                    'team_name' => $team['name']
                ]);
            }
        } else {
            error_log("removeTeamMember: DELETE failed - no rows affected");
            http_response_code(500);
            echo json_encode(['message' => 'Failed to remove team member']);
        }
        
    } catch (PDOException $e) {
        error_log("removeTeamMember: Database error: " . $e->getMessage());
        error_log("removeTeamMember: SQL Error Code: " . $e->getCode());
        error_log("removeTeamMember: Full exception: " . $e);
        http_response_code(500);
        echo json_encode(['message' => 'Database error occurred']);
    } catch (Exception $e) {
        error_log("removeTeamMember: General error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'An error occurred while removing team member']);
    }
    
    error_log("=== removeTeamMember END ===");
}

function updateTeamMemberRole($conn, $teamId, $userId) {
    // Log the incoming request
    error_log("=== updateTeamMemberRole START ===");
    error_log("teamId: $teamId, userId: $userId");
    
    if (!isset($_SESSION['user_id'])) {
        error_log("Not authenticated - no session user_id");
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    error_log("Session user_id: " . $_SESSION['user_id']);
    
    // Check if user has admin or scrum master role
    $stmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    
    if (!$user || !in_array($user['user_role'], ['ADMIN', 'SCRUM_MASTER'])) {
        error_log("Permission denied - user role: " . ($user['user_role'] ?? 'null'));
        http_response_code(403);
        echo json_encode(['message' => 'Only administrators or scrum masters can update member roles']);
        return;
    }
    
    error_log("User has permission: " . $user['user_role']);
    
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    error_log("Raw input: " . $rawInput);
    error_log("Parsed input: " . json_encode($input));
    
    if (!isset($input['role'])) {
        error_log("Role is missing from input");
        http_response_code(400);
        echo json_encode(['message' => 'Role is required']);
        return;
    }
    
    $role = trim($input['role']);
    error_log("Role received: '$role' (length: " . strlen($role) . ")");

    // Only accept exact database enum values - match database schema exactly
    $validRoles = ['ADMIN', 'MANAGER', 'LEAD', 'MEMBER', 'VIEWER', 'SCRUM_MASTER'];
    error_log("Valid roles: " . json_encode($validRoles));
    
    if (!in_array($role, $validRoles)) {
        error_log("Invalid role detected: '$role'");
        http_response_code(400);
        echo json_encode(['message' => 'Invalid role: ' . $role . '. Valid roles: ' . implode(', ', $validRoles)]);
        return;
    }
    
    error_log("Role is valid: '$role'");
    
    try {
        // Check if team member exists
        $stmt = $conn->prepare("SELECT id, role FROM team_members WHERE team_id = ? AND user_id = ?");
        $stmt->execute([$teamId, $userId]);
        $member = $stmt->fetch();
        
        if (!$member) {
            error_log("Team member not found - teamId: $teamId, userId: $userId");
            http_response_code(404);
            echo json_encode(['message' => 'Team member not found']);
            return;
        }
        
        error_log("Current member role: '" . $member['role'] . "'");
        error_log("New role: '$role'");
        
        // Check if the role is actually different
        if ($member['role'] === $role) {
            error_log("Role is already the same, returning success");
            echo json_encode(['message' => 'Team member role updated successfully', 'role' => $role]);
            return;
        }
        
        // Update team member role
        error_log("Executing UPDATE query...");
        $stmt = $conn->prepare("UPDATE team_members SET role = ?, updated_at = NOW() WHERE team_id = ? AND user_id = ?");
        $result = $stmt->execute([$role, $teamId, $userId]);
        
        error_log("Query executed. Result: " . ($result ? 'true' : 'false'));
        error_log("Rows affected: " . $stmt->rowCount());
        
        if ($result) {
            error_log("SUCCESS: Role updated successfully");
            echo json_encode(['message' => 'Team member role updated successfully', 'role' => $role]);
        } else {
            error_log("FAILURE: Query executed but returned false");
            http_response_code(500);
            echo json_encode(['message' => 'Failed to update role']);
        }
        
    } catch (PDOException $e) {
        error_log("PDO Exception: " . $e->getMessage());
        error_log("Error Code: " . $e->getCode());
        error_log("SQL State: " . $e->errorInfo[0] ?? 'unknown');
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    } catch (Exception $e) {
        error_log("General Exception: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Server error: ' . $e->getMessage()]);
    }
    
    error_log("=== updateTeamMemberRole END ===");
}

function deleteTeam($conn, $teamId) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    // Check if user has admin role
    $stmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    
    if (!$user || $user['user_role'] !== 'ADMIN') {
        http_response_code(403);
        echo json_encode(['message' => 'Only administrators can delete teams']);
        return;
    }
    
    try {
        // Check if team exists
        $stmt = $conn->prepare("SELECT id, name FROM teams WHERE id = ?");
        $stmt->execute([$teamId]);
        $team = $stmt->fetch();
        
        if (!$team) {
            http_response_code(404);
            echo json_encode(['message' => 'Team not found']);
            return;
        }
        
        // Check if team has associated projects
        $stmt = $conn->prepare("SELECT COUNT(*) as project_count FROM projects WHERE team_id = ?");
        $stmt->execute([$teamId]);
        $projectCount = $stmt->fetch()['project_count'];
        
        if ($projectCount > 0) {
            http_response_code(400);
            echo json_encode([
                'message' => 'Cannot delete team with associated projects',
                'details' => "This team has {$projectCount} project(s). Please reassign or delete the projects first."
            ]);
            return;
        }
        
        // Begin transaction
        $conn->beginTransaction();
        
        try {
            // Delete team members first (foreign key constraint)
            $stmt = $conn->prepare("DELETE FROM team_members WHERE team_id = ?");
            $stmt->execute([$teamId]);
            
            // Delete the team
            $stmt = $conn->prepare("DELETE FROM teams WHERE id = ?");
            $stmt->execute([$teamId]);
            
            if ($stmt->rowCount() > 0) {
                $conn->commit();
                echo json_encode([
                    'message' => 'Team deleted successfully',
                    'teamName' => $team['name']
                ]);
            } else {
                $conn->rollback();
                http_response_code(404);
                echo json_encode(['message' => 'Team not found']);
            }
            
        } catch (PDOException $e) {
            $conn->rollback();
            throw $e;
        }
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}
?>