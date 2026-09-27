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
    if (pageId === 'lports' && document.getElementById('lportsTableBody').innerHTML === '') loadParsedData('lports', 4, document.getElementById('btn-ports'));
    if (pageId === 'firewall' && document.getElementById('firewallTableBody').innerHTML === '') loadParsedData('firewall', 2, document.getElementById('btn-fw'));
    if (pageId === 'wifipass' && document.getElementById('wifipassTableBody').innerHTML === '') loadParsedData('wifipass', 2, document.getElementById('btn-wifi'));
    if (pageId === 'tasks' && document.querySelectorAll('#tasksContainer .task-block').length === 0) loadRawTasks(document.getElementById('btn-serv'));
    
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
    document.getElementById('worldMap').style.backgroundColor = '#0d1117'; 

    const worldBounds = [[-90, -180], [90, 180]];

    map = L.map('worldMap', { 
        zoomControl: false,
        minZoom: 1.5,
        maxBounds: worldBounds,
        maxBoundsViscosity: 1.0
    }).setView([25.0, 10.0], 2);

    const continents = [
        { name: 'NORTH AMERICA', coords: [45, -100] },
        { name: 'SOUTH AMERICA', coords: [-15, -60] },
        { name: 'EUROPE', coords: [48, 15] },
        { name: 'AFRICA', coords: [5, 20] },
        { name: 'ASIA', coords: [45, 90] },
        { name: 'OCEANIA', coords: [-25, 140] }
    ];

    continents.forEach(c => {
        const continentIcon = L.divIcon({
            className: 'continent-label',
            html: c.name,
            iconSize: [200, 20],
            iconAnchor: [100, 10]
        });
        L.marker(c.coords, { icon: continentIcon, interactive: false }).addTo(map);
    });
    
    fetch('world.geojson')
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: {
                    color: "#30363d",
                    weight: 1,
                    fillColor: "#161b22",
                    fillOpacity: 1
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.name) {
                        try {

                            let targetBounds = layer.getBounds(); 
                            
                            if (feature.geometry.type === 'MultiPolygon' && layer.getLayers) {
                                let maxArea = 0;
                                layer.getLayers().forEach(subLayer => {
                                    const b = subLayer.getBounds();
                                    const area = (b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest());
                                    if (area > maxArea) {
                                        maxArea = area;
                                        targetBounds = b;
                                    }
                                });
                            }

                            const centerPos = targetBounds.getCenter();
                            
                            const size = Math.max(targetBounds.getEast() - targetBounds.getWest(), targetBounds.getNorth() - targetBounds.getSouth());
                            
                            let sizeClass = 'country-small';
                            if (size > 15) sizeClass = 'country-huge';       
                            else if (size > 4) sizeClass = 'country-medium';

                            const labelIcon = L.divIcon({
                                className: `country-label ${sizeClass}`,
                                html: feature.properties.name,
                                iconSize: [120, 20],
                                iconAnchor: [60, 10]
                            });
                            
                            L.marker(centerPos, { icon: labelIcon, interactive: false }).addTo(map);
                            
                        } catch(e) {
                            console.error("Label error on:", feature.properties.name);
                        }
                    }
                }
            }).addTo(map);
        })
        .catch(err => console.error("Failed to load map data:", err));
    
    markerLayer = L.layerGroup().addTo(map);
    
    map.on('zoomend', function() {
        const currentZoom = map.getZoom();
        const mapElement = document.getElementById('worldMap');
        
        mapElement.classList.toggle('show-huge', currentZoom >= 3);
        mapElement.classList.toggle('hide-continents', currentZoom >= 4);
        mapElement.classList.toggle('show-medium', currentZoom >= 4);
        mapElement.classList.toggle('show-small', currentZoom >= 5);
    });

    map.fire('zoomend');

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

async function loadRawTasks(btnElement) {
    if(btnElement) btnElement.innerText = "Loading...";
    try {
        const response = await fetch('/api/tasks');
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        const rawText = data.result || "";
        const container = document.getElementById('tasksContainer');
        container.innerHTML = ''; 
        
        const blocks = rawText.split(/-{20,}/);
        
        blocks.forEach(block => {
            const cleanBlock = block.trim();
            if(cleanBlock === "") return;
            
            const div = document.createElement('div');
            div.className = 'task-block'; 
            div.style.borderBottom = '1px dashed #2D3136';
            div.style.paddingBottom = '15px';
            div.style.marginBottom = '15px';
            
            const pre = document.createElement('pre');
            pre.style.margin = '0';
            pre.style.fontFamily = "'Consolas', monospace";
            pre.style.color = '#A3BE8C';
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordBreak = 'break-all';
            pre.style.fontSize = '13px';
            
            pre.innerHTML = DOMPurify.sanitize(cleanBlock);
            
            div.appendChild(pre);
            container.appendChild(div);
        });
        
    } catch (error) {
        document.getElementById('tasksContainer').innerHTML = `<span style="color:#EF4444;">Error: ${error.message || error}</span>`;
    }
    if(btnElement) btnElement.innerText = "Refresh Tasks";
}

