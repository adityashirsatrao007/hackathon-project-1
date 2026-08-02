const { Tracelify } = require('../javascript/src/tracelify');
const fs = require('fs');

const DSN = "http://c482f74735cacf53d2ad256c8429f1f7@54.251.156.151.nip.io:8000/api/d19f7705-48bc-4842-af80-55da7bc29007/events";

async function main() {
  console.log("=== Tracelify JavaScript SDK — Integration Test (20 Errors) ===");
  const sdk = new Tracelify(DSN, "1.0.0");
  sdk.setUser({ id: "usr_js_001", name: "JS Tester" });
  sdk.setTag("env", "production");

  function capture(idx, error) {
    console.log(`[${idx}] Capturing ${error.name || 'Error'}...`);
    sdk.captureException(error);
  }

  // 1. TypeError
  try { null.length; } catch(e) { capture(1, e); }
  
  // 2. ReferenceError
  try { nonExistentFunction(); } catch(e) { capture(2, e); }

  // 3. SyntaxError
  try { eval('foo bar'); } catch(e) { capture(3, e); }

  // 4. RangeError
  try { new Array(-1); } catch(e) { capture(4, e); }

  // 5. URIError
  try { decodeURIComponent('%'); } catch(e) { capture(5, e); }

  // 6. Generic Error
  try { throw new Error("A generic JS error occurred"); } catch(e) { capture(6, e); }

  // 7. EvalError
  try { throw new EvalError("Eval execution failed"); } catch(e) { capture(7, e); }

  // 8. Custom DOMException-like missing file
  try { fs.readFileSync('/nonexistent/path.txt'); } catch(e) { capture(8, e); }

  // 9. Promise Rejection
  try { await Promise.reject(new Error("Promise rejection timeout")); } catch(e) { capture(9, e); }

  // 10. JSON Parse Error
  try { JSON.parse("{invalid: true}"); } catch(e) { capture(10, e); }

  // 11. Assert Error
  try { const assert = require('assert'); assert.strictEqual(1, 2); } catch(e) { capture(11, e); }

  // 12. Arithmetic simulated error
  try { throw new Error("Division by zero exception simulated"); } catch(e) { capture(12, e); }

  // 13. System Network Error
  try { throw new Error("getaddrinfo ENOTFOUND invalid-host.local"); } catch(e) { capture(13, e); }

  // 14. Custom Database Error
  class DatabaseError extends Error { constructor(m) { super(m); this.name = "DatabaseError"; } }
  try { throw new DatabaseError("Connection refused to DB"); } catch(e) { capture(14, e); }

  // 15. Validation Error
  class ValidationError extends Error { constructor(m) { super(m); this.name = "ValidationError"; } }
  try { throw new ValidationError("Invalid username field"); } catch(e) { capture(15, e); }

  // 16. Authentication Error
  class AuthError extends Error { constructor(m) { super(m); this.name = "AuthenticationError"; } }
  try { throw new AuthError("Session token expired"); } catch(e) { capture(16, e); }

  // 17. Rate Limit Error
  class RateLimitError extends Error { constructor(m) { super(m); this.name = "RateLimitError"; } }
  try { throw new RateLimitError("Too Many Requests 429"); } catch(e) { capture(17, e); }

  // 18. Timeout Error
  class TimeoutError extends Error { constructor(m) { super(m); this.name = "TimeoutError"; } }
  try { throw new TimeoutError("API Request exceeded 5000ms"); } catch(e) { capture(18, e); }

  // 19. Stack Overflow
  try { function recurse() { recurse(); } recurse(); } catch(e) { capture(19, e); }

  // 20. Out of Memory
  class OOMError extends Error { constructor(m) { super(m); this.name = "OutOfMemoryError"; } }
  try { throw new OOMError("V8 Heap limit reached"); } catch(e) { capture(20, e); }

  console.log("\nSignaling Shutdown and awaiting flush...");
  await sdk.shutdown();
  console.log("✅ Done");
}

main();
