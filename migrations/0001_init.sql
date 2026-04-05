CREATE TABLE IF NOT EXISTS phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO phrases (text) VALUES ('has never changed a lightbulb.');
INSERT INTO phrases (text) VALUES ('has never thrown a baseball.');
