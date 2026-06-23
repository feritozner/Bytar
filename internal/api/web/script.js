let map = null;
let markerLayer = null;
let metricsChartInstance = null; 

function tableFilter(input, containerId, rowSelector) {
    const filter = input.value.toLowerCase();
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = container.querySelectorAll(rowSelector);
    items.forEach(item => {
        const text = item.textContent || item.innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
            item.style.display = rowSelector === 'tr' ? "" : "flex";
        } else {
            item.style.display = "none";
        }
    });
}

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    document.getElementById('page-' + pageId).style.display = 'block';
    document.querySelectorAll('.nav-items li').forEach(li => li.classList.remove('active'));
    
    const targetNav = document.getElementById('nav-' + pageId);
    if(targetNav) targetNav.classList.add('active');

    if(pageId === 'overview' && map !== null) {
        setTimeout(() => map.invalidateSize(), 150);
    }
    
    if (pageId === 'connections' && document.getElementById('connectionsTableBody').innerHTML === '') loadConnections(document.getElementById('btn-conn'));
    if (pageId === 'tasks' && document.getElementById('tasksTableBody').innerHTML === '') loadParsedData('tasks', 3, document.getElementById('btn-serv'));
    if (pageId === 'lports' && document.getElementById('lportsTableBody').innerHTML === '') loadParsedData('lports', 4, document.getElementById('btn-ports'));
    if (pageId === 'firewall' && document.getElementById('firewallTableBody').innerHTML === '') loadParsedData('firewall', 2, document.getElementById('btn-fw'));
    if (pageId === 'wifipass' && document.getElementById('wifipassTableBody').innerHTML === '') loadParsedData('wifipass', 2, document.getElementById('btn-wifi'));
}

function updateMetricsChart(conn = 0, ports = 0, servs = 0) {
    const ctx = document.getElementById('metricsChart').getContext('2d');
    
    if (metricsChartInstance) {
        metricsChartInstance.data.datasets[0].data = [conn, ports, servs];
        metricsChartInstance.update();
        return;
    }

    metricsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Connections', 'Ports', 'Tasks'],
            datasets: [{
                data: [conn, ports, servs],
                backgroundColor: ['#2f81f7', '#ffab00', '#10b981'],
                borderColor: '#1b1e24',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#8492a6', font: { size: 10, family: 'monospace' }, boxWidth: 10, padding: 10 }
                }
            }
        }
    });
}

