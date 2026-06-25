package sysinfo

import (
	"bytar/internal/ui"
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

func GetRunningProcesses() (string, error) {
	cmdStr := `Get-CimInstance Win32_Process | Select-Object Name, ProcessId, ParentProcessId | Format-Table -AutoSize | Out-String`
	cmd := exec.Command("powershell", "-NoProfile", "-Command", cmdStr)

	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func GetFirewallStatus() (string, error) {
	cmd := exec.Command("netsh", "advfirewall", "show", "allprofiles")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func GetWifiPasswords() (string, error) {
	cmdProfiles := exec.Command("netsh", "wlan", "show", "profiles")
	var outProfiles bytes.Buffer
	cmdProfiles.Stdout = &outProfiles
	if err := cmdProfiles.Run(); err != nil {
		return "", err
	}

	lines := strings.Split(outProfiles.String(), "\n")
	var ssids []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "All User Profile") || strings.HasPrefix(line, "Tüm Kullanıcı Profili") {
			parts := strings.Split(line, ":")
			if len(parts) == 2 {
				ssids = append(ssids, strings.TrimSpace(parts[1]))
			}
		}
	}

	var result strings.Builder
	fmt.Printf("%s%s%s\n", ui.Reset, strings.Repeat("━", 65), ui.Reset)
	header := fmt.Sprintf("%-30s | %-30s\n", "SSID", "Password")
	fmt.Print(header)
	result.WriteString(header)
	lineSeparator := strings.Repeat("-", 65) + "\n"
	fmt.Print(lineSeparator)
	result.WriteString(lineSeparator)
	for _, ssid := range ssids {
		cmdPassword := exec.Command("netsh", "wlan", "show", "profile", "name="+ssid, "key=clear")
		var outPass bytes.Buffer
		cmdPassword.Stdout = &outPass
		if err := cmdPassword.Run(); err != nil {
			ssidAndPassword := fmt.Sprintf("%-30s | %-30s\n", ssid, "Error retrieving password")
			fmt.Print(ssidAndPassword)
			result.WriteString(ssidAndPassword)
			continue
		}
		lines := strings.Split(outPass.String(), "\n")
		password := "N/A"
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "Key Content") || strings.HasPrefix(line, "Anahtar İçeriği") {
				parts := strings.Split(line, ":")
				if len(parts) == 2 {
					password = strings.TrimSpace(parts[1])
					break
				}
			}
		}
		ssidAndPassword := fmt.Sprintf("%-30s | %-30s\n", ssid, password)
		fmt.Print(ssidAndPassword)
		result.WriteString(ssidAndPassword)
	}
	fmt.Printf("%s%s%s\n", ui.Reset, strings.Repeat("━", 65), ui.Reset)
	return result.String(), nil
}
