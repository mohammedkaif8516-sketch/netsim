/**
 * knowledge.ts — the command cheat-sheet behind the Knowledge base drawer.
 *
 * Every `example` is a concrete line that is run against the real simulator in the test harness,
 * so an entry that the engine would reject cannot be shipped by accident.
 */
import type { Ticket } from "./tickets";

export type KbDevice = "router" | "switch" | "host";
export type KbTopic = "basics" | "dhcp" | "routing" | "vlan" | "vtp";
/** which prompt the command is typed at */
export type KbMode = "exec" | "config" | "interface" | "subinterface" | "dhcp-pool" | "vlan" | "host";

export interface KbEntry {
  id: string;
  topic: KbTopic;
  device: KbDevice;
  mode: KbMode;
  /** syntax with <placeholders> */
  command: string;
  /** a real, runnable line */
  example: string;
  what: string;
  tip?: string;
}

export const TOPICS: { id: KbTopic; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "dhcp", label: "DHCP" },
  { id: "routing", label: "Routing" },
  { id: "vlan", label: "VLAN / trunk" },
  { id: "vtp", label: "VTP" },
];
export const MODE_LABEL: Record<KbMode, string> = {
  exec: "privileged exec  #",
  config: "global config  (config)#",
  interface: "interface  (config-if)#",
  subinterface: "sub-interface  (config-subif)#",
  "dhcp-pool": "DHCP pool  (dhcp-config)#",
  vlan: "VLAN  (config-vlan)#",
  host: "PC / printer / server  >",
};
export const DEVICE_LABEL: Record<KbDevice, string> = { router: "Router", switch: "Switch", host: "Host" };

const e = (
  id: string, topic: KbTopic, device: KbDevice, mode: KbMode, command: string, example: string, what: string, tip?: string,
): KbEntry => ({ id, topic, device, mode, command, example, what, tip });

