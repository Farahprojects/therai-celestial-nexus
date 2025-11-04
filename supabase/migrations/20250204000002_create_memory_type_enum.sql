-- Create ENUM type for memory classification

CREATE TYPE memory_type AS ENUM ('fact', 'emotion', 'goal', 'pattern', 'relationship');

COMMENT ON TYPE memory_type IS 'Classification types for user memories extracted from conversations';

