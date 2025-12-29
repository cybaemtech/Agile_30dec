<?php
class Database {
    private $conn;

    public function getConnection() {
        $this->conn = null;
        
        try {
            // Auto-detect environment: check if we're in local development
            $isLocal = (
                ($_SERVER['HTTP_HOST'] ?? '') === 'localhost:5000' ||
                ($_SERVER['HTTP_HOST'] ?? '') === 'localhost' ||
                ($_SERVER['SERVER_NAME'] ?? '') === 'localhost' ||
                strpos($_SERVER['REQUEST_URI'] ?? '', '/api') !== false && 
                ($_SERVER['HTTP_HOST'] ?? '') === '' ||
                php_sapi_name() === 'cli' ||  // Command line interface - assume local
                !isset($_SERVER['HTTP_HOST']) // No HTTP context - assume local
            );
            
            if ($isLocal) {
                // Local XAMPP configuration
                $host = 'localhost';
                $port = '3306';
                $dbname = 'agile';
                $username = 'root';  
                $password = '';
            } else {
                // Production cPanel configuration
                $host = 'localhost';
                $port = '3306';
                $dbname = 'cybaemtechin_agile';
                $username = 'cybaemtechin_agile';  
                $password = 'Agile@9090$';
            }
            
            $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
            
            $this->conn = new PDO($dsn, $username, $password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            // Test the connection with a simple query
            $testStmt = $this->conn->prepare("SELECT 1");
            $testStmt->execute();
            
            // Log successful connection (for debugging)
            error_log("Database connection successful to: $dbname on " . ($isLocal ? 'LOCAL' : 'PRODUCTION') . " environment");
            
        } catch(PDOException $exception) {
            // Log connection error with details for debugging
            error_log("Database connection error: " . $exception->getMessage());
            error_log("DSN used: " . $dsn);
            error_log("Username: " . $username);
            error_log("Environment: " . ($isLocal ? 'LOCAL' : 'PRODUCTION'));
            
            // Don't expose connection details in production
            $this->conn = null;
        }
        return $this->conn;
    }
}
?>