function filterTaskBlocks() {
    const filter = document.getElementById('taskSearchInput').value.toLowerCase();
    const blocks = document.querySelectorAll('.task-block');
    
    blocks.forEach(block => {
        if (block.innerText.toLowerCase().includes(filter)) {
            block.style.display = "block";
        } else {
            block.style.display = "none";
        }
    });
}

window.addEventListener('DOMContentLoaded', initWebSocket);

let curlparserRequests = [];
let activeReqId = null;

function toggleCurlModal(show) {
    document.getElementById('curlModal').style.display = show ? 'flex' : 'none';
    if(show) {
        document.getElementById('curlInput').value = '';
        document.getElementById('curlInput').focus();
    }
}

async function parseCurlAndAdd() {
    const rawCurl = document.getElementById('curlInput').value.trim();
    if (!rawCurl) return;

    let cleanStr = rawCurl
        .replace(/(?:\\|\^)\s*[\n\r]+/g, ' ')
        .replace(/[\n\r]+/g, ' ')
        .replace(/\$'/g, "'")
        .replace(/\^"/g, '"')
        .replace(/\^/g, ''); 
    let tokens = [];
    let current = "";
    let quoteChar = null;
    let escapeNext = false;

    for (let i = 0; i < cleanStr.length; i++) {
        let char = cleanStr[i];

        if (escapeNext) {
            current += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (quoteChar) {
            if (char === quoteChar) {
                quoteChar = null; 
            } else {
                current += char;  
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quoteChar = char;
            continue;
        }

        if (/\s/.test(char)) {
            if (current.length > 0) {
                tokens.push(current);
                current = "";
            }
            continue;
        }

        current += char;
    }
    if (current.length > 0) tokens.push(current);

    let method = "GET";
    let url = "";
    let headers = {};
    let body = "";

    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i];
        
        if (t.toLowerCase() === 'curl' || t.toLowerCase() === 'curl.exe') continue;

        if (t === '-H' || t === '--header') {
            let headerRaw = tokens[++i];
            if (headerRaw) {
                let idx = headerRaw.indexOf(':');
                if (idx > -1) {
                    headers[headerRaw.substring(0, idx).trim()] = headerRaw.substring(idx + 1).trim();
                }
            }
            continue;
        }

        if (t === '-X' || t === '--request') {
            if (tokens[i+1]) {
                method = tokens[++i].toUpperCase();
            }
            continue;
        }

        if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary' || t === '--data-urlencode') {
            if (tokens[i+1]) {
                body = tokens[++i];
                if (method === "GET") method = "POST";
            }
            continue;
        }

        if (t === '--url') {
            if (tokens[i+1]) {
                url = tokens[++i];
            }
            continue;
        }

        if (t.startsWith('-')) {
            const argsToSkip = ['-A', '--user-agent', '-e', '--referer', '-b', '--cookie', '-o', '--output', '-m', '--max-time'];
            if (argsToSkip.includes(t)) i++;  
            continue;
        }

        if (!url && (t.startsWith('http') || t.includes('://'))) {
            url = t;
        }
    }

    let domain = "Unknown Domain";
    let path = "/";
    try {
        const parsedUrl = new URL(url);
        domain = parsedUrl.hostname;
        path = parsedUrl.pathname + parsedUrl.search;
    } catch (e) {
        if (url) domain = url;
    }

    const newReq = {
        id: Date.now().toString(),
        method,
        url,
        domain,
        path,
        headers,
        body: formatIfJson(body)
    };

    fetch('/api/curlparser/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq)
    }).catch(err => console.error("Save error:", err));

    curlparserRequests.unshift(newReq);
    toggleCurlModal(false);
    rendercurlparserSidebar();
    
    selectcurlparserRequest(newReq.id);
}

