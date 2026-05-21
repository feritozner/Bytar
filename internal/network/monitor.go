package network

import (
	"bytar/internal/ui"
	"context"
	"fmt"
	"net"
	"strings"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

var LiveTrafficChan = make(chan string, 1000)

func GetLocalIPs() ([]string, error) {
	var localIPs []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}
	for _, iface := range interfaces {
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
				localIPs = append(localIPs, ipnet.IP.String())
			}
		}
	}
	return localIPs, nil
}

func MonitorTraffic(ctx context.Context, handle *pcap.Handle, localIP, targetIP string) {
	if net.ParseIP(targetIP) == nil {
		fmt.Printf("%sError: Invalid target IP address: %s%s\n", ui.Red, targetIP, ui.Reset)
		return
	}

	localIPs, err := GetLocalIPs()
	if err != nil || len(localIPs) == 0 {
		fmt.Printf("%sError: Could not determine local IP addresses%s\n", ui.Red, ui.Reset)
		return
	}

	filter := fmt.Sprintf("host %s", targetIP)
	if err := handle.SetBPFFilter(filter); err != nil {
		fmt.Printf("%sError setting BPF filter: %v%s\n", ui.Red, err, ui.Reset)
		return
	}

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	packetChan := packetSource.Packets()

	for {
		select {
		case <-ctx.Done():
			return
		case packet, ok := <-packetChan:
			if !ok {
				return
			}

			networkLayer := packet.NetworkLayer()
			if networkLayer == nil {
				continue
			}

			srcIP, dstIP := networkLayer.NetworkFlow().Endpoints()
			protocol := "UNKNOWN"
			srcPort, dstPort := "?", "?"
			color := ui.White

			if ipLayer, ok := networkLayer.(*layers.IPv4); ok {
				switch ipLayer.Protocol {
				case layers.IPProtocolTCP:
					if tcpLayer, ok := packet.Layer(layers.LayerTypeTCP).(*layers.TCP); ok {
						protocol = "TCP"
						srcPort = tcpLayer.SrcPort.String()
						dstPort = tcpLayer.DstPort.String()
						color = ui.Blue
					}
				case layers.IPProtocolUDP:
					if udpLayer, ok := packet.Layer(layers.LayerTypeUDP).(*layers.UDP); ok {
						protocol = "UDP"
						srcPort = udpLayer.SrcPort.String()
						dstPort = udpLayer.DstPort.String()
						color = ui.Yellow
					}
				case layers.IPProtocolICMPv4:
					protocol = "ICMP"
					srcPort, dstPort = "-", "-"
					color = ui.Green
					if icmpLayer, ok := packet.Layer(layers.LayerTypeICMPv4).(*layers.ICMPv4); ok {
						srcPort = fmt.Sprintf("Type:%d", icmpLayer.TypeCode.Type())
						dstPort = fmt.Sprintf("Code:%d", icmpLayer.TypeCode.Code())
					}
				default:
					protocol = fmt.Sprintf("IP:%d", ipLayer.Protocol)
					color = ui.White
				}
			}

			var direction string
			isLocalSrc := false
			for _, ip := range localIPs {
				if srcIP.String() == ip {
					isLocalSrc = true
					break
				}
			}
			if isLocalSrc {
				direction = "OUTGOING"
			} else {
				direction = "INCOMING"
			}

			timestamp := packet.Metadata().Timestamp.Format("15:04:05.000")

			fmt.Printf("%s%-15s %s%-10s%s %-20s %-8s %s%-20s %-8s %s%-10s%s\n",
				ui.White, timestamp,
				ui.Yellow, direction, ui.Reset,
				srcIP.String(), srcPort,
				ui.Cyan, dstIP.String(), dstPort,
				color, protocol, ui.Reset)

			webPacketStr := fmt.Sprintf("[%s] %-8s | %s:%s -> %s:%s | %s",
				timestamp, direction, srcIP.String(), srcPort, dstIP.String(), dstPort, protocol)

			select {
			case LiveTrafficChan <- webPacketStr:
			default:
			}
		}
	}
}

func RunMonitor(ctx context.Context, targetIP string) {

	fmt.Println("Press CTRL+C to stop monitoring.")
	fmt.Printf("%sMonitoring traffic to/from IP: %s%s\n", ui.Cyan, targetIP, ui.Reset)
	fmt.Printf("%s%s%s\n", ui.Cyan, strings.Repeat("━", 100), ui.Reset)
	fmt.Printf("%s%-15s %-10s %-20s %-8s %-20s %-8s %-10s%s\n", ui.White, "Time", "Direction", "Source", "S-Port", "Destination", "D-Port", "Protocol", ui.Reset)
	fmt.Printf("%s%s%s\n", ui.Cyan, strings.Repeat("━", 100), ui.Reset)

	devices, err := pcap.FindAllDevs()
	if err != nil {
		fmt.Println("Error finding devices:", err)
		return
	}

	for _, device := range devices {
		handle, err := pcap.OpenLive(device.Name, 1600, true, pcap.BlockForever)
		if err == nil {
			go MonitorTraffic(ctx, handle, device.Name, targetIP)
		}
	}

	<-ctx.Done()
}