function initMap() {
    map = L.map('worldMap', { zoomControl: false }).setView([25.0, 10.0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    setTimeout(() => { if (map !== null) map.invalidateSize(); }, 200);
}

window.onload = () => {
    initMap();
    updateMetricsChart(0, 0, 0); 
};

async function runGlobalScan() {
    const btn = document.getElementById('mainScanBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('btnSpinner');
    const status = document.getElementById('globalStatus');

    document.getElementById('targetSearch').value = '';

    btn.disabled = true;
    btnText.innerText = "Running...";
    spinner.classList.remove('hidden');
    status.innerText = "TELEMETRY INGESTION ACTIVE";
    
    markerLayer.clearLayers();
    document.getElementById('ipListContainer').innerHTML = "";
    updateMetricsChart(0, 0, 0); 

    try {
        const [connRes, portsRes, servRes] = await Promise.all([
            fetch('/api/connections'), fetch('/api/lports'), fetch('/api/tasks')
        ]);

        const connData = await connRes.json();
        const portsData = await portsRes.json();
        const servData = await servRes.json();

        const connCount = connData.length || 0;
        let portsCount = 0;
        if(portsData.result) portsData.result.split('\n').forEach(l => { if(l.trim() && l.split(/\s+/).length >= 4) portsCount++; });

        let servCount = 0;
        if(servData.result) {
            const lines = servData.result.split('\n');
            for(let i = 2; i < lines.length; i++) {
                const line = lines[i].trim();
                if(!line) continue;
                const parts = line.split(/\s+/);
                if(parts.length >= 3) {
                    servCount++;
                }
            }
        }
        
        updateMetricsChart(connCount, portsCount, servCount);

        const countryTbody = document.getElementById('countryTableBody');
        let unknownCount = 0;
        let cCounts = {};

        if (!connData || connData.length === 0) {
            document.getElementById('ipListContainer').innerHTML = `<div class="empty-state">No active telemetry captured.</div>`;
            document.getElementById('ipListCount').innerText = "0";
            countryTbody.innerHTML = `<tr><td colspan="2" class="empty-state">No active mappings</td></tr>`;
            document.getElementById('stat-unknown').innerText = "0";
        } else {
            const listContainer = document.getElementById('ipListContainer');
            document.getElementById('ipListCount').innerText = connData.length;

            let ipListHTML = "";

            connData.forEach(conn => {
                const org = conn.org && conn.org !== "-" ? conn.org : "Unresolved ASN / Org";
                const country = conn.country && conn.country !== "-" ? conn.country : "Unknown Origin";
                
                let sRemote = DOMPurify.sanitize(conn.remote_ip);
                let sLocal = DOMPurify.sanitize(conn.local_ip);
                let sProto = DOMPurify.sanitize(conn.protocol);
                let sProtoLower = sProto.toLowerCase();
                let sOrg = DOMPurify.sanitize(org);
                let sCountry = DOMPurify.sanitize(country);
                
                ipListHTML += `
                    <div class="ip-list-item target-item">
                        <div class="ip-main"><span>${sRemote}</span><span class="badge ${sProtoLower}">${sProto}</span></div>
                        <div class="ip-sub">
                            <div class="ip-sub-row"><span style="color: var(--text-main); font-weight: bold; overflow: hidden; text-overflow: ellipsis;">${sOrg}</span></div>
                            <div class="ip-sub-row"><span>${sCountry}</span><span>L: ${sLocal}</span></div>
                        </div>
                    </div>`;

                if (!conn.country || conn.country === "-" || conn.country === "0,0") {
                    unknownCount++;
                } else {
                    cCounts[conn.country] = (cCounts[conn.country] || 0) + 1;
                }

                if (conn.loc && conn.loc !== "" && conn.loc !== "0,0") {
                    const coords = conn.loc.split(',');
                    if (coords.length === 2) {
                        const lat = parseFloat(coords[0].trim());
                        const lng = parseFloat(coords[1].trim());
                        if (!isNaN(lat) && !isNaN(lng)) {
                            const color = sProto === 'TCP' ? '#2f81f7' : '#ffab00';
                            const popupContent = DOMPurify.sanitize(`
                                <div style="font-family: monospace; font-size: 11px; min-width: 180px;">
                                    <b style="color:var(--primary-color)">[NETWORK CONNECTION]</b><br>
                                    <b>IP:</b> ${conn.remote_ip}<br>
                                    <b>Protocol:</b> ${conn.protocol}<br>
                                    <b>Local Socket:</b> ${conn.local_ip}<br>
                                    <b>Country:</b> ${sCountry}<br>
                                    <b>Organization:</b> ${sOrg}
                                </div>
                            `);
                            L.circleMarker([lat, lng], { radius: 4, fillColor: color, color: "#fff", weight: 0.8, opacity: 1, fillOpacity: 0.85 })
                              .addTo(markerLayer).bindPopup(popupContent); 
                        }
                    }
                }
            });
            
            listContainer.innerHTML = ipListHTML;

            let countryHTML = "";
            const sortedCountries = Object.keys(cCounts).sort((a, b) => cCounts[b] - cCounts[a]);
            if (sortedCountries.length === 0) {
                countryTbody.innerHTML = `<tr><td colspan="2" class="empty-state">No mapped origins</td></tr>`;
            } else {
                sortedCountries.forEach(c => {
                    let sCountry = DOMPurify.sanitize(c);
                    let sCount = DOMPurify.sanitize(cCounts[c]);
                    countryHTML += `<tr><td>${sCountry}</td><td style="font-weight: bold; color: var(--primary-color);">${sCount}</td></tr>`;
                });
                countryTbody.innerHTML = countryHTML;
            }
            document.getElementById('stat-unknown').innerText = unknownCount;
        }
        status.innerText = "Analyst Queue: Live Update";
    } catch (e) {
        status.innerText = "Ingestion Error";
    } finally {
        btn.disabled = false;
        btnText.innerText = "Run Playbook";
        spinner.classList.add('hidden');
    }
}

function startLoading(tbodyId, colSpan) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = `<tr><td colspan="${colSpan}"><div class="loader-wrapper"><div class="loader-spinner"></div><span class="pct-text" id="${tbodyId}-pct">0%</span><span>Parsing Node Data...</span></div></td></tr>`;
    let pct = 0;
    return setInterval(() => {
        pct += Math.floor(Math.random() * 20) + 5;
        if (pct > 98) pct = 98;
        const pctEl = document.getElementById(`${tbodyId}-pct`);
        if (pctEl) pctEl.innerText = pct + '%';
    }, 100);
}

async function loadConnections(btn) {
    if(btn) btn.disabled = true;
    const loadInt = startLoading('connectionsTableBody', 6);
    try {
        const res = await fetch('/api/connections');
        const data = await res.json();
        clearInterval(loadInt);
        const tbody = document.getElementById('connectionsTableBody');
        
        if (!data || data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' class='empty-state'>No logs captured.</td></tr>";
            return;
        }
        
        let htmlString = "";
        data.forEach(conn => {
            let sProto = DOMPurify.sanitize(conn.protocol);
            let sLocal = DOMPurify.sanitize(conn.local_ip);
            let sRemote = DOMPurify.sanitize(conn.remote_ip);
            let sCountry = DOMPurify.sanitize(conn.country);
            let sOrg = DOMPurify.sanitize(conn.org);
            let sPid = DOMPurify.sanitize(conn.pid);
            
            const badge = sProto.toLowerCase() === 'tcp' ? 'tcp' : 'udp';
            htmlString += `<tr><td><span class="badge ${badge}">${sProto}</span></td><td>${sLocal}</td><td>${sRemote}</td><td>${sCountry}</td><td>${sOrg}</td><td><strong>${sPid}</strong></td></tr>`;
        });
        tbody.innerHTML = htmlString;
    } catch (e) { 
        clearInterval(loadInt); 
        document.getElementById('connectionsTableBody').innerHTML = "<tr><td colspan='6' style='color:var(--danger-color);'>Log parse failure.</td></tr>"; 
    } finally {
        if(btn) btn.disabled = false;
    }
}

async function scanSpecificIP() {
    const ipInputEl = document.getElementById('ipInput');
    let rawIp = ipInputEl.value.trim();
    if (!rawIp) return;
    
    const ip = DOMPurify.sanitize(rawIp);
    const loadInt = startLoading('ipTableBody', 2);
    try {
        const res = await fetch(`/api/scan?ip=${ip}`);
        const data = await res.json();
        clearInterval(loadInt);
        if (data.error) throw new Error(data.error);
        
        const tbody = document.getElementById('ipTableBody');
        let htmlString = "";
        let scannedLoc = null;
        let popupDetails = `<b style="color:#ffab00">[THREAT INTEL SCAN]</b><br>`;
        
        data.result.split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if(idx > -1) {
                let key = DOMPurify.sanitize(line.substring(0, idx).trim());
                let val = DOMPurify.sanitize(line.substring(idx+1).trim());
                htmlString += `<tr><td style="width: 110px; color: var(--text-muted); font-weight: 600;">${key}</td><td>${val}</td></tr>`;
                popupDetails += `<b>${key}:</b> ${val}<br>`;
                if (key.toLowerCase() === 'location') scannedLoc = val;
            }
        });
        
        tbody.innerHTML = htmlString;

        if (scannedLoc && scannedLoc !== "0,0" && map !== null) {
            const coords = scannedLoc.split(',');
            if (coords.length === 2) {
                const lat = parseFloat(coords[0].trim());
                const lng = parseFloat(coords[1].trim());
                if (!isNaN(lat) && !isNaN(lng)) {
                    L.circleMarker([lat, lng], { radius: 6, fillColor: '#ffab00', color: "#fff", weight: 1.5, opacity: 1, fillOpacity: 1 })
                      .addTo(markerLayer).bindPopup(`<div style="font-family: monospace; font-size: 11px; min-width: 200px;">${popupDetails}</div>`).openPopup();
                    
                    switchPage('overview');
                    map.flyTo([lat, lng], 5); 
                }
            }
        }
    } catch (e) { 
        clearInterval(loadInt); 
        document.getElementById('ipTableBody').innerHTML = `<tr><td colspan='2' style='color:var(--danger-color);'>Intel query timeout.</td></tr>`; 
    }
}