function rendercurlparserSidebar() {
    const sidebar = document.getElementById('curlparserSidebar');
    sidebar.innerHTML = "";

    if (curlparserRequests.length === 0) {
        sidebar.innerHTML = '<div class="empty-state">No requests yet. Add a new cURL.</div>';
        return;
    }

    curlparserRequests.forEach(req => {
        let methodColor = req.method === "GET" ? "#10B981" : (req.method === "POST" ? "#3B82F6" : (req.method === "DELETE" ? "#EF4444" : "#F59E0B"));
        let isActive = req.id === activeReqId;

        const item = document.createElement('div');
        item.style = `padding: 12px; border-bottom: 1px solid #2D3136; cursor: pointer; transition: 0.1s; background: ${isActive ? 'rgba(59,130,246,0.1)' : 'transparent'}; border-left: 3px solid ${isActive ? '#3B82F6' : 'transparent'};`;
        item.onclick = () => selectcurlparserRequest(req.id);
        
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                <span style="color: ${methodColor}; font-weight: 800; font-size: 11px; letter-spacing: 0.5px;">${req.method}</span>
                <span style="color: #9CA3AF; font-size: 10px; text-transform: uppercase;">${DOMPurify.sanitize(req.domain)}</span>
            </div>
            <div style="font-size: 12px; color: ${isActive ? '#FFF' : '#D1D5DB'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace;">${DOMPurify.sanitize(req.path)}</div>
        `;
        sidebar.appendChild(item);
    });
}

function selectcurlparserRequest(id) {
    activeReqId = id;
    const req = curlparserRequests.find(r => r.id === id);
    if (!req) return;

    document.getElementById('reqMethod').value = req.method;
    document.getElementById('reqUrl').value = req.url;
    
    let headerText = "";
    for (const [key, value] of Object.entries(req.headers)) {
        headerText += `${key}: ${value}\n`;
    }
    
    document.getElementById('reqHeaders').value = headerText.trim();
    document.getElementById('reqBody').value = req.body ? formatIfJson(req.body) : ""; 

    document.getElementById('resHeaders').value = "";
    document.getElementById('resBody').value = "";
    document.getElementById('resStatus').innerText = "Ready to Send";
    document.getElementById('resStatus').style.background = "rgba(255,255,255,0.05)";
    document.getElementById('resStatus').style.color = "#9CA3AF";

    rendercurlparserSidebar();
}

async function sendcurlparserRequest() {
    if (!activeReqId) return;

    const btn = document.getElementById('sendReqBtn');
    const statusBadge = document.getElementById('resStatus');
    
    btn.disabled = true;
    btn.innerText = "Processing...";
    statusBadge.innerText = "Waiting...";
    
    const method = document.getElementById('reqMethod').value;
    const url = document.getElementById('reqUrl').value;
    const bodyStr = document.getElementById('reqBody').value;
    
    let headersObj = {};
    const headersStr = document.getElementById('reqHeaders').value.trim();
    if (headersStr) {
        const lines = headersStr.split('\n');
        for (let line of lines) {
            const idx = line.indexOf(':');
            if (idx > 0) {
                const k = line.substring(0, idx).trim();
                const v = line.substring(idx + 1).trim();
                if (k) headersObj[k] = v;
            }
        }
    }

    try {
        const res = await fetch('/api/curlparser/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, url, headers: headersObj, body: bodyStr })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const code = data.status_code;
        statusBadge.innerText = `${code} ${data.status_text || ''}`;
        statusBadge.style.background = (code >= 200 && code < 300) ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
        statusBadge.style.color = (code >= 200 && code < 300) ? "#10B981" : "#EF4444";

        let resHeaderText = "";
        if (data.headers) {
            for (let [k, v] of Object.entries(data.headers)) {
                let val = Array.isArray(v) ? v.join('; ') : v;
                resHeaderText += `${k}: ${val}\n`;
            }
        }
        document.getElementById('resHeaders').value = resHeaderText.trim();
        
        document.getElementById('resBody').value = formatIfJson(data.body);

    } catch (err) {
        statusBadge.innerText = "Connection Failed";
        statusBadge.style.background = "rgba(239, 68, 68, 0.1)";
        statusBadge.style.color = "#EF4444";
        document.getElementById('resBody').value = "[SYS ERROR] " + err.message;
        document.getElementById('resHeaders').value = "";
    } finally {
        btn.disabled = false;
        btn.innerText = "Send";
    }
}

function formatIfJson(text) {
    if (!text) return "";
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch (e) {
        return text;
    }
}

async function loadcurlparserRequests() {
    try {
        const res = await fetch('/api/curlparser/requests');
        const data = await res.json();
        if (data) {
            curlparserRequests = data;
            rendercurlparserSidebar();
        }
    } catch (e) {
        console.error("Failed to load requests:", e);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadcurlparserRequests();
});