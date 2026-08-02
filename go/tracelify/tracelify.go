package tracelify

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"runtime/debug"
	"strings"
	"time"
)

type Config struct {
	DSN       string
	Release   string
	ProjectID string
	Endpoint  string
	PublicKey string
}

func ParseDSN(dsn string) (*Config, error) {
	u, err := url.Parse(dsn)
	if err != nil {
		return nil, err
	}

	pathParts := strings.Split(strings.Trim(u.Path, "/"), "/")
	var projectID string
	if len(pathParts) > 0 {
		if pathParts[0] == "api" {
			pathParts = pathParts[1:]
		}
		if len(pathParts) > 0 && pathParts[len(pathParts)-1] == "events" {
			pathParts = pathParts[:len(pathParts)-1]
		}
		if len(pathParts) > 0 {
			projectID = pathParts[0]
		}
	}

	if projectID == "" {
		projectID = "unknown"
	}

	publicKey := "demo_key"
	if u.User != nil {
		publicKey = u.User.Username()
	}

	endpoint := fmt.Sprintf("%s://%s:%s/api/%s/events", u.Scheme, u.Hostname(), u.Port(), projectID)

	return &Config{
		DSN:       dsn,
		ProjectID: projectID,
		Endpoint:  endpoint,
		PublicKey: publicKey,
	}, nil
}

type Tracelify struct {
	Config *Config
	User   map[string]interface{}
	Tags   map[string]string
}

func NewTracelify(dsn, release string) (*Tracelify, error) {
	config, err := ParseDSN(dsn)
	if err != nil {
		return nil, err
	}
	config.Release = release

	return &Tracelify{
		Config: config,
		User:   make(map[string]interface{}),
		Tags:   make(map[string]string),
	}, nil
}

func (t *Tracelify) SetUser(user map[string]interface{}) {
	t.User = user
}

func (t *Tracelify) SetTag(key, value string) {
	t.Tags[key] = value
}

func randomUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (t *Tracelify) CaptureException(err error) {
	if err == nil {
		return
	}

	stacktrace := string(debug.Stack())
	timestamp := time.Now().UTC().Format("2006-01-02T15:04:05.000000Z")

	event := map[string]interface{}{
		"event_id":   randomUUID(),
		"project_id": t.Config.ProjectID,
		"timestamp":  timestamp,
		"level":      "error",
		"release":    t.Config.Release,
		"client": map[string]interface{}{
			"sdk": "tracelify.go",
		},
		"error": map[string]interface{}{
			"type":       fmt.Sprintf("%T", err),
			"message":    err.Error(),
			"stacktrace": stacktrace,
		},
	}

	if len(t.User) > 0 {
		event["user"] = t.User
	}
	if len(t.Tags) > 0 {
		event["tags"] = t.Tags
	}

	go t.sendEvent(event)
}

func (t *Tracelify) sendEvent(event map[string]interface{}) {
	data, err := json.Marshal(event)
	if err != nil {
		fmt.Println("Error marshaling event:", err)
		return
	}

	req, err := http.NewRequest("POST", t.Config.Endpoint, bytes.NewBuffer(data))
	if err != nil {
		fmt.Println("Error creating request:", err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+t.Config.PublicKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error sending event to Tracelify:", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 202 {
		fmt.Printf("Tracelify responded %d\n", resp.StatusCode)
	} else {
		fmt.Println("✅ Event accepted by Tracelify")
	}
}

func (t *Tracelify) Shutdown() {
	time.Sleep(2 * time.Second)
}
