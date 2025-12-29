<?php
require_once 'config/database.php';
$database = new Database();
$conn = $database->getConnection();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $screenshotPath = null;
    
    // Handle file upload if present
    if (isset($_FILES['screenshot']) && $_FILES['screenshot']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../uploads/bug-screenshots/';
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        $maxFileSize = 5 * 1024 * 1024; // 5MB
        
        $fileType = $_FILES['screenshot']['type'];
        $fileSize = $_FILES['screenshot']['size'];
        
        if (!in_array($fileType, $allowedTypes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file type. Only JPEG, PNG, and GIF are allowed.']);
            exit;
        }
        
        if ($fileSize > $maxFileSize) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large. Maximum size is 5MB.']);
            exit;
        }
        
        // Create unique filename
        $fileExtension = pathinfo($_FILES['screenshot']['name'], PATHINFO_EXTENSION);
        $fileName = 'bug_' . time() . '_' . uniqid() . '.' . $fileExtension;
        $filePath = $uploadDir . $fileName;
        
        // Create upload directory if it doesn't exist
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        if (move_uploaded_file($_FILES['screenshot']['tmp_name'], $filePath)) {
            $screenshotPath = 'uploads/bug-screenshots/' . $fileName;
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to upload screenshot.']);
            exit;
        }
    }
    
    // Handle form data or JSON
    if (!empty($_POST)) {
        // Form data (with file upload)
        $comment = isset($_POST['comment']) ? trim($_POST['comment']) : '';
        $created_by = isset($_POST['created_by']) ? intval($_POST['created_by']) : null;
        $resolutionStatus = isset($_POST['resolutionStatus']) ? $_POST['resolutionStatus'] : 'not-resolved';
    } else {
        // JSON data (without file upload)
        $input = json_decode(file_get_contents('php://input'), true);
        $comment = isset($input['comment']) ? trim($input['comment']) : '';
        $created_by = isset($input['created_by']) ? intval($input['created_by']) : null;
        $resolutionStatus = isset($input['resolutionStatus']) ? $input['resolutionStatus'] : 'not-resolved';
    }

    if ($comment === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Comment is required.']);
        exit;
    }

    try {
        $stmt = $conn->prepare("INSERT INTO project_bug_reports (comment, created_by, resolution_status, screenshot_path) VALUES (?, ?, ?, ?)");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Prepare failed: ' . implode(' ', $conn->errorInfo())]);
            exit;
        }
        if ($stmt->execute([$comment, $created_by, $resolutionStatus, $screenshotPath])) {
            $reportId = $conn->lastInsertId();
            echo json_encode([
                'message' => 'Bug report submitted successfully.',
                'id' => $reportId,
                'screenshot_path' => $screenshotPath
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . implode(' ', $stmt->errorInfo())]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Exception: ' . $e->getMessage()]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Fetch all bug reports
    try {
        $stmt = $conn->prepare("
            SELECT 
                id, 
                comment,
                created_by, 
                created_at,
                resolution_status,
                screenshot_path
            FROM project_bug_reports 
            ORDER BY created_at DESC
        ");
        $stmt->execute();
        $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($reports);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Exception: ' . $e->getMessage()]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    // Delete a bug report (only creator can delete)
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? intval($input['id']) : null;
    $userId = isset($input['user_id']) ? intval($input['user_id']) : null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID is required for delete']);
        exit;
    }
    
    try {
        // Check if the user is the creator of this bug report
        $stmt = $conn->prepare("SELECT created_by, screenshot_path FROM project_bug_reports WHERE id = ?");
        $stmt->execute([$id]);
        $report = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$report) {
            http_response_code(404);
            echo json_encode(['error' => 'Bug report not found']);
            exit;
        }
        
        // Check user role to determine access
        $stmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $isAdminOrScrum = $user && ($user['user_role'] === 'ADMIN' || $user['user_role'] === 'SCRUM_MASTER');
        
        // Allow creator or admin/scrum master to delete
        if ($report['created_by'] != $userId && !$isAdminOrScrum) {
            http_response_code(403);
            echo json_encode(['error' => 'You can only delete your own bug reports unless you are an admin or scrum master']);
            exit;
        }
        
        // Delete the record
        $stmt = $conn->prepare("DELETE FROM project_bug_reports WHERE id = ?");
        $stmt->execute([$id]);
        
        // Delete screenshot file if exists
        if ($report['screenshot_path'] && file_exists('../' . $report['screenshot_path'])) {
            unlink('../' . $report['screenshot_path']);
        }
        
        echo json_encode(['message' => 'Deleted']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Exception: ' . $e->getMessage()]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
    // Edit a bug report (only creator can edit)
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? intval($input['id']) : null;
    $userId = isset($input['user_id']) ? intval($input['user_id']) : null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID is required for update']);
        exit;
    }

    // Check if the user is the creator of this bug report
    try {
        $stmt = $conn->prepare("SELECT created_by FROM project_bug_reports WHERE id = ?");
        $stmt->execute([$id]);
        $report = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$report) {
            http_response_code(404);
            echo json_encode(['error' => 'Bug report not found']);
            exit;
        }
        
        // Check user role to determine access
        $userStmt = $conn->prepare("SELECT user_role FROM users WHERE id = ?");
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        
        $isAdminOrScrum = $user && ($user['user_role'] === 'ADMIN' || $user['user_role'] === 'SCRUM_MASTER');
        
        // Allow creator or admin/scrum master to edit
        if ($report['created_by'] != $userId && !$isAdminOrScrum) {
            http_response_code(403);
            echo json_encode(['error' => 'You can only edit your own bug reports unless you are an admin or scrum master']);
            exit;
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Exception: ' . $e->getMessage()]);
        exit;
    }

    // Build dynamic update query
    $updateFields = [];
    $params = [];
    
    if (isset($input['comment']) && trim($input['comment']) !== '') {
        $updateFields[] = "comment = ?";
        $params[] = trim($input['comment']);
    }
    
    if (isset($input['resolution_status'])) {
        $updateFields[] = "resolution_status = ?";
        $params[] = $input['resolution_status'];
    }
    
    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No valid fields to update']);
        exit;
    }
    
    $params[] = $id;
    
    try {
        $sql = "UPDATE project_bug_reports SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['message' => 'Updated']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Exception: ' . $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
}
?>