<?php
// Simple MySQL session handler for PHP
class MySQLSessionHandler implements SessionHandlerInterface {
    private $pdo;
    private $table;

    public function __construct($pdo, $options = []) {
        $this->pdo = $pdo;
        $this->table = isset($options['db_table']) ? $options['db_table'] : 'sessions';
    }

    public function open($save_path, $name): bool {
        return true;
    }

    public function close(): bool {
        return true;
    }

    public function read(string $id): string {
        $stmt = $this->pdo->prepare("SELECT data FROM {$this->table} WHERE id = ? AND expires > ?");
        $stmt->execute([$id, time()]);
        $row = $stmt->fetch();
        return $row ? $row['data'] : '';
    }

    public function write(string $id, string $data): bool {
        $expires = time() + 86400; // 1 day
        $stmt = $this->pdo->prepare("REPLACE INTO {$this->table} (id, expires, data) VALUES (?, ?, ?)");
        return $stmt->execute([$id, $expires, $data]);
    }

    public function destroy(string $id): bool {
        $stmt = $this->pdo->prepare("DELETE FROM {$this->table} WHERE id = ?");
        return $stmt->execute([$id]);
    }

    public function gc(int $maxlifetime): int|false {
        $stmt = $this->pdo->prepare("DELETE FROM {$this->table} WHERE expires < ?");
        $stmt->execute([time()]);
        return $stmt->rowCount();
    }
}
?>
