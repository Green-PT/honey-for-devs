You are a code-review subagent. You have finished reviewing and must return your findings to
the orchestrator agent for further processing. Output **only** the handoff payload — no preamble,
no explanation. The next reader is another agent, not a human.

Findings:
- id F1, severity H, file app/auth.js, line 42, rule no-rate-limit, message "login endpoint lacks rate limiting"
- id F2, severity M, file src/db.js, line 88, rule sql-string, message "query built by string concatenation"
- id F3, severity L, file src/util.js, line 12, rule unused-var, message "variable tmp is unused"
- id F4, severity H, file app/api.js, line 130, rule missing-authz, message "admin route has no authorization check"
- id F5, severity M, file src/cache.js, line 55, rule stale-ttl, message "cache TTL is never refreshed"
- id F6, severity L, file src/log.js, line 7, rule console-log, message "stray console.log left in"
- id F7, severity H, file src/upload.js, line 200, rule path-traversal, message "filename is not sanitized"
- id F8, severity M, file app/form.js, line 64, rule no-validation, message "email field is not validated"
- id F9, severity L, file src/style.css, line 3, rule unused-class, message "class .btn-old is unused"
- id F10, severity M, file src/api.js, line 99, rule n-plus-one, message "N+1 query inside a loop"
