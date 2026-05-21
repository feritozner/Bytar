package command

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"bytar/internal/api"
	"bytar/internal/network"
	"bytar/internal/sysinfo"
	"bytar/internal/ui"
)

var (
	commandHistory   []string
	historyIndex     int  = -1
	webServerRunning bool = false
	activeCancel     context.CancelFunc
)

func RunCli() {

	ui.PrintBanner()
	scanner := bufio.NewScanner(os.Stdin)
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)

	// CTRL + C Management
	go func() {
		for range signalChan {
			if activeCancel != nil {
				// If mon is active, stop it
				fmt.Println("\nStopping current task...")
				activeCancel()
				activeCancel = nil
			} else {
				// If there is no active task, shut down the program
				fmt.Println("\nBytar is shutting down...")
				os.Exit(0)
			}
		}
	}()

	for {
		fmt.Print(ui.GetPrompt())
		if !scanner.Scan() {
			continue
		}
		raw := scanner.Text()

		if raw == "\x1b[A" && len(commandHistory) > 0 {
			historyIndex--
			if historyIndex < 0 {
				historyIndex = 0
			}
			fmt.Println(commandHistory[historyIndex])
			continue
		}

		input := strings.TrimSpace(raw)
		if input != "" {
			commandHistory = append(commandHistory, input)
			historyIndex = len(commandHistory)
		}

		if input == "exit" {
			fmt.Println("Bytar is shutting down...")
			os.Exit(0)
		}

		if input != "" {
			handleCommand(input)
		}
	}
}

func handleCommand(input string) {

	if strings.HasPrefix(input, "mon ") {
		targetIP := strings.TrimSpace(strings.TrimPrefix(input, "mon "))

		ctx, cancel := context.WithCancel(context.Background())
		activeCancel = cancel // Make it cancellable

		network.RunMonitor(ctx, targetIP)

		activeCancel = nil
		return
	}

	if strings.HasPrefix(input, "scan ") {
		ip := strings.TrimSpace(strings.TrimPrefix(input, "scan "))
		res, _ := network.ScanIPFormatted(ip)
		fmt.Println(ui.Reset, strings.Repeat("━", 25), ui.Reset)
		fmt.Println(ui.Reset + res + ui.Reset)
		fmt.Println(ui.Reset, strings.Repeat("━", 25), ui.Reset)
		return
	}

	if strings.HasPrefix(input, "theme ") {
		color := strings.TrimSpace(strings.TrimPrefix(input, "theme "))
		switch color {
		case "red":
			ui.CurrentTheme = ui.Red
		case "green":
			ui.CurrentTheme = ui.Green
		case "blue":
			ui.CurrentTheme = ui.Blue
		case "magenta":
			ui.CurrentTheme = ui.Magenta
		default:
			fmt.Println("Invalid theme color. Use: magenta, red, green, or blue.")
		}
		return
	}

	switch input {
	case "webui":
		if webServerRunning {
			fmt.Println(ui.Yellow + "[*] Web Dashboard is already running at http://127.0.0.1:9001" + ui.Reset)
		} else {
			fmt.Println(ui.Yellow + "[*] Starting Web Dashboard in the background at http://127.0.0.1:9001" + ui.Reset)
			webServerRunning = true
			go api.StartWebServer("9001")
		}
	case "clear":
		ui.ClearScreen()
	case "banner":
		ui.PrintBanner()
	case "help":
		ui.ShowHelp()
	case "connections":
		network.GetEstablishedConnections()
	case "history":
		for i, cmd := range commandHistory {
			fmt.Printf("[%d] %s\n", i+1, cmd)
		}
	case "firewall":
		res, _ := sysinfo.GetFirewallStatus()
		fmt.Println(ui.Reset + res + ui.Reset)
	case "wifipass":
		sysinfo.GetWifiPasswords()
	case "tasks":
		res, _ := sysinfo.GetRunningProcesses()
		fmt.Println(ui.Reset + res + ui.Reset)
	case "lports":
		res, _ := network.GetListeningPorts()
		fmt.Printf("%s%s%s\n", ui.Reset, strings.Repeat("━", 100), ui.Reset)
		fmt.Print(ui.Reset + res + ui.Reset)
		fmt.Printf("%s%s%s\n", ui.Reset, strings.Repeat("━", 100), ui.Reset)
	default:
		fmt.Println("Command is missing or incorrect. Type 'help' for available commands.")
	}
}
