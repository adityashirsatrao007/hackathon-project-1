# Tracelify Cross-Platform SDK Test Execution

This repository holds isolated end-to-end execution scripts to test event reporting to the Tracelify backend natively.

All these test suites are pre-configured to execute in the `orch` repository root or within this specific test folder. They point to the deployed sandbox Tracelify platform (`http://13.215.64.197.nip.io:8000`).

## 1. Python SDK Tests
Run the comprehensive suite capturing basic errors, DB, network, and edge case exceptions.

**Run the script:**
```bash
# Add the project's root folder into PYTHONPATH so the SDK matches
PYTHONPATH="../Core-4/" python test_sdk.py
```

## 2. C++ SDK Tests
The native C++ SDK relies on shell-calling `curl` globally rather than complex CMake linkings for raw network testing.

**Compile:**
```bash
# Specify the actual core SDK source alongside the test.
g++ -std=c++14 -o test_cpp test_cpp.cpp ../cpp/src/tracelify.cpp -I../cpp/include
```

**Run:**
```bash
./test_cpp
```

## 3. Java SDK Tests
The Java tester tests integration tracking via manual exceptions caught and piped to the backend.

**Compile:**
```bash
# Uses the main compiled java classes dynamically.
javac -cp "../Core-4/java/target/classes" TracelifyTest.java -d out
```

**Run:**
```bash
java -cp "out:../Core-4/java/target/classes" com.tracelify.TracelifyTest
```
## 4. Go SDK Tests
The native Go SDK uses standard go libraries to capture and format stack traces.

**Run the script:**
```bash
# From the alltestcases directory:
go run test_go.go
```

## 5. Kotlin SDK Tests
The Kotlin tester evaluates native Kotlin SDK logic without additional external dependencies.

**Compile:**
```bash
# From the alltestcases directory:
kotlinc ../kotlin/src/com/tracelify/Tracelify.kt TracelifyTest.kt -include-runtime -d test_kotlin.jar
```

**Run:**
```bash
java -jar test_kotlin.jar
```
## 6. JavaScript SDK Tests
Test the NodeJS SDK natively catching standard and generic unhandled exceptions.

**Run:**
```bash
node test_js.js
```

