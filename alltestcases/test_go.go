package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"tracelify-go/tracelify"
)

const DSN = "http://c6be43b8f03ccc3fda5e98f02d0aadee@54.251.156.151.nip.io:8000/api/73473f45-113e-4f33-a037-b40b66a5efc1/events"

func main() {
	fmt.Println("=== Tracelify Go SDK — Integration Test (20 Errors) ===")
	sdk, err := tracelify.NewTracelify(DSN, "1.0.0")
	if err != nil {
		panic(err)
	}

	user := map[string]interface{}{"id": "usr_go_006", "email": "gopher@test.com", "name": "Go Tester"}
	sdk.SetUser(user)
	sdk.SetTag("env", "production")
	sdk.SetTag("sdk", "tracelify.go")

	capture := func(idx int, err error) {
		if err != nil {
			fmt.Printf("[%d] Capturing %T...\n", idx, err)
			sdk.CaptureException(err)
		}
	}

	// 1. Basic error
	capture(1, errors.New("basic internal server error"))

	// 2. Wrapped error
	capture(2, fmt.Errorf("transaction failed: %w", errors.New("deadlock detected")))

	// 3. File Not Found
	_, err = os.Open("/var/secrets/nonexistent.env")
	capture(3, err)

	// 4. Panic simulated
	func() {
		defer func() {
			if r := recover(); r != nil {
				capture(4, fmt.Errorf("panic recovered: %v", r))
			}
		}()
		_ = []int{}[1] // Out of bounds
	}()

	// 5. JSON Unmarshal
	err = json.Unmarshal([]byte("{invalid"), &map[string]interface{}{})
	capture(5, err)

	// 6. HTTP Error
	_, err = http.Get("http://invalid-dns-name.local")
	capture(6, err)

	// 7. strconv error
	_, err = strconv.ParseInt("invalid_num", 10, 64)
	capture(7, err)

	// 8. Base64 error
	_, err = base64.StdEncoding.DecodeString("invalid!base64")
	capture(8, err)

	// 9. io.EOF
	capture(9, io.EOF)

	// 10. io.ErrUnexpectedEOF
	capture(10, io.ErrUnexpectedEOF)

	// 11. sql.ErrNoRows
	capture(11, sql.ErrNoRows)

	// 12. hex.InvalidByteError
	_, err = hex.DecodeString("zz")
	capture(12, err)

	// 13. time.ParseError
	_, err = time.Parse(time.RFC3339, "invalid-time")
	capture(13, err)

	// 14. filepath.ErrBadPattern
	_, err = filepath.Match("[invalid", "test")
	capture(14, err)

	// 15. syscall.ENOENT
	capture(15, syscall.ENOENT)

	// 16. Context Deadline Exceeded
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()
	time.Sleep(2 * time.Millisecond)
	capture(16, ctx.Err())

	// 17. Custom Path Error
	capture(17, fmt.Errorf("path cannot contain null bytes"))

	// 18. Permission denied
	_, err = os.OpenFile("/root/secure", os.O_RDONLY, 0)
	capture(18, err)

	// 19. Custom Auth Error
	capture(19, fmt.Errorf("Authentication failed for user: admin"))

	// 20. Rate Limit error
	capture(20, fmt.Errorf("rate_limit_exceeded: 429 Too Many Requests"))

	fmt.Println("\nSignaling Shutdown and awaiting flush...")
	sdk.Shutdown()
	fmt.Println("✅ Done")
}
