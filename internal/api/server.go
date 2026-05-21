package api

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"sync"

	"bytar/internal/network"
	"bytar/internal/sysinfo"
	"bytar/internal/ui"

	"github.com/gorilla/websocket"
)

//go:embed web
var webFiles embed.FS

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "http://127.0.0.1:9001" || origin == "http://localhost:9001" {
			return true
		}
		return false
	},
}

var (
	LiveTrafficChan = make(chan string, 1000)
	clients         = make(map[*websocket.Conn]bool)
	clientsMutex    sync.Mutex
)

func init() {
	go broadcastTraffic()
}

func broadcastTraffic() {
	for {

		msg := <-network.LiveTrafficChan

		clientsMutex.Lock()
		for client := range clients {
			err := client.WriteMessage(websocket.TextMessage, []byte(msg))
			if err != nil {
				client.Close()
				delete(clients, client)
			}
		}
		clientsMutex.Unlock()
	}
}

func serveWsMonitor(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	clientsMutex.Lock()
	clients[ws] = true
	clientsMutex.Unlock()
}

func StartWebServer(port string) {
	subFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		fmt.Printf("\n%s[-] Error loading embedded web files: %v%s\n", ui.Red, err, ui.Reset)
		return
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(subFS)))
	mux.HandleFunc("/api/connections", serveConnections)
	mux.HandleFunc("/api/firewall", serveTextCommand(sysinfo.GetFirewallStatus))
	mux.HandleFunc("/api/tasks", serveTextCommand(sysinfo.GetRunningProcesses))
	mux.HandleFunc("/api/wifipass", serveTextCommand(sysinfo.GetWifiPasswords))
	mux.HandleFunc("/api/lports", serveTextCommand(network.GetListeningPorts))
	mux.HandleFunc("/api/scan", serveScanIP)
	mux.HandleFunc("/ws/traffic", serveWsMonitor)
	mux.HandleFunc("/api/monitor/start", serveStartMonitor)
	mux.HandleFunc("/api/monitor/stop", serveStopMonitor)

	if err := http.ListenAndServe("127.0.0.1:"+port, mux); err != nil {
		fmt.Printf("\n%s[-] Web server stopped: %v%s\n", ui.Red, err, ui.Reset)
	}
}

func serveTextCommand(cmdFunc func() (string, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		result, err := cmdFunc()
		if err != nil {
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"result": result})
	}
}

func serveConnections(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	conns, err := network.GetEstablishedConnections()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to get connections"})
		return
	}
	json.NewEncoder(w).Encode(conns)
}

func serveScanIP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ip := r.URL.Query().Get("ip")
	if ip == "" {
		json.NewEncoder(w).Encode(map[string]string{"error": "IP address is required"})
		return
	}
	result, err := network.ScanIPFormatted(ip)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"result": result})
}

var monitorCancel context.CancelFunc

func serveStartMonitor(w http.ResponseWriter, r *http.Request) {
	ip := r.URL.Query().Get("ip")
	if ip == "" {
		http.Error(w, `{"error": "IP address is required"}`, http.StatusBadRequest)
		return
	}

	if monitorCancel != nil {
		monitorCancel()
	}

	ctx, cancel := context.WithCancel(context.Background())
	monitorCancel = cancel

	go network.RunMonitor(ctx, ip)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status": "monitoring_started", "ip": "` + ip + `"}`))
}

func serveStopMonitor(w http.ResponseWriter, r *http.Request) {
	if monitorCancel != nil {
		monitorCancel()
		monitorCancel = nil
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status": "monitoring_stopped"}`))
}
