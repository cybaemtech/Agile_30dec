<?php
// Simple script to verify database structure and test tags functionality
require_once 'config/database.php';

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<h2>Database Structure Verification</h2>\n";
    
    // Check if tags column exists in work_items table
    $stmt = $conn->query("DESCRIBE work_items");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h3>work_items table structure:</h3>\n";
    echo "<pre>\n";
    $tagsColumnExists = false;
    foreach ($columns as $column) {
        echo "Field: " . $column['Field'] . " | Type: " . $column['Type'] . " | Null: " . $column['Null'] . " | Default: " . $column['Default'] . "\n";
        if ($column['Field'] === 'tags') {
            $tagsColumnExists = true;
        }
    }
    echo "</pre>\n";
    
    if ($tagsColumnExists) {
        echo "<p style='color: green;'>✅ Tags column exists in work_items table</p>\n";
        
        // Test selecting work items with tags
        $stmt = $conn->query("SELECT id, external_id, title, tags FROM work_items LIMIT 5");
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "<h3>Sample work items with tags:</h3>\n";
        echo "<pre>\n";
        foreach ($items as $item) {
            echo "ID: {$item['id']} | External ID: {$item['external_id']} | Title: {$item['title']} | Tags: " . ($item['tags'] ?: 'NULL') . "\n";
        }
        echo "</pre>\n";
        
    } else {
        echo "<p style='color: red;'>❌ Tags column does NOT exist in work_items table</p>\n";
        echo "<p>You need to run the database migration:</p>\n";
        echo "<pre>ALTER TABLE work_items ADD COLUMN tags TEXT DEFAULT NULL AFTER description;</pre>\n";
    }
    
} catch (PDOException $e) {
    echo "<p style='color: red;'>Database connection failed: " . $e->getMessage() . "</p>\n";
}
?>