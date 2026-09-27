package curlparser

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"
)

type curlparserReq struct {
	ID      string            `json:"id"`
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Domain  string            `json:"domain"`
	Path    string            `json:"path"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

type curlparserRes struct {
	StatusCode int               `json:"status_code"`
	StatusText string            `json:"status_text"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Error      string            `json:"error,omitempty"`
}

var (
	savedRequests []curlparserReq
	reqMutex      sync.Mutex
)

func HandleGetcurlparserRequests(w http.ResponseWriter, r *http.Request) {
	reqMutex.Lock()
	defer reqMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(savedRequests)
}

func HandleAddcurlparserRequest(w http.ResponseWriter, r *http.Request) {
	var newReq curlparserReq
	if err := json.NewDecoder(r.Body).Decode(&newReq); err != nil {
		http.Error(w, `{"error": "Invalid payload"}`, http.StatusBadRequest)
		return
	}

	reqMutex.Lock()
	savedRequests = append([]curlparserReq{newReq}, savedRequests...)
	reqMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status": "success"}`))
}

func HandleSendcurlparserRequest(w http.ResponseWriter, r *http.Request) {
	var reqData curlparserReq
	if err := json.NewDecoder(r.Body).Decode(&reqData); err != nil {
		json.NewEncoder(w).Encode(curlparserRes{Error: "Invalid JSON format"})
		return
	}

	req, err := http.NewRequest(reqData.Method, reqData.URL, bytes.NewBufferString(reqData.Body))
	if err != nil {
		json.NewEncoder(w).Encode(curlparserRes{Error: err.Error()})
		return
	}

	for key, val := range reqData.Headers {
		req.Header.Set(key, val)
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		json.NewEncoder(w).Encode(curlparserRes{Error: "Request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	resHeaders := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			resHeaders[k] = v[0]
		}
	}

	result := curlparserRes{
		StatusCode: resp.StatusCode,
		StatusText: http.StatusText(resp.StatusCode),
		Headers:    resHeaders,
		Body:       string(bodyBytes),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
