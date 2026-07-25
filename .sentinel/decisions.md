# Decisions

- [contract] Authoring a JSON manifest on ollama:deepseek-v4-pro, not code — codegen stamps every file from it, so it compiles by construction
- [review] Review found a problem: Contract drift: types.ts defines all IDs as `number`, but the build brief mandates UUID v4 (TEXT) for all primary keys. (+27 more). Fixing.
- [review] Review found a problem: Contract mismatch: types.ts defines all IDs as `number`, but the build brief mandates UUID v4 TEXT PKs — the generated code uses integer autoincrement, breaking UUID-based references and cursor pagination. (+40 more). Fixing.
- [review] Review found a problem: Contract specifies UUID v4 TEXT primary keys; implementation uses integer auto-increment IDs for all entities. (+91 more). Fixing.
- [review] Design scores 2/10 against a world-class bar
- [review] The repair pass changed nothing, so the reviewer's concern still stands