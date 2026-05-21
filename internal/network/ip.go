package network

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type IPInfo struct {
	IP       string `json:"ip"`
	City     string `json:"city"`
	Country  string `json:"country"`
	Loc      string `json:"loc"`
	Org      string `json:"org"`
	Postal   string `json:"postal"`
	Timezone string `json:"timezone"`
}

func GetIPInfo(ip string) (*IPInfo, error) {
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("https://ipinfo.io/" + ip + "/json")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var info IPInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

func ScanIPFormatted(ip string) (string, error) {
	info, err := GetIPInfo(ip)
	if err != nil {
		return "", err
	}
	result := fmt.Sprintf("IP:        %s\nCity:      %s\nCountry:   %s\nLocation:  %s\nOrg:       %s\nPostal:    %s\nTimezone:  %s",
		info.IP, info.City, info.Country, info.Loc, info.Org, info.Postal, info.Timezone)
	return result, nil
}
