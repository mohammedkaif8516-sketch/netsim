/**
 * debriefs.ts — what the player is told AFTER resolving a ticket: the real root cause, why it breaks things,
 * a reference fix, and what to remember. Keyed by scenario id.
 *
 * `solution` is run against the real simulator in the test harness: every entry must turn all checks green,
 * so the reference fix shown to players can never be wrong.
 */
export interface Debrief {
  rootCause: string;
  explanation: string;
  /** reference fix, in order. Router/switch steps include the mode changes. */
  solution: { device: string; commands: string[] }[];
  lesson: string;
  /** knowledge-base entry ids worth re-reading (lib/data/knowledge.ts) */
  review: string[];
}

const cfg = (...c: string[]) => ["enable", "configure terminal", ...c, "end"];

export const debriefs: Record<string, Debrief> = {
  "dhcp-pool": {
    rootCause: "The DHCP pool was built for 10.10.30.0/24, but the gateway interface sits in 10.10.20.0/24.",
    explanation: "A DHCP server only answers on an interface whose subnet matches a pool's network statement. With the wrong network, every DISCOVER from the HR laptops was ignored, so they fell back to self-assigned addresses.",
    solution: [
      { device: "HR-GW", commands: cfg("ip dhcp pool HR", "network 10.10.20.0 255.255.255.0") },
      { device: "HR-LT-204", commands: ["ip dhcp"] },
      { device: "HR-LT-205", commands: ["ip dhcp"] },
    ],
    lesson: "When DHCP fails, compare the pool's network with the interface subnet before anything else.",
    review: ["dhcp-network", "dhcp-show-pool", "brief"],
  },
  "dhcp-exhausted": {
    rootCause: "Every address in the pool (10.70.10.1 to .254) was listed as excluded, leaving nothing to lease.",
    explanation: "The pool and service were configured correctly, which is why the fault was easy to miss. `ip dhcp excluded-address` removes addresses from the pool, and excluding the whole range empties it.",
    solution: [
      { device: "AUS-HR-GW", commands: cfg("no ip dhcp excluded-address 10.70.10.1 10.70.10.254", "ip dhcp excluded-address 10.70.10.1 10.70.10.10") },
      { device: "AUS-HR-LT-1", commands: ["ip dhcp"] },
      { device: "AUS-HR-LT-2", commands: ["ip dhcp"] },
    ],
    lesson: "A healthy-looking pool can still be empty. Check total, leased and excluded addresses together.",
    review: ["dhcp-excl", "dhcp-show-pool", "dhcp-client"],
  },
  "dhcp-router": {
    rootCause: "The pool handed out 10.10.40.254 as the default router, but the real gateway is 10.10.40.1.",
    explanation: "Clients received valid addresses, so local traffic worked. Anything off-subnet was sent to a gateway that doesn't exist, which is why only nearby devices were reachable.",
    solution: [
      { device: "BLR-HR-GW", commands: cfg("ip dhcp pool LAN", "default-router 10.10.40.1") },
      { device: "NEWHIRE-1", commands: ["ip dhcp"] },
      { device: "NEWHIRE-2", commands: ["ip dhcp"] },
    ],
    lesson: "Hosts keep the settings they were leased. After fixing the server, renew the clients.",
    review: ["dhcp-gw", "show-ip-h", "dhcp-client"],
  },
  "dhcp-service": {
    rootCause: "`no service dhcp` was configured, switching the DHCP server off even though the pool was correct.",
    explanation: "Existing devices kept working on their old leases, which hid the problem. New devices asked for an address and nothing answered.",
    solution: [
      { device: "AUS-FIN-GW", commands: cfg("service dhcp") },
      { device: "FIN-WS-31", commands: ["ip dhcp"] },
      { device: "FIN-WS-32", commands: ["ip dhcp"] },
    ],
    lesson: "Read the top of `show running-config`. Global switches like `no service dhcp` live there.",
    review: ["dhcp-svc", "run", "dhcp-show-bind"],
  },
  "dhcp-conflict": {
    rootCause: "The printer's static address 10.60.20.11 was inside the DHCP range and not excluded, so a workstation was leased the same address.",
    explanation: "DHCP knows nothing about devices configured by hand. The server gave out the first free address, which the printer already used, so two devices shared one IP.",
    solution: [
      { device: "MUC-WH-GW", commands: cfg("ip dhcp excluded-address 10.60.20.11") },
      { device: "WH-WS-07", commands: ["ip dhcp -r", "ip dhcp"] },
    ],
    lesson: "Every statically addressed device in a DHCP subnet must be excluded from the pool.",
    review: ["dhcp-excl", "dhcp-release", "show-ip-h"],
  },
  "default-route": {
    rootCause: "BLR-GW had no default route, so it dropped everything that wasn't on a connected network.",
    explanation: "Internal traffic worked because those networks are directly connected. The internet isn't in the routing table, and without a default route the router has nowhere to send it.",
    solution: [{ device: "BLR-GW", commands: cfg("ip route 0.0.0.0 0.0.0.0 203.0.113.1") }],
    lesson: "`show ip route` and look for S*. 'Internal works, external doesn't' points at the default route.",
    review: ["ip-route-default", "show-route", "trace-h"],
  },
  "static-route": {
    rootCause: "REMOTE-R's static route had a typo: 10.30.1.0/24 instead of the HR subnet 10.30.10.0/24.",
    explanation: "The route was valid, so nothing complained, but it described a network that doesn't exist. Traffic for the real HR subnet had no matching route and was dropped.",
    solution: [{ device: "REMOTE-R", commands: cfg("ip route 10.30.10.0 255.255.255.0 172.16.0.1", "no ip route 10.30.1.0 255.255.255.0 172.16.0.1") }],
    lesson: "A route that exists isn't necessarily right. Compare each digit with the real subnet.",
    review: ["ip-route", "no-ip-route", "show-route"],
  },
  "next-hop": {
    rootCause: "WH-GW sent data-center traffic to OLD-R (10.40.2.2), a decommissioned router, instead of DC-R1 (10.40.1.2).",
    explanation: "The route was installed and the next hop answered ARP, so everything looked fine until the packet reached OLD-R, which had no onward route. Adding the right route without removing the old one wouldn't help: the first route stays installed.",
    solution: [{ device: "WH-GW", commands: cfg("no ip route 10.60.0.0 255.255.255.0 10.40.2.2", "ip route 10.60.0.0 255.255.255.0 10.40.1.2") }],
    lesson: "`trace` shows which router the traffic goes to. Remove the wrong route before adding the right one.",
    review: ["trace-h", "no-ip-route", "ip-route"],
  },
  "link-shutdown": {
    rootCause: "The switch port the desk was moved to was left administratively shut down.",
    explanation: "Nothing above Layer 1 can work on a port that is shut. The workstation's address and gateway were fine, but its link was down.",
    solution: [{ device: "HR-FLOOR-SW", commands: cfg("interface Ethernet0/1", "no shutdown") }],
    lesson: "Start at Layer 1. `show interfaces status` takes a few seconds and rules out the whole class.",
    review: ["if-status", "no-shut", "brief"],
  },
  "bad-gateway": {
    rootCause: "The laptop's default gateway was 10.50.20.254, but the router answers on 10.50.20.1.",
    explanation: "The laptop could talk to neighbours on its own subnet, so it looked half-working. Every off-subnet packet went to a gateway that doesn't exist.",
    solution: [{ device: "SALES-LT-14", commands: ["ip 10.50.20.50/24 10.50.20.1"] }],
    lesson: "Compare the host's gateway with the router's interface address. They must match exactly.",
    review: ["show-ip-h", "ip-static", "ping-h"],
  },
  "bad-mask": {
    rootCause: "The workstation had mask 255.255.255.192 (/26) instead of /24, which put its own gateway outside its subnet.",
    explanation: "With a /26, the workstation believed 10.30.40.1 and 10.30.40.20 were on other networks, so it never tried to reach them directly.",
    solution: [{ device: "FIN-WS-12", commands: ["ip 10.30.40.200/24 10.30.40.1"] }],
    lesson: "Compare the prefix length on a broken host with a working neighbour's.",
    review: ["show-ip-h", "ip-static", "ping-h"],
  },
  "vlan-access": {
    rootCause: "The two scanner ports were left in VLAN 10 (office) instead of VLAN 20 (warehouse).",
    explanation: "VLANs are separate broadcast domains. The scanners were cabled and powered, but they sat in a different VLAN from their gateway and the WMS server.",
    solution: [{ device: "WH-SW3", commands: cfg("interface Ethernet0/1", "switchport access vlan 20", "exit", "interface Ethernet0/2", "switchport access vlan 20") }],
    lesson: "Moving a device to a new port means checking that port's VLAN.",
    review: ["vlan-brief", "access-vlan", "if-range"],
  },
  "vlan-missing": {
    rootCause: "VLAN 40 was never created on the replacement switch.",
    explanation: "The ports were configured for VLAN 40, but a port can't carry a VLAN that isn't in the switch's database. The office VLAN worked, which made the fault look specific to the scanners.",
    solution: [{ device: "WH-SW4", commands: cfg("vlan 40", "name SCANNERS") }],
    lesson: "After a switch swap, compare `show vlan brief` with the old switch's VLANs.",
    review: ["vlan-brief", "vlan-create", "vlan-name"],
  },
  "trunk-allowed": {
    rootCause: "The trunk from DIST-SW only allowed VLANs 10 and 20, so VLAN 30 never crossed to the new floor.",
    explanation: "Hosts on the new floor could reach each other (same switch), but their gateway is on the other side of the trunk, which silently dropped VLAN 30 frames.",
    solution: [{ device: "DIST-SW", commands: cfg("interface Ethernet0/1", "switchport trunk allowed vlan add 30") }],
    lesson: "`show interfaces trunk` lists allowed VLANs per link. Use `add` so you don't replace the list.",
    review: ["trunk-show", "trunk-add", "mode-trunk"],
  },
  "vtp-client": {
    rootCause: "The new switch was in VTP domain MERIDIAN-HR, while the distribution switch uses MERIDIAN.",
    explanation: "A VTP client only accepts updates from its own domain. The VLAN was on the distribution switch but never propagated, and you can't create VLANs by hand on a client.",
    solution: [{ device: "BLR-ACC-SW", commands: cfg("vtp domain MERIDIAN") }],
    lesson: "Compare `show vtp status` on both switches: domain, mode and revision.",
    review: ["vtp-status", "vtp-domain", "vtp-mode"],
  },
  "inter-vlan": {
    rootCause: "The HR sub-interface used `encapsulation dot1q 200`, but the HR VLAN is 20.",
    explanation: "The router listened for tag 200 and never saw HR's tagged frames, so it had no working gateway on that VLAN. Finance reached its own gateway fine, which narrowed it down.",
    solution: [{ device: "IV-GW", commands: cfg("interface Ethernet0/0.20", "encapsulation dot1q 20") }],
    lesson: "On router-on-a-stick, each sub-interface's dot1q number must equal its VLAN id.",
    review: ["subif", "dot1q", "run"],
  },
  "missing-return": {
    rootCause: "DC-GW had no route back to the Finance subnet 10.90.10.0/24.",
    explanation: "The request reached the ERP server, but the reply had no path home, so the ping timed out instead of reporting 'unreachable'. Routing has to work in both directions.",
    solution: [{ device: "DC-GW", commands: cfg("ip route 10.90.10.0 255.255.255.0 10.90.1.1") }],
    lesson: "A timeout often means 'the reply got lost'. Check the return path on every router.",
    review: ["ip-route", "show-route", "trace-h"],
  },
  "printer-gateway": {
    rootCause: "The printer's default gateway was 10.20.50.254, but the router is at 10.20.50.1.",
    explanation: "The printer received requests from other subnets but sent its replies to a gateway that doesn't exist. Devices on its own subnet worked, which hid the fault.",
    solution: [{ device: "MR-PRN", commands: ["ip 10.20.50.20/24 10.20.50.1"] }],
    lesson: "'Reachable from here but not from there' usually means the destination's replies take the wrong way back.",
    review: ["show-ip-h", "ip-static", "ping-h"],
  },
};