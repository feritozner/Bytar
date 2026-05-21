package ui

import (
	"fmt"
	"os"
	"os/exec"
)

const (
	Green   = "\033[32m"
	Blue    = "\033[34m"
	Yellow  = "\033[33m"
	Red     = "\033[31m"
	Cyan    = "\033[36m"
	White   = "\033[97m"
	Reset   = "\033[0m"
	Magenta = "\033[35m"
)

var CurrentTheme = Green

var Hostname, err = os.Hostname()

func GetPrompt() string {
	return CurrentTheme + Hostname + "@Bytar:~$ " + Reset
}

func PrintBanner() {
	ClearScreen()
	fmt.Println(CurrentTheme + `
  ____  ____        _              ____  
 / / / | __ ) _   _| |_ __ _ _ __  \ \ \ 
/ / /  |  _ \| | | | __/ _' | '__|  \ \ \
\ \ \  | |_) | |_| | || (_| | |     / / /
 \_\_\ |____/ \__, |\__\__,_|_|    /_/_/ 
              |___/                                                          
` + Reset)
	fmt.Println("Welcome to Bytar! Type 'help' to help menu and type 'exit' to quit.\n~~~~~~~~~~~~~~~~")
}

func ClearScreen() {
	cmd := exec.Command("cmd", "/c", "cls")
	cmd.Stdout = os.Stdout
	cmd.Run()
}

func ShowHelp() {
	fmt.Println(CurrentTheme + "\nAvailable Commands:\n" + Reset)
	fmt.Printf("%shelp%s         : %sShow this help menu\n", CurrentTheme, Reset, White)
	fmt.Printf("%swebui%s        : %sStart the Web Dashboard in background\n", CurrentTheme, Reset, White)
	fmt.Printf("%sconnections%s  : %sList established TCP connections with IP info\n", CurrentTheme, Reset, White)
	fmt.Printf("%sscan <ip>%s    : %sScan an IP and show geo and network info\n", CurrentTheme, Reset, White)
	fmt.Printf("%smon <ip>%s     : %sMonitor the packets to/from <ip>\n", CurrentTheme, Reset, White)
	fmt.Printf("%shistory%s      : %sShow command history\n", CurrentTheme, Reset, White)
	fmt.Printf("%sfirewall%s     : %sShow Windows Firewall status\n", CurrentTheme, Reset, White)
	fmt.Printf("%swifipass%s     : %sShow saved Wi-Fi passwords\n", CurrentTheme, Reset, White)
	fmt.Printf("%stasks%s        : %sShow running Windows processes\n", CurrentTheme, Reset, White)
	fmt.Printf("%slports%s       : %sShow listening ports\n", CurrentTheme, Reset, White)
	fmt.Printf("%sbanner%s       : %sShow the Bytar banner\n", CurrentTheme, Reset, White)
	fmt.Printf("%stheme <color>%s: %sChange output theme (red, green, blue)\n", CurrentTheme, Reset, White)
	fmt.Printf("%sclear%s        : %sClear the terminal screen\n", CurrentTheme, Reset, White)
	fmt.Printf("%sexit%s         : %sExit the program\n\n", CurrentTheme, Reset, White)
}
