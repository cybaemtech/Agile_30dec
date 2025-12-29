<?php
require_once 'config/cors.php';
require_once 'config/database.php';

session_start();

$database = new Database();
$conn = $database->getConnection();

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

switch ($method . ':' . $path) {
    case 'GET:':
    case 'GET:/':
        getAllWorkItems($conn);
        break;
    
    case 'POST:':
    case 'POST:/':
        createWorkItem($conn);
        break;
    
    default:
        if (preg_match('/^\/(\d+)$/', $path, $matches)) {
            $workItemId = $matches[1];
            if ($method === 'GET') {
                getWorkItem($conn, $workItemId);
            } elseif ($method === 'PATCH') {
                $input = json_decode(file_get_contents('php://input'), true);
                if ($input === null) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid JSON data']);
                    exit;
                }
                
                try {
                    $success = updateWorkItem($conn, $workItemId, $input);
                    if ($success) {
                        // Fetch and return the updated work item
                        getWorkItem($conn, $workItemId);
                    } else {
                        http_response_code(500);
                        echo json_encode(['message' => 'Failed to update work item']);
                    }
                } catch (Exception $e) {
                    error_log("Exception in updateWorkItem: " . $e->getMessage());
                    http_response_code(400);
                    echo json_encode(['error' => $e->getMessage()]);
                }
            } elseif ($method === 'DELETE') {
                deleteWorkItem($conn, $workItemId);
            }
        } else {
            http_response_code(404);
            echo json_encode(['message' => 'Endpoint not found']);
        }
        break;
}