export const knowledge: KbEntry[] = [
  /* ───────── basics ───────── */
  e("enable", "basics", "router", "exec", "enable", "enable", "Enter privileged mode (prompt changes from > to #). Needed before show commands and configuration."),
  e("conf-t", "basics", "router", "exec", "configure terminal", "configure terminal", "Enter global configuration mode.", "Leave a mode with `exit`, or jump straight back to # with `end`."),
  e("run", "basics", "router", "exec", "show running-config", "show running-config", "The current configuration. Read it top to bottom: most faults are visible here.", "On a switch, port VLANs and trunk modes show up under each interface."),
  e("brief", "basics", "router", "exec", "show ip interface brief", "show ip interface brief", "Every interface with its IP and status. First stop for 'is it up, does it have the right address?'", "Status `administratively down` means someone typed `shutdown`."),
  e("show-if", "basics", "router", "exec", "show interfaces <if>", "show interfaces Ethernet0/0", "Detail for one interface: line protocol, address, counters."),
  e("if-enter", "basics", "router", "config", "interface <if>", "interface Ethernet0/0", "Select an interface to configure."),
  e("ip-addr", "basics", "router", "interface", "ip address <ip> <mask>", "ip address 10.0.0.1 255.255.255.0", "Give the interface an address."),
  e("no-shut", "basics", "router", "interface", "no shutdown", "no shutdown", "Bring an interface up. Router interfaces start shut down.", "Same command on a switch port that someone left disabled."),
  e("shut", "basics", "router", "interface", "shutdown", "shutdown", "Administratively disable an interface."),
  e("ping-r", "basics", "router", "exec", "ping <ip>", "ping 10.0.0.2", "Send ICMP echo from the router.", "Pinging from the router tests that hop only; test from the affected host too."),
  e("trace-r", "basics", "router", "exec", "traceroute <ip>", "traceroute 10.0.0.2", "Show each router hop on the way to a destination.", "The last hop that answers is where to look next."),
  e("show-arp", "basics", "router", "exec", "show ip arp", "show ip arp", "IP-to-MAC mappings the router has learned. An address missing here means nothing answered ARP."),
  e("ping-h", "basics", "host", "host", "ping <ip>", "ping 10.0.0.1", "Test reachability from the host. `timeout` means no reply; `unreachable` means a router said no route.", "Work outwards: own gateway first, then something beyond it."),
  e("trace-h", "basics", "host", "host", "trace <ip>", "trace 10.0.0.1", "Hop-by-hop path from the host."),
  e("show-ip-h", "basics", "host", "host", "show ip", "show ip", "Address, mask and gateway configured on the host. Compare them with the router."),
  e("arp-h", "basics", "host", "host", "arp", "arp", "The host's ARP cache."),
  e("ip-static", "basics", "host", "host", "ip <addr>/<len> <gateway>", "ip 10.0.0.50/24 10.0.0.1", "Set a static address, mask length and default gateway on the host.", "Rejected if the gateway is not inside the host's subnet."),
  /* ───────── DHCP ───────── */
  e("dhcp-client", "dhcp", "host", "host", "ip dhcp", "ip dhcp", "Ask a DHCP server for an address.", "After you fix the server, run this again: hosts keep their old settings until they renew."),
  e("dhcp-release", "dhcp", "host", "host", "ip dhcp -r", "ip dhcp -r", "Release the current lease, so the next `ip dhcp` starts fresh."),
  e("dhcp-pool", "dhcp", "router", "config", "ip dhcp pool <name>", "ip dhcp pool LAN", "Create or enter a DHCP pool."),
  e("dhcp-network", "dhcp", "router", "dhcp-pool", "network <net> <mask>", "network 10.0.0.0 255.255.255.0", "The subnet the pool serves. It must match the subnet of the interface the clients are on.", "A pool for a different subnet is silently ignored."),
  e("dhcp-gw", "dhcp", "router", "dhcp-pool", "default-router <ip>", "default-router 10.0.0.1", "The gateway handed to clients. It is normally the router's own interface address."),
  e("dhcp-dns", "dhcp", "router", "dhcp-pool", "dns-server <ip>", "dns-server 10.0.0.53", "DNS server handed to clients."),
  e("dhcp-excl", "dhcp", "router", "config", "ip dhcp excluded-address <from> [<to>]", "ip dhcp excluded-address 10.0.0.1 10.0.0.10", "Keep addresses out of the pool, for routers, printers and servers with static IPs.", "Excluding the whole range leaves nothing to lease. Remove with `no ip dhcp excluded-address <from> <to>`."),
  e("dhcp-svc", "dhcp", "router", "config", "service dhcp", "service dhcp", "Turn the DHCP server on. `no service dhcp` turns it off, even with pools configured."),
  e("dhcp-show-pool", "dhcp", "router", "exec", "show ip dhcp pool", "show ip dhcp pool", "Each pool's address range, total and leased addresses."),
  e("dhcp-show-bind", "dhcp", "router", "exec", "show ip dhcp binding", "show ip dhcp binding", "Active leases: which MAC has which address."),
  e("dhcp-clear", "dhcp", "router", "exec", "clear ip dhcp binding *", "clear ip dhcp binding *", "Clear all leases (or give one address instead of *)."),
  e("dhcp-helper", "dhcp", "router", "interface", "ip helper-address <server-ip>", "ip helper-address 10.0.0.5", "Relay DHCP requests to a server on another subnet."),
  /* ───────── routing ───────── */
  e("show-route", "routing", "router", "exec", "show ip route", "show ip route", "The routing table. C = connected, S = static; S* is the default route.", "No matching line means the router will drop that traffic."),
  e("show-route-static", "routing", "router", "exec", "show ip route static", "show ip route static", "Only the static routes."),
  e("ip-route", "routing", "router", "config", "ip route <net> <mask> <next-hop>", "ip route 10.1.0.0 255.255.255.0 10.0.0.2", "Add a static route. The next hop must be on a directly connected subnet.", "Routing is two-way: the far router needs a route back, or pings time out."),
  e("ip-route-default", "routing", "router", "config", "ip route 0.0.0.0 0.0.0.0 <next-hop>", "ip route 0.0.0.0 0.0.0.0 10.0.0.2", "Default route: where to send everything not in the table, usually towards the ISP."),
  e("no-ip-route", "routing", "router", "config", "no ip route <net> <mask> [<next-hop>]", "no ip route 10.1.0.0 255.255.255.0", "Remove a static route.", "A wrong next hop must be removed, not just added again: the first route stays installed."),
  e("subif", "routing", "router", "config", "interface <if>.<vlan>", "interface Ethernet0/0.10", "Create a sub-interface for router-on-a-stick inter-VLAN routing."),
  e("dot1q", "routing", "router", "subinterface", "encapsulation dot1q <vlan>", "encapsulation dot1q 10", "The VLAN tag this sub-interface serves. It must match the VLAN number exactly.", "Then give the sub-interface that VLAN's gateway address."),
  /* ───────── VLAN / trunk ───────── */
  e("vlan-brief", "vlan", "switch", "exec", "show vlan brief", "show vlan brief", "VLANs in the database and which ports belong to each."),
  e("if-status", "vlan", "switch", "exec", "show interfaces status", "show interfaces status", "Every port: up/down, VLAN, trunk or access."),
  e("trunk-show", "vlan", "switch", "exec", "show interfaces trunk", "show interfaces trunk", "Trunk ports, native VLAN, and the VLANs each trunk allows.", "A VLAN missing from 'allowed' is blocked on that link."),
  e("mac-table", "vlan", "switch", "exec", "show mac address-table", "show mac address-table", "Which MAC the switch learned on which port and VLAN."),
  e("vlan-create", "vlan", "switch", "config", "vlan <id>", "vlan 10", "Create a VLAN (and enter its config). A port can't carry a VLAN that doesn't exist.", "Not allowed on a VTP client switch."),
  e("vlan-name", "vlan", "switch", "vlan", "name <name>", "name SALES", "Name the VLAN."),
  e("if-range", "vlan", "switch", "config", "interface range <if> - <n>", "interface range Ethernet0/1 - 2", "Configure several ports at once."),
  e("mode-access", "vlan", "switch", "interface", "switchport mode access", "switchport mode access", "Make the port an access port for one VLAN."),
  e("access-vlan", "vlan", "switch", "interface", "switchport access vlan <id>", "switchport access vlan 10", "Put an access port in a VLAN.", "Moving a device to a new port? Check this port's VLAN."),
  e("mode-trunk", "vlan", "switch", "interface", "switchport mode trunk", "switchport mode trunk", "Make the port carry many VLANs (to a switch or a router sub-interface)."),
  e("trunk-add", "vlan", "switch", "interface", "switchport trunk allowed vlan add <id>", "switchport trunk allowed vlan add 30", "Allow another VLAN on a trunk without disturbing the others.", "Without `add`, the list is replaced instead."),
  e("trunk-native", "vlan", "switch", "interface", "switchport trunk native vlan <id>", "switchport trunk native vlan 99", "The untagged VLAN on a trunk. It must match on both ends."),
  /* ───────── VTP ───────── */
  e("vtp-status", "vtp", "switch", "exec", "show vtp status", "show vtp status", "VTP mode, domain, revision and VLAN count."),
  e("vtp-domain", "vtp", "switch", "config", "vtp domain <name>", "vtp domain CORP", "Join a VTP domain. Names are case-sensitive and must match exactly for VLANs to sync.", "Changing the domain resets the revision to 0."),
  e("vtp-mode", "vtp", "switch", "config", "vtp mode <server|client|transparent>", "vtp mode client", "Servers create VLANs; clients only receive them; transparent switches keep their own."),
  e("vtp-pw", "vtp", "switch", "config", "vtp password <pw>", "vtp password secret", "Shared password; a mismatch stops synchronisation."),
];

/** which topics matter for a ticket, judged from its category text */
export function topicsFor(t: Ticket): KbTopic[] {
  const c = t.category.toLowerCase();
  const out = new Set<KbTopic>(["basics"]);
  if (c.includes("dhcp")) out.add("dhcp");
  if (c.includes("rout") || c.includes("ip /")) out.add("routing");
  if (c.includes("vlan") || c.includes("trunk") || c.includes("switch") || c.includes("layer 1")) out.add("vlan");
  if (c.includes("vtp")) out.add("vtp");
  if (c.includes("inter-vlan")) { out.add("routing"); out.add("vlan"); }
  if (c.includes("connectivity")) out.add("routing");
  return [...out];
}