async function loadParsedData(command, colSpan, btn) {
    if(btn) btn.disabled = true;
    const tbody = document.getElementById(`${command}TableBody`);
    tbody.innerHTML = `<tr><td colspan="${colSpan}" class="empty-state">Querying OS endpoint...</td></tr>`;
    try {
        const res = await fetch(`/api/${command}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const lines = data.result.split('\n');
        
        let htmlString = "";

        if (command === 'wifipass') {
            for(let i=2; i<lines.length; i++) {
                if(!lines[i].trim()) continue;
                const parts = lines[i].split('|');
                if(parts.length === 2) {
                    let s0 = DOMPurify.sanitize(parts[0].trim());
                    let s1 = DOMPurify.sanitize(parts[1].trim());
                    htmlString += `<tr><td><strong>${s0}</strong></td><td><span style="color:var(--status-success); font-weight:bold;">${s1}</span></td></tr>`;
                }
            }
        } 
        else if (command === 'lports') {
            lines.forEach(line => {
                line = line.trim();
                if(!line) return;
                const parts = line.split(/\s+/);
                if(parts.length >= 4) {
                    let s0 = DOMPurify.sanitize(parts[0]);
                    let s1 = DOMPurify.sanitize(parts[1]);
                    let s2 = DOMPurify.sanitize(parts[2]);
                    let s3 = DOMPurify.sanitize(parts[3]);
                    let s4 = parts.length >= 5 ? DOMPurify.sanitize(parts[4]) : "-";
                    htmlString += `<tr><td><span class="badge tcp">${s0}</span></td><td>${s1}</td><td>${s2}</td><td><span class="badge run">${s3}</span></td><td>${s4}</td></tr>`;
                }
            });
        }
        else if (command === 'tasks') {
            for(let i=2; i<lines.length; i++) {
                const line = lines[i].trim();
                if(!line) continue;
                const parts = line.split(/\s+/);
                if(parts.length >= 3) {
                    let s0 = DOMPurify.sanitize(parts[0]);
                    let s1 = DOMPurify.sanitize(parts[1]);
                    let sRest = DOMPurify.sanitize(parts.slice(2).join(' '));
                    htmlString += `<tr><td><span class="badge run">${s0}</span></td><td><strong>${s1}</strong></td><td>${sRest}</td></tr>`;
                }
            }
        }
        else if (command === 'firewall') {
            lines.forEach(line => {
                if(!line.trim() || line.includes('---') || line.includes('Ok.') || line.includes('Tamam.')) return;
                const parts = line.split(':');
                if(parts.length >= 2) {
                    let s0 = DOMPurify.sanitize(parts[0].trim());
                    let sRest = DOMPurify.sanitize(parts.slice(1).join(':').trim());
                    htmlString += `<tr><td style="color: var(--text-muted);">${s0}</td><td><strong>${sRest}</strong></td></tr>`;
                }
                else {
                    let sLine = DOMPurify.sanitize(line.trim());
                    htmlString += `<tr><td colspan="2" style="background-color: rgba(255,255,255,0.01); color: var(--primary-color); font-weight:bold;">${sLine}</td></tr>`;
                }
            });
        }
        
        tbody.innerHTML = htmlString;
        
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan='${colSpan}' style='color:var(--danger-color);'>Endpoint deserialization failed.</td></tr>`; 
    } finally {
        if(btn) btn.disabled = false;
    }
}

let trafficWs = null;
let monPacketCount = 0;
let isMonAutoScroll = true;

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/traffic`;
    const statusBadge = document.getElementById('wsStatusBadge');
    const consoleDiv = document.getElementById('monitorConsole');

    trafficWs = new WebSocket(wsUrl);

    trafficWs.onopen = () => {
        statusBadge.innerText = "SOCKET ONLINE";
        statusBadge.style.color = "var(--status-success)";
        statusBadge.style.background = "rgba(16, 185, 129, 0.1)";
    };

    trafficWs.onmessage = (event) => {
        monPacketCount++;
        document.getElementById('monPacketCount').innerText = monPacketCount + " Packets";

        const data = event.data;

        if (!data.includes("|")) {
            const sysRow = document.createElement('div');
            sysRow.style = "padding: 10px 15px; color: #9CA3AF; border-bottom: 1px solid rgba(255,255,255,0.02);";
            sysRow.textContent = data;
            consoleDiv.appendChild(sysRow);
            return;
        }

        let timeMatch = data.match(/\[(.*?)\]/);
        let time = timeMatch ? timeMatch[1] : "";
        let direction = data.includes("OUTGOING") ? "OUTGOING" : (data.includes("INCOMING") ? "INCOMING" : "");
        
        let parts = data.split('|');
        let ips = parts.length > 1 ? parts[1].split('->') : ["", ""];
        let src = ips[0] ? ips[0].trim() : "";
        let dst = ips[1] ? ips[1].trim() : "";
        let proto = parts.length > 2 ? parts[2].trim() : "";

        let dirColor = direction === "OUTGOING" ? "#F59E0B" : "#10B981";
        let protoColor = "#9CA3AF";
        if (proto === "TCP") protoColor = "#3B82F6";
        else if (proto === "UDP") protoColor = "#F59E0B";
        else if (proto === "ICMP") protoColor = "#10B981";
        
        let sTime = DOMPurify.sanitize(time);
        let sDir = DOMPurify.sanitize(direction);
        let sSrc = DOMPurify.sanitize(src);
        let sDst = DOMPurify.sanitize(dst);
        let sProto = DOMPurify.sanitize(proto);

        const row = document.createElement('div');
        row.style = "display: flex; padding: 8px 15px; border-bottom: 1px solid rgba(255,255,255,0.02); transition: 0.1s;";
        row.onmouseover = () => row.style.backgroundColor = "rgba(255,255,255,0.04)";
        row.onmouseout = () => row.style.backgroundColor = "transparent";

        row.innerHTML = `
            <div style="flex: 1; color: #6B7280;">${sTime}</div>
            <div style="flex: 1; color: ${dirColor}; font-weight: bold;">${sDir}</div>
            <div style="flex: 2; color: #E5E7EB;">${sSrc}</div>
            <div style="flex: 2; color: #60A5FA;">${sDst}</div>
            <div style="flex: 0.5; text-align: right; color: ${protoColor}; font-weight: bold;">
                <span style="background-color: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1);">${sProto}</span>
            </div>
        `;

        consoleDiv.appendChild(row);

        if (consoleDiv.childElementCount > 500) {
            consoleDiv.removeChild(consoleDiv.firstChild);
        }

        if (isMonAutoScroll) {
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        }
    };

    trafficWs.onclose = () => {
        statusBadge.innerText = "SOCKET OFFLINE";
        statusBadge.style.color = "var(--danger-color)";
        statusBadge.style.background = "rgba(255, 86, 48, 0.1)";
        setTimeout(initWebSocket, 3000);
    };

    consoleDiv.addEventListener('scroll', () => {
        const isAtBottom = consoleDiv.scrollHeight - consoleDiv.scrollTop <= consoleDiv.clientHeight + 15;
        isMonAutoScroll = isAtBottom;
    });
}

async function startWebMonitor() {
    let rawIp = document.getElementById('monIpInput').value.trim();
    if (!rawIp) {
        alert("Please enter a target IP address.");
        return;
    }
    const ip = DOMPurify.sanitize(rawIp);

    const btnStart = document.getElementById('btn-start-mon');
    const btnStop = document.getElementById('btn-stop-mon');
    const consoleDiv = document.getElementById('monitorConsole');

    btnStart.disabled = true;
    btnStart.innerText = "Capturing...";
    btnStop.disabled = false;

    consoleDiv.innerHTML += `<div style="color:var(--status-warning)">[SYS] Initializing packet capture for target: ${ip}...</div>`;

    try {
        await fetch(`/api/monitor/start?ip=${ip}`);
        consoleDiv.innerHTML += `<div style="color:var(--status-success)">[SYS] BPF Filter applied. Streaming data...</div>`;
    } catch (e) {
        consoleDiv.innerHTML += `<div style="color:var(--danger-color)">[ERR] Failed to start capture engine.</div>`;
        btnStart.disabled = false;
        btnStart.innerText = "▶ Start Capture";
    }
}

async function stopWebMonitor() {
    const btnStart = document.getElementById('btn-start-mon');
    const btnStop = document.getElementById('btn-stop-mon');
    
    btnStop.disabled = true;
    
    try {
        await fetch('/api/monitor/stop');
        document.getElementById('monitorConsole').innerHTML += `<div style="color:var(--danger-color)">[SYS] Capture engine stopped by user.</div>`;
    } finally {
        btnStart.disabled = false;
        btnStart.innerText = "▶ Start Capture";
    }
}

function clearMonitorConsole() {
    document.getElementById('monitorConsole').innerHTML = "";
    monPacketCount = 0;
    document.getElementById('monPacketCount').innerText = "0 Packets";
}

window.addEventListener('DOMContentLoaded', initWebSocket);