function getAllWorkItems($conn) {
    try {
        // Check for either last_updated_by or updated_by column
        $checkLastUpdatedBy = $conn->query("SHOW COLUMNS FROM work_items LIKE 'last_updated_by'");
        $hasLastUpdatedBy = $checkLastUpdatedBy->rowCount() > 0;
        
        $checkUpdatedBy = $conn->query("SHOW COLUMNS FROM work_items LIKE 'updated_by'");
        $hasUpdatedBy = $checkUpdatedBy->rowCount() > 0;
        
        if ($hasLastUpdatedBy) {
            // Use last_updated_by column if it exists (preferred)
            $stmt = $conn->prepare("
                SELECT 
                    wi.id,
                    wi.external_id as externalId,
                    wi.title,
                    wi.description,
                    wi.tags,
                    wi.type,
                    wi.status,
                    wi.priority,
                    wi.project_id as projectId,
                    wi.parent_id as parentId,
                    wi.assignee_id as assigneeId,
                    wi.reporter_id as reporterId,
                    wi.last_updated_by as updatedBy,
                    wi.estimate,
                    wi.start_date as startDate,
                    wi.end_date as endDate,
                    wi.github_url as githubUrl,
                    wi.bug_type as bugType,
                    wi.severity,
                    wi.reference_url as referenceUrl,
                    wi.screenshot,
                    wi.completed_at as completedAt,
                    wi.created_at as createdAt,
                    wi.updated_at as updatedAt,
                    p.name as projectName,
                    p.`key` as projectKey,
                    assignee.full_name as assigneeName,
                    reporter.full_name as reporterName,
                    creator.full_name as createdByName,
                    creator.email as createdByEmail,
                    creator.username as createdByUsername,
                    updater.full_name as updatedByName
                FROM work_items wi
                LEFT JOIN projects p ON wi.project_id = p.id
                LEFT JOIN users assignee ON wi.assignee_id = assignee.id
                LEFT JOIN users reporter ON wi.reporter_id = reporter.id
                LEFT JOIN users creator ON wi.reporter_id = creator.id
                LEFT JOIN users updater ON wi.last_updated_by = updater.id
                ORDER BY wi.updated_at DESC
            ");
        } elseif ($hasUpdatedBy) {
            // Use updated_by column if it exists (fallback)
            $stmt = $conn->prepare("
                SELECT 
                    wi.id,
                    wi.external_id as externalId,
                    wi.title,
                    wi.description,
                    wi.tags,
                    wi.type,
                    wi.status,
                    wi.priority,
                    wi.project_id as projectId,
                    wi.parent_id as parentId,
                    wi.assignee_id as assigneeId,
                    wi.reporter_id as reporterId,
                    wi.updated_by as updatedBy,
                    wi.estimate,
                    wi.start_date as startDate,
                    wi.end_date as endDate,
                    wi.github_url as githubUrl,
                    wi.bug_type as bugType,
                    wi.severity,
                    wi.reference_url as referenceUrl,
                    wi.screenshot,
                    wi.completed_at as completedAt,
                    wi.created_at as createdAt,
                    wi.updated_at as updatedAt,
                    p.name as projectName,
                    p.`key` as projectKey,
                    assignee.full_name as assigneeName,
                    reporter.full_name as reporterName,
                    creator.full_name as createdByName,
                    creator.email as createdByEmail,
                    creator.username as createdByUsername,
                    updater.full_name as updatedByName
                FROM work_items wi
                LEFT JOIN projects p ON wi.project_id = p.id
                LEFT JOIN users assignee ON wi.assignee_id = assignee.id
                LEFT JOIN users reporter ON wi.reporter_id = reporter.id
                LEFT JOIN users creator ON wi.reporter_id = creator.id
                LEFT JOIN users updater ON wi.updated_by = updater.id
                ORDER BY wi.updated_at DESC
            ");
        } else {
            // Fallback to using reporter_id as updater if neither field exists
            $stmt = $conn->prepare("
                SELECT 
                    wi.id,
                    wi.external_id as externalId,
                    wi.title,
                    wi.description,
                    wi.tags,
                    wi.type,
                    wi.status,
                    wi.priority,
                    wi.project_id as projectId,
                    wi.parent_id as parentId,
                    wi.assignee_id as assigneeId,
                    wi.reporter_id as reporterId,
                    wi.reporter_id as updatedBy,
                    wi.estimate,
                    wi.start_date as startDate,
                    wi.end_date as endDate,
                    wi.github_url as githubUrl,
                    wi.bug_type as bugType,
                    wi.severity,
                    wi.reference_url as referenceUrl,
                    wi.screenshot,
                    wi.completed_at as completedAt,
                    wi.created_at as createdAt,
                    wi.updated_at as updatedAt,
                    p.name as projectName,
                    p.`key` as projectKey,
                    assignee.full_name as assigneeName,
                    reporter.full_name as reporterName,
                    reporter.full_name as createdByName,
                    reporter.email as createdByEmail,
                    reporter.username as createdByUsername,
                    reporter.full_name as updatedByName
                FROM work_items wi
                LEFT JOIN projects p ON wi.project_id = p.id
                LEFT JOIN users assignee ON wi.assignee_id = assignee.id
                LEFT JOIN users reporter ON wi.reporter_id = reporter.id
                ORDER BY wi.updated_at DESC
            ");
        }
        
        $stmt->execute();
        $workItems = $stmt->fetchAll();
        
        // Format response for frontend
        $workItems = array_map(function($item) {
            $screenshot = null;
            if (isset($item['screenshot_blob']) && $item['screenshot_blob']) {
                $screenshot = 'data:image/png;base64,' . base64_encode($item['screenshot_blob']);
            } elseif (isset($item['screenshot_path']) && $item['screenshot_path']) {
                $screenshot = $item['screenshot_path'];
            } elseif (isset($item['screenshot']) && $item['screenshot']) {
                $screenshot = $item['screenshot'];
            }
            return [
                'id' => (int)$item['id'],
                'externalId' => $item['externalId'],
                'title' => $item['title'],
                'description' => $item['description'],
                'tags' => $item['tags'],
                'type' => $item['type'],
                'status' => $item['status'],
                'priority' => $item['priority'],
                'projectId' => (int)$item['projectId'],
                'parentId' => $item['parentId'] ? (int)$item['parentId'] : null,
                'assigneeId' => $item['assigneeId'] ? (int)$item['assigneeId'] : null,
                'reporterId' => $item['reporterId'] ? (int)$item['reporterId'] : null,
                'updatedBy' => $item['updatedBy'] ? (int)$item['updatedBy'] : null,
                'estimate' => $item['estimate'] ? (int)$item['estimate'] : null,
                'startDate' => $item['startDate'],
                'endDate' => $item['endDate'],
                'githubUrl' => $item['githubUrl'],
                'bugType' => $item['bugType'] ?? null,
                'severity' => $item['severity'] ?? null,
                'referenceUrl' => $item['referenceUrl'] ?? null,
                'currentBehavior' => isset($item['currentBehavior']) ? $item['currentBehavior'] : (isset($item['current_behavior']) ? $item['current_behavior'] : null),
                'expectedBehavior' => isset($item['expectedBehavior']) ? $item['expectedBehavior'] : (isset($item['expected_behavior']) ? $item['expected_behavior'] : null),
                'screenshot' => $screenshot,
                'completedAt' => $item['completedAt'],
                'createdAt' => $item['createdAt'],
                'updatedAt' => $item['updatedAt'],
                'projectName' => $item['projectName'],
                'projectKey' => $item['projectKey'],
                'assigneeName' => $item['assigneeName'],
                'reporterName' => $item['reporterName'],
                'createdByName' => $item['createdByName'] ?? $item['reporterName'] ?? 'Unknown User',
                'createdByEmail' => $item['createdByEmail'] ?? 'unknown@example.com',
                'createdByUsername' => $item['createdByUsername'] ?? 'unknown',
                'updatedByName' => $item['updatedByName'] ?? $item['reporterName'] ?? 'Unknown User'
            ];
        }, $workItems);
        
        echo json_encode($workItems);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function getWorkItem($conn, $workItemId) {
    try {
        // Check for either last_updated_by or updated_by column
        $checkLastUpdatedBy = $conn->query("SHOW COLUMNS FROM work_items LIKE 'last_updated_by'");
        $hasLastUpdatedBy = $checkLastUpdatedBy->rowCount() > 0;
        
        $checkUpdatedBy = $conn->query("SHOW COLUMNS FROM work_items LIKE 'updated_by'");
        $hasUpdatedBy = $checkUpdatedBy->rowCount() > 0;
        
        if ($hasLastUpdatedBy) {
            // Use last_updated_by column if it exists (preferred)
            $stmt = $conn->prepare("
                SELECT 
                    wi.id,
                    wi.external_id as externalId,
                    wi.title,
                    wi.description,
                    wi.tags,
                    wi.type,
                    wi.status,
                    wi.priority,
                    wi.project_id as projectId,
                    wi.parent_id as parentId,
                    wi.assignee_id as assigneeId,
                    wi.reporter_id as reporterId,
                    wi.last_updated_by as updatedBy,
                    wi.estimate,
                    wi.start_date as startDate,
                    wi.end_date as endDate,
                    wi.github_url as githubUrl,
                    wi.bug_type as bugType,
                    wi.severity,
                    wi.reference_url as referenceUrl,
                    wi.screenshot,
                    wi.completed_at as completedAt,
                    wi.created_at as createdAt,
                    wi.updated_at as updatedAt,
                    creator.full_name as createdByName,
                    creator.email as createdByEmail,
                    creator.username as createdByUsername,
                    updater.full_name as updatedByName
                FROM work_items wi
                LEFT JOIN users creator ON wi.reporter_id = creator.id
                LEFT JOIN users updater ON wi.last_updated_by = updater.id
                WHERE wi.id = ?
            ");
        } elseif ($hasUpdatedBy) {
        } elseif ($hasUpdatedBy) {
            // Use updated_by column if it exists (fallback)
            $stmt = $conn->prepare("
                SELECT 
                    wi.id,
                    wi.external_id as externalId,
                    wi.title,
                    wi.description,
                    wi.tags,
                    wi.type,
                    wi.status,
                    wi.priority,
                    wi.project_id as projectId,
                    wi.parent_id as parentId,
                    wi.assignee_id as assigneeId,
                    wi.reporter_id as reporterId,
                    wi.updated_by as updatedBy,
                    wi.estimate,
                    wi.start_date as startDate,
                    wi.end_date as endDate,
                    wi.github_url as githubUrl,
                    wi.bug_type as bugType,
                    wi.severity,
                    wi.reference_url as referenceUrl,
                    wi.screenshot,
                    wi.completed_at as completedAt,
                    wi.created_at as createdAt,
                    wi.updated_at as updatedAt,
                    creator.full_name as createdByName,
                    creator.email as createdByEmail,
                    creator.username as createdByUsername,
                    updater.full_name as updatedByName
                FROM work_items wi
                LEFT JOIN users creator ON wi.reporter_id = creator.id
                LEFT JOIN users updater ON wi.updated_by = updater.id
                WHERE wi.id = ?
            ");
        } else {
            // Fallback to using reporter_id as updater
            $stmt = $conn->prepare("
                SELECT 
                    wi.id,
                    wi.external_id as externalId,
                    wi.title,
                    wi.description,
                    wi.tags,
                    wi.type,
                    wi.status,
                    wi.priority,
                    wi.project_id as projectId,
                    wi.parent_id as parentId,
                    wi.assignee_id as assigneeId,
                    wi.reporter_id as reporterId,
                    wi.reporter_id as updatedBy,
                    wi.estimate,
                    wi.start_date as startDate,
                    wi.end_date as endDate,
                    wi.github_url as githubUrl,
                    wi.bug_type as bugType,
                    wi.severity,
                    wi.reference_url as referenceUrl,
                    wi.screenshot,
                    wi.completed_at as completedAt,
                    wi.created_at as createdAt,
                    wi.updated_at as updatedAt,
                    reporter.full_name as createdByName,
                    reporter.email as createdByEmail,
                    reporter.username as createdByUsername,
                    reporter.full_name as updatedByName
                FROM work_items wi
                LEFT JOIN users reporter ON wi.reporter_id = reporter.id
                WHERE wi.id = ?
            ");
        }
        
        $stmt->execute([$workItemId]);
        $item = $stmt->fetch();
        
        if (!$item) {
            http_response_code(404);
            echo json_encode(['message' => 'Work item not found']);
            return;
        }
        
        $screenshot = null;
        if (isset($item['screenshot_blob']) && $item['screenshot_blob']) {
            $screenshot = 'data:image/png;base64,' . base64_encode($item['screenshot_blob']);
        } elseif (isset($item['screenshot_path']) && $item['screenshot_path']) {
            $screenshot = $item['screenshot_path'];
        } elseif (isset($item['screenshot']) && $item['screenshot']) {
            $screenshot = $item['screenshot'];
        }
        $workItem = [
            'id' => (int)$item['id'],
            'externalId' => $item['externalId'],
            'title' => $item['title'],
            'description' => $item['description'],
            'tags' => $item['tags'],
            'type' => $item['type'],
            'status' => $item['status'],
            'priority' => $item['priority'],
            'projectId' => (int)$item['projectId'],
            'parentId' => $item['parentId'] ? (int)$item['parentId'] : null,
            'assigneeId' => $item['assigneeId'] ? (int)$item['assigneeId'] : null,
            'reporterId' => $item['reporterId'] ? (int)$item['reporterId'] : null,
            'updatedBy' => $item['updatedBy'] ? (int)$item['updatedBy'] : null,
            'estimate' => $item['estimate'] ? (int)$item['estimate'] : null,
            'startDate' => $item['startDate'],
            'endDate' => $item['endDate'],
            'githubUrl' => $item['githubUrl'],
            'bugType' => $item['bugType'] ?? null,
            'severity' => $item['severity'] ?? null,
            'referenceUrl' => $item['referenceUrl'] ?? null,
            // Always return camelCase for frontend
            'currentBehavior' => isset($item['currentBehavior']) ? $item['currentBehavior'] : (isset($item['current_behavior']) ? $item['current_behavior'] : null),
            'expectedBehavior' => isset($item['expectedBehavior']) ? $item['expectedBehavior'] : (isset($item['expected_behavior']) ? $item['expected_behavior'] : null),
            'screenshot' => $screenshot,
            'completedAt' => $item['completedAt'],
            'createdAt' => $item['createdAt'],
            'updatedAt' => $item['updatedAt'],
            'createdByName' => $item['createdByName'] ?? 'Unknown User',
            'createdByEmail' => $item['createdByEmail'] ?? 'unknown@example.com',
            'createdByUsername' => $item['createdByUsername'] ?? 'unknown',
            'updatedByName' => $item['updatedByName'] ?? 'Unknown User'
        ];
            // Debug log for bug fields (correct location)
            error_log("=== GET WORK ITEM DEBUG ===");
            error_log("WorkItem ID: " . $workItemId);
            error_log("currentBehavior: " . var_export($workItem['currentBehavior'], true));
            error_log("expectedBehavior: " . var_export($workItem['expectedBehavior'], true));
            error_log("bugType: " . var_export($workItem['bugType'], true));
            error_log("severity: " . var_export($workItem['severity'], true));
        echo json_encode($workItem);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}

function createWorkItem($conn) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }

    // Support both JSON and multipart/form-data
    $isMultipart = false;
    if (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false) {
        $isMultipart = true;
    }

    if ($isMultipart) {
        $input = $_POST;
        // File upload
        $screenshotBlob = null;
        if (isset($_FILES['screenshot']) && $_FILES['screenshot']['error'] === UPLOAD_ERR_OK) {
            $screenshotBlob = file_get_contents($_FILES['screenshot']['tmp_name']);
        }
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
        $screenshotBlob = null;
        // If screenshot is present and looks like a data URL, decode and store as binary
        if (isset($input['screenshot']) && is_string($input['screenshot']) && strpos($input['screenshot'], 'base64,') !== false) {
            $base64 = explode('base64,', $input['screenshot'], 2)[1] ?? '';
            $screenshotBlob = base64_decode($base64);
            // Remove screenshot from input so it doesn't get stored in the text column
            $input['screenshot'] = null;
        }
    }

    // Debug logging
    error_log("=== CREATE WORK ITEM DEBUG ===");
    error_log("Session user_id: " . ($_SESSION['user_id'] ?? 'NOT SET'));
    error_log("Raw input: " . json_encode($input));

    // Validate required fields
    if (!isset($input['title']) || !isset($input['type']) || !isset($input['projectId'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Title, type, and projectId are required']);
        return;
    }

    $title = trim($input['title']);
    $type = trim($input['type']);
    $projectId = (int)$input['projectId'];

    if (empty($title) || empty($type) || $projectId <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid input data']);
        return;
    }

    // Check user role and restrict EPIC/FEATURE creation to ADMIN and SCRUM_MASTER only
    $userStmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
    $userStmt->execute([$_SESSION['user_id']]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['message' => 'User not found']);
        return;
    }

    $userRole = $user['user_role'];

    // Restrict EPIC and FEATURE creation to ADMIN and SCRUM_MASTER only
    if (($type === 'EPIC' || $type === 'FEATURE') && 
        ($userRole !== 'ADMIN' && $userRole !== 'SCRUM_MASTER')) {
        http_response_code(403);
        echo json_encode(['message' => 'Only Admin and Scrum Master users can create Epic and Feature items']);
        return;
    }

    try {
        // Debug logging
        error_log("=== CREATE WORK ITEM DEBUG ===");
        error_log("Session user_id: " . $_SESSION['user_id']);
        error_log("Project ID: " . $projectId);
        error_log("Title: " . $title);
        error_log("Type: " . $type);

        // Get project key for external ID generation
        $stmt = $conn->prepare("SELECT `key` FROM projects WHERE id = ?");
        $stmt->execute([$projectId]);
        $project = $stmt->fetch();

        if (!$project) {
            http_response_code(404);
            echo json_encode(['message' => 'Project not found']);
            return;
        }

        // Generate unique external ID (e.g., PROJ-001)
        // Get the highest existing number for this project key
        $stmt = $conn->prepare("
            SELECT external_id 
            FROM work_items 
            WHERE project_id = ? 
            AND external_id LIKE CONCAT(?, '-%')
            ORDER BY 
                CAST(SUBSTRING(external_id, LENGTH(?) + 2) AS UNSIGNED) DESC 
            LIMIT 1
        ");
        $stmt->execute([$projectId, $project['key'], $project['key']]);
        $lastItem = $stmt->fetch();

        if ($lastItem) {
            // Extract number from last external ID and increment
            $lastExternalId = $lastItem['external_id'];
            $lastNumber = (int)substr($lastExternalId, strlen($project['key']) + 1);
            $nextNumber = $lastNumber + 1;
        } else {
            // First item for this project
            $nextNumber = 1;
        }

        // Generate external ID with zero padding
        $externalId = $project['key'] . '-' . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);

        // Double-check uniqueness (in case of race conditions)
        $stmt = $conn->prepare("SELECT id FROM work_items WHERE external_id = ?");
            // Debug log for bug fields (correct location)
            error_log("=== GET WORK ITEM DEBUG ===");
            error_log("WorkItem ID: " . $workItemId);
            error_log("currentBehavior: " . var_export($workItem['currentBehavior'], true));
            error_log("expectedBehavior: " . var_export($workItem['expectedBehavior'], true));
            error_log("bugType: " . var_export($workItem['bugType'], true));
            error_log("severity: " . var_export($workItem['severity'], true));
        $stmt->execute([$externalId]);
        if ($stmt->fetch()) {
            // If still duplicate, use timestamp-based fallback
            $externalId = $project['key'] . '-' . str_pad($nextNumber, 3, '0', STR_PAD_LEFT) . '-' . time();
        }

        error_log("Generated external ID: " . $externalId);

        // Prepare all fields for all item types, always send all expected fields
        $description = isset($input['description']) ? trim($input['description']) : null;
        $tags = isset($input['tags']) ? trim($input['tags']) : null;
        $status = isset($input['status']) ? trim($input['status']) : 'TODO';
        $priority = isset($input['priority']) ? trim($input['priority']) : 'MEDIUM';
        $parentId = isset($input['parentId']) && $input['parentId'] > 0 ? (int)$input['parentId'] : null;
        $assigneeId = isset($input['assigneeId']) && $input['assigneeId'] > 0 ? (int)$input['assigneeId'] : null;
        $reporterId = isset($input['reporterId']) && $input['reporterId'] > 0 ? (int)$input['reporterId'] : $_SESSION['user_id'];
        $estimate = isset($input['estimate']) && $input['estimate'] !== null && $input['estimate'] !== '' ? (float)$input['estimate'] : null;
                // Debug log for bug fields
                error_log("=== GET WORK ITEM DEBUG ===");
                error_log("WorkItem ID: " . $workItemId);
                error_log("currentBehavior: " . var_export($workItem['currentBehavior'], true));
                error_log("expectedBehavior: " . var_export($workItem['expectedBehavior'], true));
                error_log("bugType: " . var_export($workItem['bugType'], true));
                error_log("severity: " . var_export($workItem['severity'], true));
        $githubUrl = isset($input['githubUrl']) ? trim($input['githubUrl']) : null;
        $bugType = array_key_exists('bugType', $input) ? trim((string)$input['bugType']) : null;
        $severity = array_key_exists('severity', $input) ? trim((string)$input['severity']) : null;
        $referenceUrl = array_key_exists('referenceUrl', $input) ? trim((string)$input['referenceUrl']) : null;
        $screenshot = array_key_exists('screenshot', $input) ? trim((string)$input['screenshot']) : null;
        $estimatedHours = array_key_exists('estimatedHours', $input) ? (float)$input['estimatedHours'] : null;
        $actualHours = array_key_exists('actualHours', $input) ? (float)$input['actualHours'] : null;
        $currentBehavior = array_key_exists('currentBehavior', $input) ? trim((string)$input['currentBehavior']) : null;
        $expectedBehavior = array_key_exists('expectedBehavior', $input) ? trim((string)$input['expectedBehavior']) : null;
        $startDate = null;
        $endDate = null;

        // Handle dates with improved validation
        if (isset($input['startDate']) && !empty($input['startDate']) && $input['startDate'] !== null) {
            error_log("Processing startDate: " . $input['startDate']);
            try {
                // Handle both YYYY-MM-DD and full datetime formats
                if (strlen($input['startDate']) === 10) {
                    // Date only format (YYYY-MM-DD) - add time
                    $startDate = $input['startDate'] . ' 00:00:00';
                } else {
                    // Full datetime format
                    $startDate = date('Y-m-d H:i:s', strtotime($input['startDate']));
                }
                error_log("Processed startDate: " . $startDate);
            } catch (Exception $e) {
                error_log("Error processing startDate: " . $e->getMessage());
                $startDate = null;
            }
        }

        if (isset($input['endDate']) && !empty($input['endDate']) && $input['endDate'] !== null) {
            error_log("Processing endDate: " . $input['endDate']);
            try {
                // Handle both YYYY-MM-DD and full datetime formats
                if (strlen($input['endDate']) === 10) {
                    // Date only format (YYYY-MM-DD) - add time
                    $endDate = $input['endDate'] . ' 23:59:59';
                } else {
                    // Full datetime format
                    $endDate = date('Y-m-d H:i:s', strtotime($input['endDate']));
                }
                error_log("Processed endDate: " . $endDate);
            } catch (Exception $e) {
                error_log("Error processing endDate: " . $e->getMessage());
                $endDate = null;
            }
        }

        // Insert work item with proper updated_by tracking
        // Add screenshot_blob to insert if present
        error_log("Preparing to insert work item with data:");
        error_log("External ID: " . $externalId);
        error_log("Title: " . $title);
        error_log("Description: " . $description);
        error_log("Tags: " . $tags);
        error_log("Type: " . $type);
        error_log("Status: " . $status);
        error_log("Priority: " . $priority);
        error_log("Project ID: " . $projectId);
        error_log("Parent ID: " . $parentId);
        error_log("Assignee ID: " . $assigneeId);
        error_log("Reporter ID: " . $reporterId);
        error_log("Estimate: " . $estimate);
        error_log("Start Date: " . $startDate);
        error_log("End Date: " . $endDate);

        // Check for either last_updated_by or updated_by column
        try {
            $checkLastUpdatedBy = $conn->query("SHOW COLUMNS FROM work_items LIKE 'last_updated_by'");
            $hasLastUpdatedBy = $checkLastUpdatedBy->rowCount() > 0;

            $checkUpdatedBy = $conn->query("SHOW COLUMNS FROM work_items LIKE 'updated_by'");
            $hasUpdatedBy = $checkUpdatedBy->rowCount() > 0;
        } catch (PDOException $e) {
            $hasLastUpdatedBy = false;
            $hasUpdatedBy = false;
        }

        // Only use columns that exist in the schema, and match parameter count/order
        if ($hasLastUpdatedBy) {
            $stmt = $conn->prepare("
                INSERT INTO work_items (
                    external_id, title, description, tags, type, status, priority,
                    project_id, parent_id, assignee_id, reporter_id, last_updated_by, estimate,
                    start_date, end_date, completed_at, github_url, bug_type, current_behavior, expected_behavior,
                    severity, estimated_hours, actual_hours, reference_url, screenshot, screenshot_blob, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $executeParams = [
                $externalId, $title, $description, $tags, $type, $status, $priority,
                $projectId, $parentId, $assigneeId, $reporterId, $reporterId, $estimate,
                $startDate, $endDate, null, $githubUrl, $bugType, $currentBehavior, $expectedBehavior,
                $severity, $estimatedHours, $actualHours, $referenceUrl, null, $screenshotBlob
            ];
            error_log("Executing INSERT with parameters: " . json_encode($executeParams));
            $success = $stmt->execute($executeParams);
            if (!$success) {
                error_log("SQL execution failed: " . json_encode($stmt->errorInfo()));
            } else {
                error_log("Work item created successfully with ID: " . $conn->lastInsertId());
            }
        } elseif ($hasUpdatedBy) {
            $stmt = $conn->prepare("
                INSERT INTO work_items (
                    external_id, title, description, tags, type, status, priority,
                    project_id, parent_id, assignee_id, reporter_id, updated_by, estimate,
                    start_date, end_date, completed_at, github_url, bug_type, current_behavior, expected_behavior,
                    severity, estimated_hours, actual_hours, reference_url, screenshot, screenshot_blob, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $executeParams = [
                $externalId, $title, $description, $tags, $type, $status, $priority,
                $projectId, $parentId, $assigneeId, $reporterId, $reporterId, $estimate,
                $startDate, $endDate, null, $githubUrl, $bugType, $currentBehavior, $expectedBehavior,
                $severity, $estimatedHours, $actualHours, $referenceUrl, null, $screenshotBlob
            ];
            error_log("Executing INSERT with parameters: " . json_encode($executeParams));
            $success = $stmt->execute($executeParams);
            if (!$success) {
                error_log("SQL execution failed: " . json_encode($stmt->errorInfo()));
            } else {
                error_log("Work item created successfully with ID: " . $conn->lastInsertId());
            }
        } else {
            $stmt = $conn->prepare("
                INSERT INTO work_items (
                    external_id, title, description, tags, type, status, priority,
                    project_id, parent_id, assignee_id, reporter_id, estimate,
                    start_date, end_date, completed_at, github_url, bug_type, current_behavior, expected_behavior,
                    severity, estimated_hours, actual_hours, reference_url, screenshot, screenshot_blob, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $executeParams = [
                $externalId, $title, $description, $tags, $type, $status, $priority,
                $projectId, $parentId, $assigneeId, $reporterId, $estimate,
                $startDate, $endDate, null, $githubUrl, $bugType, $currentBehavior, $expectedBehavior,
                $severity, $estimatedHours, $actualHours, $referenceUrl, null, $screenshotBlob
            ];
            error_log("Executing INSERT with parameters: " . json_encode($executeParams));
            $success = $stmt->execute($executeParams);
            if (!$success) {
                error_log("SQL execution failed: " . json_encode($stmt->errorInfo()));
            } else {
                error_log("Work item created successfully with ID: " . $conn->lastInsertId());
            }
        }
        
        if (!$success) {
            error_log("SQL execution failed: " . json_encode($stmt->errorInfo()));
            throw new PDOException("Failed to execute INSERT statement");
        }
        
        $workItemId = $conn->lastInsertId();
        
        // Return the created work item
        $stmt = $conn->prepare("
            SELECT 
                wi.id,
                wi.external_id as externalId,
                wi.title,
                wi.description,
                wi.tags,
                wi.type,
                wi.status,
                wi.priority,
                wi.project_id as projectId,
                wi.parent_id as parentId,
                wi.assignee_id as assigneeId,
                wi.reporter_id as reporterId,
                wi.estimate,
                wi.start_date as startDate,
                wi.end_date as endDate,
                wi.completed_at as completedAt,
                wi.created_at as createdAt,
                wi.updated_at as updatedAt
            FROM work_items wi
            WHERE wi.id = ?
        ");
        $stmt->execute([$workItemId]);
        $item = $stmt->fetch();
        
        if ($item) {
            $workItem = [
                'id' => (int)$item['id'],
                'externalId' => $item['externalId'],
                'title' => $item['title'],
                'description' => $item['description'],
                'tags' => $item['tags'],
                'type' => $item['type'],
                'status' => $item['status'],
                'priority' => $item['priority'],
                'projectId' => (int)$item['projectId'],
                'parentId' => $item['parentId'] ? (int)$item['parentId'] : null,
                'assigneeId' => $item['assigneeId'] ? (int)$item['assigneeId'] : null,
                'reporterId' => $item['reporterId'] ? (int)$item['reporterId'] : null,
                'estimate' => $item['estimate'] ? (int)$item['estimate'] : null,
                'startDate' => $item['startDate'],
                'endDate' => $item['endDate'],
                'completedAt' => $item['completedAt'],
                'createdAt' => $item['createdAt'],
                'updatedAt' => $item['updatedAt']
            ];
            
            http_response_code(201);
            echo json_encode($workItem);
        } else {
            http_response_code(201);
            echo json_encode(['message' => 'Work item created successfully', 'id' => $workItemId]);
        }
        
    } catch (PDOException $e) {
        error_log("Work Items API Error: " . $e->getMessage());
        error_log("SQL Error Info: " . print_r($e->errorInfo, true));
        http_response_code(500);
        echo json_encode([
            'message' => 'Internal server error',
            'error' => $e->getMessage(),
            'debug' => $e->errorInfo
        ]);
    }
}

// Check if user can update a work item - only assignees can edit (plus admins/scrum masters)
function canUserUpdateWorkItem($pdo, $workItemId, $userId) {
    try {
        // Get user role first - admins and scrum masters can always edit
        $stmt = $pdo->prepare("SELECT user_role FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            return false;
        }
        
        // Admin and Scrum Master can always update
        if ($user['user_role'] === 'ADMIN' || $user['user_role'] === 'SCRUM_MASTER') {
            return true;
        }
        
        // Get the work item details including type
        $stmt = $pdo->prepare("
            SELECT id, assignee_id, type
            FROM work_items 
            WHERE id = ?
        ");
        $stmt->execute([$workItemId]);
        $workItem = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$workItem) {
            return false;
        }
        
        // Regular users cannot update EPIC or FEATURE items
        if ($workItem['type'] === 'EPIC' || $workItem['type'] === 'FEATURE') {
            return false;
        }
        
        // Only the assigned user can update STORY, TASK, and BUG work items
        return ($workItem['assignee_id'] == $userId);
        
    } catch (Exception $e) {
        error_log("Error checking work item permissions: " . $e->getMessage());
        return false;
    }
}

function updateWorkItem($pdo, $id, $data) {
    // Check authentication
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return false;
    }
    
    $userId = $_SESSION['user_id'];
    
    // Check if user has permission to update this work item
    if (!canUserUpdateWorkItem($pdo, $id, $userId)) {
        http_response_code(403);
        echo json_encode(['message' => 'You do not have permission to update this work item. Only the assigned user can edit this work item.']);
        return false;
    }
    
    // If user is trying to change type to EPIC or FEATURE, check role
    if (isset($data['type'])) {
        $newType = $data['type'];
        if (($newType === 'EPIC' || $newType === 'FEATURE')) {
            // Check user role
            $stmt = $pdo->prepare("SELECT user_role FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $userRole = $stmt->fetchColumn();
            
            if ($userRole !== 'ADMIN' && $userRole !== 'SCRUM_MASTER') {
                http_response_code(403);
                echo json_encode(['message' => 'Only ADMIN and SCRUM_MASTER users can change work items to EPIC or FEATURE type']);
                return false;
            }
        }
    }
    
    // Debug logging
    error_log("=== UPDATE WORK ITEM DEBUG ===");
    error_log("Work item ID: " . $id);
    error_log("User ID: " . $userId);
    error_log("Raw input data: " . json_encode($data));
    
    // Map frontend camelCase fields to backend snake_case fields
    $fieldMapping = [
        'parentId' => 'parent_id',
        'assigneeId' => 'assignee_id',
        'startDate' => 'start_date',
        'endDate' => 'end_date',
        'bugType' => 'bug_type',
        'severity' => 'severity',
        'referenceUrl' => 'reference_url',
        'screenshot' => 'screenshot',
        'estimatedHours' => 'estimated_hours',
        'actualHours' => 'actual_hours',
        'currentBehavior' => 'current_behavior',
        'expectedBehavior' => 'expected_behavior'
    ];
    
    // Convert camelCase to snake_case
    $convertedData = [];
    foreach ($data as $key => $value) {
        $dbField = isset($fieldMapping[$key]) ? $fieldMapping[$key] : $key;
        $convertedData[$dbField] = $value;
    }
    
    error_log("Converted data: " . json_encode($convertedData));
    
    $allowedFields = ['title', 'description', 'tags', 'status', 'priority', 'type', 'assignee_id', 'estimate', 'start_date', 'end_date', 'parent_id', 'bug_type', 'severity', 'reference_url', 'screenshot', 'estimated_hours', 'actual_hours', 'current_behavior', 'expected_behavior'];
    
    $updateFields = [];
    $params = [':id' => $id];
    
    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $convertedData)) {
            error_log("Processing field: " . $field . " = " . json_encode($convertedData[$field]));
            
            // Special handling for date fields
            if ($field === 'start_date' || $field === 'end_date') {
                $dateValue = $convertedData[$field];
                if ($dateValue === null || $dateValue === '' || $dateValue === 'null') {
                    $params[":$field"] = null;
                } else {
                    try {
                        // Handle both YYYY-MM-DD and full datetime formats
                        if (strlen($dateValue) === 10) {
                            // Date only format (YYYY-MM-DD) - add appropriate time
                            $params[":$field"] = $field === 'start_date' 
                                ? $dateValue . ' 00:00:00' 
                                : $dateValue . ' 23:59:59';
                        } else {
                            // Full datetime format
                            $params[":$field"] = date('Y-m-d H:i:s', strtotime($dateValue));
                        }
                        error_log("Processed $field: " . $params[":$field"]);
                    } catch (Exception $e) {
                        error_log("Error processing $field: " . $e->getMessage());
                        $params[":$field"] = null;
                    }
                }
            } else {
                $params[":$field"] = $convertedData[$field];
            }
            
            $updateFields[] = "$field = :$field";
        }
    }
    
    if (empty($updateFields)) {
        error_log("No valid fields to update");
        http_response_code(400);
        echo json_encode(['error' => 'No valid fields to update']);
        return false;
    }

    // Check for either last_updated_by or updated_by column and add tracking if possible
    try {
        $checkLastUpdatedBy = $pdo->query("SHOW COLUMNS FROM work_items LIKE 'last_updated_by'");
        $hasLastUpdatedBy = $checkLastUpdatedBy->rowCount() > 0;
        
        $checkUpdatedBy = $pdo->query("SHOW COLUMNS FROM work_items LIKE 'updated_by'");
        $hasUpdatedBy = $checkUpdatedBy->rowCount() > 0;
        
        if ($hasLastUpdatedBy && isset($_SESSION['user_id'])) {
            $updateFields[] = "last_updated_by = :last_updated_by";
            $params[':last_updated_by'] = $_SESSION['user_id'];
        } elseif ($hasUpdatedBy && isset($_SESSION['user_id'])) {
            $updateFields[] = "updated_by = :updated_by";
            $params[':updated_by'] = $_SESSION['user_id'];
        }
    } catch (PDOException $e) {
        // Ignore if we can't check the columns
        error_log("Could not check for update tracking columns: " . $e->getMessage());
    }
    
    $sql = "UPDATE work_items SET " . implode(', ', $updateFields) . ", updated_at = NOW() WHERE id = :id";
    error_log("SQL Query: " . $sql);
    error_log("SQL Parameters: " . json_encode($params));
    
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute($params);
    
    error_log("SQL execution result: " . ($result ? 'SUCCESS' : 'FAILED'));
    if (!$result) {
        error_log("SQL Error: " . json_encode($stmt->errorInfo()));
    }
    error_log("=== UPDATE WORK ITEM DEBUG END ===");
    
    return $result;
}

function deleteWorkItem($conn, $workItemId) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Not authenticated']);
        return;
    }
    
    // Check user role - only ADMIN and SCRUM_MASTER can delete work items
    $userStmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
    $userStmt->execute([$_SESSION['user_id']]);
    $userRole = $userStmt->fetch()['user_role'] ?? null;
    
    if (!in_array($userRole, ['ADMIN', 'SCRUM_MASTER'])) {
        http_response_code(403);
        echo json_encode(['message' => 'Access denied. Only administrators and scrum masters can delete work items.']);
        return;
    }
    
    try {
        // Check if work item exists and get info
        $stmt = $conn->prepare("SELECT id FROM work_items WHERE id = ?");
        $stmt->execute([$workItemId]);
        
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['message' => 'Work item not found']);
            return;
        }
        
        // Check if there are child work items
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM work_items WHERE parent_id = ?");
        $stmt->execute([$workItemId]);
        $childCount = $stmt->fetch()['count'];
        
        if ($childCount > 0) {
            http_response_code(409);
            echo json_encode(['message' => 'Cannot delete work item with child items']);
            return;
        }
        
        // Delete work item
        $stmt = $conn->prepare("DELETE FROM work_items WHERE id = ?");
        $stmt->execute([$workItemId]);
        
        if ($stmt->rowCount() > 0) {
            echo json_encode(['message' => 'Work item deleted successfully']);
        } else {
            http_response_code(404);
            echo json_encode(['message' => 'Work item not found']);
        }
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Internal server error']);
    }
}
?>