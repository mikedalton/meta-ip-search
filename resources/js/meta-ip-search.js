const url = 'https://api.github.com/meta';

class IPSubnet {
    constructor(cidr, service) {
        this.cidr = cidr;
        this.service = service;
        const [network, prefixLength] = cidr.split('/');
        this.network = network;
        this.prefixLength = parseInt(prefixLength, 10);
        this.isIPv6 = network.includes(':');
    }

    parseIPv4(ip) {
        return ip.split('.').map(Number);
    }

    parseIPv6(ip) {
        const parts = ip.split(':');
        const fullParts = [];
        for (const part of parts) {
            if (part === '') {
                fullParts.push(...Array(8 - parts.length + 1).fill('0000'));
            } else {
                fullParts.push(part.padStart(4, '0'));
            }
        }
        return fullParts.join('');
    }

    isInSubnet(ip) {
        if (this.isIPv6) {
            const subnetBinary = this.parseIPv6(this.network);
            const ipBinary = this.parseIPv6(ip);
            return subnetBinary.slice(0, this.prefixLength) === ipBinary.slice(0, this.prefixLength);
        } else {
            const subnetParts = this.parseIPv4(this.network);
            const ipParts = this.parseIPv4(ip);
            const mask = -1 << (32 - this.prefixLength);
            const subnetInt = subnetParts.reduce((acc, part) => (acc << 8) + part, 0);
            const ipInt = ipParts.reduce((acc, part) => (acc << 8) + part, 0);
            return (subnetInt & mask) === (ipInt & mask);
        }
    }
}

const githubNetworks = [];
let data;
let dataLoaded = false;
let pendingSearch = null;

const searchIP = (ip) => {
    return githubNetworks.filter(network => network.isInSubnet(ip));
};

// Function to check for and execute any pending search
const checkPendingSearch = () => {
    if (pendingSearch && dataLoaded) {
        pendingSearch();
        pendingSearch = null;
    }
};

// Function to schedule a search after data is loaded
const scheduleSearch = (searchFunction) => {
    if (dataLoaded) {
        // If data is already loaded, execute immediately
        searchFunction();
    } else {
        // Otherwise, store as pending
        pendingSearch = searchFunction;
    }
};

$(document).ready(() => {
    $("#status-container").text("Fetching data from GitHub API...");
    $.getJSON(url, (json) => {
        data = json;
        const ignoredKeys = ["verifiable_password_authentication", "ssh_key_fingerprints", "ssh_keys", "domains"];
        Object.keys(data).forEach(key => {
            if (!ignoredKeys.includes(key)) {
                const networks = data[key];
                networks.forEach(cidr => {
                    const networkObject = new IPSubnet(cidr, key);
                    githubNetworks.push(networkObject);
                });
            }
        });
        dataLoaded = true;
        $("#status-container").text(`Loaded ${githubNetworks.length} IP ranges`);
        // Check if there's a pending search
        checkPendingSearch();
    });
});