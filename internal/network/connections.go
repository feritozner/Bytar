package network

import (
	"bytar/internal/ui"
	"fmt"
	"net"
	"os/exec"
	"strings"
)

type Connection struct {
	Protocol string `json:"protocol"`
	LocalIP  string `json:"local_ip"`
	RemoteIP string `json:"remote_ip"`
	Country  string `json:"country"`
	Org      string `json:"org"`
	Loc      string `json:"loc"`
}

func ExtractIP(address string) string {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return strings.Split(address, ":")[0]
	}
	return host
}

func GetListeningPorts() (string, error) {

	cmd := exec.Command("netstat", "-ano")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	lines := strings.Split(string(output), "\n")

	var result strings.Builder
	for _, line := range lines {
		if strings.Contains(line, "LISTENING") {
			result.WriteString(line + "\n")
		}
	}

	return result.String(), nil
}

func GetEstablishedConnections() ([]Connection, error) {
	cmd := exec.Command("netstat", "-ano")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	fmt.Println()
	fmt.Printf("%s%-8s%s %s%-22s%s %s%-22s%s %s%-10s%s %s%-45s%s\n",
		ui.Cyan, "Type", ui.Reset,
		ui.Reset, "Local IP:Port", ui.Reset,
		ui.Yellow, "Remote IP:Port", ui.Reset,
		ui.Red, "Country", ui.Reset,
		ui.Blue, "Org", ui.Reset,
	)
	fmt.Println(ui.Reset, strings.Repeat("━", 120), ui.Reset)

	var connections []Connection
	lines := strings.Split(string(output), "\n")

	for _, line := range lines {

		if !strings.Contains(line, "ESTABLISHED") {
			continue
		}

		line = strings.TrimSpace(line)
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}

		remoteIP := ExtractIP(fields[2])
		if remoteIP == "" {
			continue
		}

		info, _ := GetIPInfo(remoteIP)
		if info == nil {
			info = &IPInfo{Org: "-", Country: "-"}
		}

		conn := Connection{
			Protocol: fields[0],
			LocalIP:  fields[1],
			RemoteIP: fields[2],
			Country:  info.Country,
			Org:      info.Org,
			Loc:      info.Loc,
		}
		connections = append(connections, conn)
		fmt.Printf("%s%-8s%s %s%-22s%s %s%-22s%s %s%-10s%s %s%-45s%s\n",
			ui.Cyan, conn.Protocol, ui.Reset,
			ui.Reset, conn.LocalIP, ui.Reset,
			ui.Yellow, conn.RemoteIP, ui.Reset,
			ui.Red, conn.Country, ui.Reset,
			ui.Blue, conn.Org, ui.Reset,
		)
	}
	fmt.Println(ui.Reset, strings.Repeat("━", 120), ui.Reset)
	return connections, nil
}
