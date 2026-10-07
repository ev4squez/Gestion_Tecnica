import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./requester.css";

const api = async (path: string, token?: string, init: RequestInit = {}) => {
  const r = await fetch("/api" + path, { ...init, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...init.headers } });
  if (!r.ok) { const body = await r.json().catch(() => ({})); throw new Error(body.detail ?? r.statusText); }
  return r.json();
};
const STATES: Record<string, string> = { OPERATIVA: "Operativa", OPERATIVA_CON_OBSERVACION: "Con observación", EN_MANTENIMIENTO: "En mantenimiento", FUERA_DE_SERVICIO: "Fuera de servicio", PENDIENTE_DE_REPUESTO: "Pendiente repuesto", RETIRADA: "Retirada" };
const STATUS_CLASS: Record<string, string> = { OPERATIVA: "green", OPERATIVA_CON_OBSERVACION: "yellow", EN_MANTENIMIENTO: "orange", FUERA_DE_SERVICIO: "red", PENDIENTE_DE_REPUESTO: "blue", RETIRADA: "gray" };
const TICKET_STATUS_INFO = [
  ["NUEVO", "Nuevo", "#5684e8"], ["ASIGNADO", "Asignado", "#8a73dc"], ["EN PROCESO", "En proceso", "#e6a33a"],
  ["PENDIENTE", "Pendiente", "#e87949"], ["ESPERANDO REPUESTO", "Esperando repuesto", "#35a8a0"],
  ["ESPERANDO PROVEEDOR", "Esperando proveedor", "#5a9acb"], ["RESUELTO", "Resuelto", "#45a879"],
  ["CERRADO", "Cerrado", "#68798f"], ["CANCELADO", "Cancelado", "#b8c0cc"],
] as const;
const MACHINE_STATUS_COLORS: Record<string, string> = { OPERATIVA: "#38a66f", OPERATIVA_CON_OBSERVACION: "#d4aa32", EN_MANTENIMIENTO: "#e98c35", FUERA_DE_SERVICIO: "#e05e59", PENDIENTE_DE_REPUESTO: "#4a8cce", RETIRADA: "#8993a0" };
const normalizeSearch = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").trim();
const machineSearchText = (machine: any) => [machine.number, machine.serial, machine.island, machine.area, machine.status, STATES[machine.status], machine.manufacturer, machine.model].filter(Boolean).join(" ");
const matchesMachineSearch = (machine: any, query: string) => {
  const haystack = normalizeSearch(machineSearchText(machine));
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
};
const MENU = [["▦", "Dashboard"], ["◷", "Tickets"], ["▤", "Bitácora"], ["▣", "Máquinas"], ["⟳", "Mantenimiento"], ["♙", "Técnicos"], ["⌖", "Islas / Ubicaciones"], ["◈", "Repuestos"], ["▧", "Insumos"], ["▥", "Reportes"], ["⚙", "Administración"], ["⌕", "Auditoría"], ["✉", "Configuración"]];
const NAV_SECTIONS = [
  { title: "INICIO", items: ["Dashboard"] },
  { title: "OPERACIÓN", items: ["Tickets", "Bitácora", "Máquinas", "Mantenimiento", "Islas / Ubicaciones"] },
  { title: "RECURSOS", items: ["Técnicos", "Repuestos", "Insumos"] },
  { title: "SISTEMA", items: ["Reportes", "Administración", "Auditoría", "Configuración"] },
];

function App() {
  const resetTokenFromUrl = new URLSearchParams(window.location.search).get("reset") || "";
  const [token, setToken] = useState(localStorage.getItem("gt_token") ?? ""); const [err, setErr] = useState(""); const [profile, setProfile] = useState<any>(null); const [authMode, setAuthMode] = useState(resetTokenFromUrl ? "reset" : "login");
  const [view, setView] = useState("Dashboard"); const [machines, setMachines] = useState<any>({ items: [], total: 0 }); const [tickets, setTickets] = useState<any>({ items: [], total: 0 }); const [interventions, setInterventions] = useState<any>({ items: [], total: 0 }); const [pendingInterventions, setPendingInterventions] = useState<any>({items:[],total:0}); const [technicians, setTechnicians] = useState<any>({ items: [], total: 0 }); const [parts, setParts] = useState<any>({ items: [], total: 0 }); const [islands, setIslands] = useState<any>({ items: [], total: 0 }); const [kpi, setKpi] = useState<any>(null);
  const [query, setQuery] = useState(""); const [searchOpen, setSearchOpen] = useState(false); const [remoteSearchTickets, setRemoteSearchTickets] = useState<any[]>([]); const [activeSearchIndex, setActiveSearchIndex] = useState(0); const searchInputRef = useRef<HTMLInputElement>(null); const [ticketSearchInput, setTicketSearchInput] = useState(""); const [ticketSearch, setTicketSearch] = useState(""); const [ticketStatus, setTicketStatus] = useState(""); const [ticketPriority, setTicketPriority] = useState(""); const [ticketPreset, setTicketPreset] = useState(""); const [ticketPage, setTicketPage] = useState(1);
  const [spareLowOnly, setSpareLowOnly] = useState(false);
  const [spareBrandFilter, setSpareBrandFilter] = useState("");
  const [activityFilters, setActivityFilters] = useState<any>({ dateFrom: "", dateTo: "", shift: "", technician: "", area: "", workType: "", pendingOnly: false });
  const [activityPage, setActivityPage] = useState(1);
  const activityPageSize = 20;
  const [machineFilters, setMachineFilters] = useState<any>({ status: "", area: "", island: "", search: "" });
  const [collapsedMachineIslands, setCollapsedMachineIslands] = useState<Set<string>>(new Set());
  const machineIslandDefaultsApplied = useRef(false);
  useEffect(() => {
    if (machineIslandDefaultsApplied.current || !machines.items.length) return;
    setCollapsedMachineIslands(new Set(machines.items.map((machine: any) => String(machine.island || "Sin isla"))));
    machineIslandDefaultsApplied.current = true;
  }, [machines.items]);
  const [selectedMachineNumbers, setSelectedMachineNumbers] = useState<Set<string>>(new Set()); const [machineBulkMessage, setMachineBulkMessage] = useState(""); const [machineBulkBusy, setMachineBulkBusy] = useState(false);
  const [technicianFilters, setTechnicianFilters] = useState<any>({ status: "", search: "" });
  const [interventionModal, setInterventionModal] = useState(false); const [selectedTicket, setSelectedTicket] = useState<any>(null); const [selectedIntervention, setSelectedIntervention] = useState<any>(null); const [interventionTicketTarget, setInterventionTicketTarget] = useState<number | null>(null); const [machineModal, setMachineModal] = useState(false); const [machineEditTarget, setMachineEditTarget] = useState<any>(null); const [machineImportModal, setMachineImportModal] = useState(false); const [machineStateTarget, setMachineStateTarget] = useState<any>(null); const [machineHistoryTarget, setMachineHistoryTarget] = useState<any>(null); const [technicianModal, setTechnicianModal] = useState(false); const [technicianTarget, setTechnicianTarget] = useState<any>(null); const [userModal, setUserModal] = useState(false); const [userTarget, setUserTarget] = useState<any>(null); const [systemUsers, setSystemUsers] = useState<any>({items:[],total:0}); const [partModal, setPartModal] = useState(false); const [partImportModal, setPartImportModal] = useState(false); const [newInventoryType, setNewInventoryType] = useState("REPUESTO"); const [supplyLowOnly, setSupplyLowOnly] = useState(false); const [islandModal, setIslandModal] = useState(false); const [movementPart, setMovementPart] = useState<any>(null); const [loading, setLoading] = useState(false);
  const refresh = async () => {
    if (!token || !profile || profile.role === "USUARIO") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ size: "20", page: String(ticketPage) });
      if (ticketStatus) params.set("status", ticketStatus);
      if (ticketPriority) params.set("priority", ticketPriority);
      if (ticketSearch) params.set("search_text", ticketSearch);
      if (ticketPreset) params.set("attention", ticketPreset);
      const activityParams = new URLSearchParams({ size: "200" });
      if (activityFilters.dateFrom) activityParams.set("date_from", activityFilters.dateFrom);
      if (activityFilters.dateTo) activityParams.set("date_to", activityFilters.dateTo);
      if (activityFilters.shift) activityParams.set("shift", activityFilters.shift);
      if (activityFilters.technician) activityParams.set("technician", activityFilters.technician);
      if (activityFilters.area) activityParams.set("area", activityFilters.area);
      if (activityFilters.workType) activityParams.set("work_type", activityFilters.workType);
      if (activityFilters.pendingOnly) activityParams.set("pending_only", "true");
      const [firstMachines, t, k, tech, p, i, log, pendingLog] = await Promise.all([
        api("/machines?size=200&page=1", token), api(`/tickets?${params.toString()}`, token),
        api("/kpi/summary", token), api("/technicians?size=200", token),
        api("/parts?size=200", token), api("/islands?size=200", token),
        api(`/interventions?${activityParams.toString()}`, token),
        api("/interventions/pending?size=3", token)
      ]);
      const pages = Math.ceil(firstMachines.total / 200);
      const remaining = await Promise.all(Array.from({length: Math.max(0, pages-1)}, (_, index) =>
        api(`/machines?size=200&page=${index+2}`, token)));
      const partPages = Math.ceil(p.total / 200);
      const remainingParts = await Promise.all(Array.from({length: Math.max(0, partPages-1)}, (_, index) =>
        api(`/parts?size=200&page=${index+2}`, token)));
      const interventionPages = Math.ceil(log.total / 200);
      const remainingInterventions = await Promise.all(Array.from({length: Math.max(0, interventionPages-1)}, (_, index) => {
        const pageParams = new URLSearchParams(activityParams);
        pageParams.set("page", String(index + 2));
        return api(`/interventions?${pageParams.toString()}`, token);
      }));
      setMachines({...firstMachines, items:[...firstMachines.items, ...remaining.flatMap((page:any)=>page.items)]});
      setTickets(t); setKpi(k); setTechnicians(tech); setParts({...p, items:[...p.items, ...remainingParts.flatMap((page:any)=>page.items)]}); setIslands(i); setInterventions({...log, items:[...log.items, ...remainingInterventions.flatMap((page:any)=>page.items)]}); setPendingInterventions(pendingLog);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (!token) { setProfile(null); return; } api("/auth/me", token).then(setProfile).catch(() => { localStorage.removeItem("gt_token"); setToken(""); setProfile(null); }); }, [token]);
  useEffect(() => { if (token && profile?.role === "ADMIN") api("/admin/users",token).then(setSystemUsers).catch((e:any)=>setErr(e.message)); else setSystemUsers({items:[],total:0}); },[token,profile]);
  const refreshSystemUsers = async () => { if(profile?.role !== "ADMIN") return; try { setSystemUsers(await api("/admin/users",token)); } catch(e:any) { setErr(e.message); } };
  useEffect(() => { refresh(); }, [token, profile, ticketPage, ticketStatus, ticketPriority, ticketSearch, ticketPreset, activityFilters]);
  useEffect(() => { setActivityPage(1); }, [activityFilters]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || !token || !profile || profile.role === "USUARIO") { setRemoteSearchTickets([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      api(`/tickets?size=8&page=1&search_text=${encodeURIComponent(term)}`, token)
        .then(result => { if (active) setRemoteSearchTickets(result.items ?? []); })
        .catch(() => { if (active) setRemoteSearchTickets([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, token, profile]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInputRef.current?.focus(); setSearchOpen(true); }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  const logout = () => { localStorage.removeItem("gt_token"); setToken(""); setProfile(null); setErr(""); };
  const login = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { if (authMode === "forgot") { const response = await api("/auth/password-recovery", undefined, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email") }) }); setErr(response.message); return; } if (authMode === "reset") { const response = await api("/auth/password-reset", undefined, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetTokenFromUrl, password: f.get("password") }) }); window.history.replaceState({}, "", window.location.pathname); setAuthMode("login"); setErr(response.message); return; } if (authMode === "register") { const created = await api("/auth/register", undefined, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), full_name: f.get("full_name"), password: f.get("password") }) }); f.set("username", created.email); } const out = await api("/auth/login", undefined, { method: "POST", body: new URLSearchParams({ username: String(f.get("username") ?? f.get("email")), password: String(f.get("password")) }) }); localStorage.setItem("gt_token", out.access_token); setToken(out.access_token); setErr(""); } catch (x: any) { setErr(x.message); } };
  if (!token) return <div className="login-wrap"><form className="login-card" onSubmit={login}><img className="casino-logo login-casino-logo" src="/branding/casino-logo.png" alt="Ovalle Casino & Resort"/><h1>Gestión Técnica</h1><p>{authMode === "register" ? "Crea tu cuenta para enviar solicitudes al equipo técnico." : authMode === "forgot" ? "Te enviaremos instrucciones si existe una cuenta asociada al correo." : authMode === "reset" ? "Elige una nueva contraseña para tu cuenta." : "Ingresa para revisar o solicitar soporte técnico."}</p>{authMode === "register" && <label>Nombre completo<input name="full_name" autoComplete="name" maxLength={120} required /></label>}{authMode !== "reset" && <label>{authMode === "register" || authMode === "forgot" ? "Correo electrónico" : "Correo o usuario"}<input name={authMode === "register" || authMode === "forgot" ? "email" : "username"} type={authMode === "register" || authMode === "forgot" ? "email" : "text"} autoComplete={authMode === "register" ? "email" : "username"} required /></label>}{authMode !== "forgot" && <label>{authMode === "reset" ? "Nueva contraseña" : "Contraseña"}<input name="password" type="password" autoComplete={authMode === "register" || authMode === "reset" ? "new-password" : "current-password"} minLength={authMode === "register" || authMode === "reset" ? 8 : undefined} required /></label>}{err && <div className={authMode === "forgot" && err.startsWith("Si ") || authMode === "reset" && err.startsWith("Contraseña") ? "success-message" : "error"}>{err}</div>}{authMode !== "forgot" && <button className="primary full">{authMode === "register" ? "Crear cuenta" : authMode === "reset" ? "Actualizar contraseña" : "Iniciar sesión"} <span>→</span></button>}{authMode === "forgot" && <button className="primary full">Enviar instrucciones</button>}{authMode === "login" && <button type="button" className="auth-switch" onClick={() => { setAuthMode("forgot"); setErr(""); }}>¿Olvidaste tu contraseña?</button>}<button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === "register" ? "login" : authMode === "login" ? "register" : "login"); setErr(""); }}>{authMode === "register" ? "Ya tengo una cuenta · Iniciar sesión" : authMode === "login" ? "¿Necesitas acceso? Crear cuenta" : "Volver a iniciar sesión"}</button></form></div>;
  if (!profile) return <div className="login-wrap"><div className="login-card"><img className="casino-logo login-casino-logo" src="/branding/casino-logo.png" alt="Ovalle Casino & Resort"/><p>Verificando sesión…</p></div></div>;
  if (profile.role === "USUARIO") return <UserPortal token={token} profile={profile} onLogout={logout}/>;
  const filteredMachines = machines.items.filter((m: any) => matchesMachineSearch(m, query));
  const machineAreas = [...new Set(machines.items.map((m: any) => m.area).filter(Boolean))] as string[];
  const machineIslandsForArea = [...new Set(machines.items.filter((m: any) => !machineFilters.area || m.area === machineFilters.area).map((m: any) => m.island).filter(Boolean))] as string[];
  const spareParts = parts.items.filter((part: any) => part.inventory_type !== "INSUMO");
  const supplyItems = parts.items.filter((part: any) => part.inventory_type === "INSUMO");
  const machineBrands = [...new Map(machines.items.map((machine: any) => String(machine.manufacturer || "").trim()).filter(Boolean).map((brand: string) => [brand.toLocaleLowerCase("es"), brand])).values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  const visibleSpareParts = spareParts.filter((part: any) => (!spareLowOnly || part.low_stock) && (!spareBrandFilter || String(part.brand || "").trim().toLocaleLowerCase("es") === spareBrandFilter.toLocaleLowerCase("es")) && `${part.code} ${part.name} ${part.category || ""} ${part.brand || ""}`.toLowerCase().includes(query.toLowerCase()));
  const visibleMachines = filteredMachines.filter((m: any) => (!machineFilters.search || matchesMachineSearch(m, machineFilters.search)) && (!machineFilters.status || m.status === machineFilters.status) && (!machineFilters.area || m.area === machineFilters.area) && (!machineFilters.island || String(m.island) === machineFilters.island));
  const machineGroupsMap = visibleMachines.reduce((groups: Map<string, any[]>, machine: any) => { const key = machine.island ? String(machine.island) : "Sin isla"; groups.set(key, [...(groups.get(key) || []), machine]); return groups; }, new Map<string, any[]>());
  const machineGroups = [...machineGroupsMap.entries()].sort(([a], [b]) => a === "Sin isla" ? 1 : b === "Sin isla" ? -1 : a.localeCompare(b, "es", { numeric: true }));
  const filteredTechnicians = technicians.items.filter((t: any) => `${t.first_name} ${t.last_name} ${t.username || ""} ${t.position || ""} ${t.specialties || ""}`.toLowerCase().includes(`${query} ${technicianFilters.search}`.trim().toLowerCase()) && (!technicianFilters.status || t.status === technicianFilters.status));
  const technicianStatusCounts = technicians.items.reduce((counts: any, t: any) => { counts[t.status] = (counts[t.status] || 0) + 1; return counts; }, {});
  const filteredTickets = tickets.items.filter((t: any) => `${t.id} ${t.task} ${t.technician ?? ""} ${t.jira ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const filteredInterventions = [...interventions.items].sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime() || b.id - a.id);
  const activityPageCount = Math.max(1, Math.ceil(filteredInterventions.length / activityPageSize));
  const visibleInterventions = filteredInterventions.slice((activityPage - 1) * activityPageSize, activityPage * activityPageSize);
  const searchTerm = normalizeSearch(query);
  const matchesSearch = (text: unknown) => normalizeSearch(text).includes(searchTerm);
  const searchResults = searchTerm.length < 2 ? [] : [
    ...machines.items.filter((m: any) => matchesMachineSearch(m, searchTerm)).slice(0, 3).map((m: any) => ({ type: "Máquina", title: `Máquina ${m.number}`, detail: [m.manufacturer, m.model, m.serial && `Serie ${m.serial}`, m.area && `Área ${m.area}`, m.island && `Isla ${m.island}`, STATES[m.status] || m.status].filter(Boolean).join(" · "), view: "Máquinas", value: m.number, record: m })),
    ...[...remoteSearchTickets, ...tickets.items].filter((ticket: any, index: number, all: any[]) => all.findIndex(item => item.id === ticket.id) === index && matchesSearch(`${ticket.id} ${ticket.task} ${ticket.technician ?? ""} ${ticket.jira ?? ""} ${ticket.machine ?? ""}`)).slice(0, 4).map((ticket: any) => ({ type: "Ticket", title: `#${ticket.id} · ${ticket.task}`, detail: [ticket.machine && `Máquina ${ticket.machine}`, ticket.technician || "Sin asignar", ticket.status].filter(Boolean).join(" · "), view: "Tickets", value: ticket.id, record: ticket })),
    ...technicians.items.filter((t: any) => matchesSearch(`${t.first_name} ${t.last_name} ${t.username || ""} ${t.position || ""} ${t.specialties || ""}`)).slice(0, 3).map((t: any) => ({ type: "Técnico", title: `${t.first_name} ${t.last_name}`, detail: [t.position, t.status].filter(Boolean).join(" · "), view: "Técnicos", value: `${t.first_name} ${t.last_name}`, record: t })),
    ...interventions.items.filter((i: any) => matchesSearch(`${i.id} ${i.task} ${i.work_type ?? ""} ${i.technician ?? ""} ${i.machine ?? ""} ${i.detail ?? ""} ${i.area ?? ""} ${i.island ?? ""}`)).slice(0, 4).map((i: any) => ({ type: "Bitácora", title: i.task || i.work_type || `Intervención #${i.id}`, detail: [i.machine && `Máquina ${i.machine}`, i.area, i.island && `Isla ${i.island}`, i.technician, new Date(i.occurred_at).toLocaleDateString("es-CL")].filter(Boolean).join(" · "), view: "Bitácora", value: i.id, record: i })),
    ...parts.items.filter((part: any) => matchesSearch(`${part.code} ${part.name} ${part.category || ""} ${part.brand || ""} ${part.model || ""} ${part.supplier || ""}`)).slice(0, 3).map((part: any) => ({ type: part.inventory_type === "INSUMO" ? "Insumo" : "Repuesto", title: `${part.name}`, detail: [part.code, `Stock ${part.stock}`].join(" · "), view: part.inventory_type === "INSUMO" ? "Insumos" : "Repuestos", value: part.code })),
  ];
  const selectSearchResult = (result: any) => {
    setView(result.view);
    if (result.view === "Tickets") { setTicketPage(1); setTicketSearchInput(String(result.value)); setTicketSearch(String(result.value)); setTicketPreset(""); setQuery(""); setSelectedTicket(result.record); }
    else if (result.view === "Máquinas") { setMachineFilters({ status: "", area: "", island: "", search: String(result.value) }); setQuery(""); }
    else if (result.view === "Técnicos") { setTechnicianFilters({ status: "", search: String(result.value) }); setQuery(""); }
    else if (result.view === "Bitácora") { setQuery(String(result.value)); setSelectedIntervention(result.record); }
    else setQuery(searchTerm);
    setSearchOpen(false); setActiveSearchIndex(0);
  };
  const ticketStatuses = kpi?.tickets_by_status ?? {};
  const ticketDistribution = TICKET_STATUS_INFO.map(([status, label, color]) => ({ status, label, color, count: ticketStatuses[status] ?? 0 })).filter(item => item.count > 0);
  const ticketDistributionTotal = ticketDistribution.reduce((sum, item) => sum + item.count, 0);
  const machineDistribution = Object.entries(STATES).map(([status, label]) => ({ status, label, color: MACHINE_STATUS_COLORS[status], count: kpi?.machines_by_status?.[status] ?? 0 }));
  const machineDistributionTotal = machineDistribution.reduce((sum, item) => sum + item.count, 0);
  const activityByDay = new Map<string, number>();
  interventions.items.forEach((item: any) => { const date = new Date(item.occurred_at); const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; activityByDay.set(key, (activityByDay.get(key) ?? 0) + 1); });
  const activityTrendDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 6 + index); const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; return { date, key, count: activityByDay.get(key) ?? 0 }; });
  const maxActivityDay = Math.max(1, ...activityTrendDays.map(day => day.count));
  const activityTrendTotal = activityTrendDays.reduce((sum, day) => sum + day.count, 0);
  const openTicketsByStatus = (status: string) => { setTicketPage(1); setTicketStatus(status); setTicketPriority(""); setTicketSearchInput(""); setTicketSearch(""); setTicketPreset(""); setQuery(""); setView("Tickets"); };
  const openMachinesByStatus = (status: string) => {
    setMachineFilters({ status, area: "", island: "", search: "" }); setQuery(""); setView("Máquinas");
    const matchingIslands = new Set(machines.items.filter((machine: any) => machine.status === status).map((machine: any) => String(machine.island || "Sin isla")));
    setCollapsedMachineIslands(current => new Set([...current].filter(islandName => !matchingIslands.has(islandName))));
  };
  const selectMachineSummaryStatus = (status: string) => {
    const nextStatus = machineFilters.status === status ? "" : status;
    setMachineFilters({ ...machineFilters, status: nextStatus });
    const matchingIslands = new Set(machines.items.filter((machine: any) => (!nextStatus || machine.status === nextStatus)
      && (!machineFilters.area || machine.area === machineFilters.area)
      && (!machineFilters.island || String(machine.island) === machineFilters.island)
      && (!machineFilters.search || matchesMachineSearch(machine, machineFilters.search))
      && matchesMachineSearch(machine, query)).map((machine: any) => String(machine.island || "Sin isla")));
    setCollapsedMachineIslands(current => new Set([...current].filter(islandName => !matchingIslands.has(islandName))));
  };
  const searchMachines = (search: string) => {
    const filters = { ...machineFilters, search };
    setMachineFilters(filters); setQuery("");
    const matchingIslands = new Set(machines.items.filter((machine: any) => matchesMachineSearch(machine, search)
      && (!filters.status || machine.status === filters.status)
      && (!filters.area || machine.area === filters.area)
      && (!filters.island || String(machine.island) === filters.island)).map((machine: any) => String(machine.island || "Sin isla")));
    setCollapsedMachineIslands(current => new Set([...current].filter(islandName => !matchingIslands.has(islandName))));
  };
  const toggleMachineIsland = (islandName: string) => setCollapsedMachineIslands(current => {
    const next = new Set(current);
    next.has(islandName) ? next.delete(islandName) : next.add(islandName);
    return next;
  });
  const pendingTickets = ["NUEVO", "ASIGNADO", "EN PROCESO", "PENDIENTE", "ESPERANDO REPUESTO", "ESPERANDO PROVEEDOR"].reduce((sum, status) => sum + (ticketStatuses[status] ?? 0), 0);
  const machinesNeedingAttention = Object.entries(kpi?.machines_by_status ?? {}).filter(([status]) => status !== "OPERATIVA").reduce((sum, [, count]: any) => sum + count, 0);
  const canManageTechnicians = ["ADMIN", "JEFE"].includes(profile.role);
  const canDeleteMachines = ["ADMIN", "JEFE"].includes(profile.role);
  const canEditMachines = ["ADMIN", "JEFE"].includes(profile.role);
  const canManageInventory = ["ADMIN", "JEFE"].includes(profile.role);
  const openTicketPreset = (preset: string) => { setTicketPage(1); setTicketStatus(""); setTicketPriority(""); setTicketSearchInput(""); setTicketSearch(""); setTicketPreset(preset); setQuery(""); setView("Tickets"); };
  const deleteSelectedMachines = async () => {
    const numbers = [...selectedMachineNumbers];
    if (!numbers.length || numbers.length > 200) return;
    const sample = numbers.slice(0, 12).join(", ") + (numbers.length > 12 ? ` y ${numbers.length - 12} más` : "");
    if (!window.confirm(`¿Eliminar ${numbers.length} máquina(s): ${sample}?\n\nLas máquinas con tickets, intervenciones, historial de estados o movimientos de repuestos se conservarán para proteger el historial.`)) return;
    setMachineBulkBusy(true); setMachineBulkMessage(""); setErr("");
    try {
      const result = await api("/machines/bulk-delete", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numbers }) });
      const skipped = (result.skipped || []).map((item: any) => `${item.number} (${item.references.join(", ")})`);
      setMachineBulkMessage(`${result.deleted.length} máquina(s) eliminada(s).${skipped.length ? ` Se conservaron ${skipped.length} por tener historial: ${skipped.join("; ")}.` : ""}${result.not_found?.length ? ` No encontradas: ${result.not_found.join(", ")}.` : ""}`);
      setSelectedMachineNumbers(new Set());
      await refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setMachineBulkBusy(false); }
  };
  return <div className="shell"><aside className="sidebar"><div className="brand"><img className="casino-logo sidebar-casino-logo" src="/branding/casino-logo.png" alt="Ovalle Casino & Resort"/><div><b>GESTIÓN TÉCNICA</b><small>CASINO & RESORT</small></div></div><nav className="sidebar-navigation">{NAV_SECTIONS.map(section => { const items = MENU.filter(([, label]) => section.items.includes(label) && (!["Auditoría", "Configuración"].includes(label) || profile.role === "ADMIN")); return items.length ? <div className="nav-section" key={section.title}><div className="nav-label">{section.title}</div>{items.map(([icon, label]) => <button key={label} className={view === label ? "nav-item active" : "nav-item"} onClick={() => setView(label)}><span className="nav-icon">{icon}</span>{label}{label === "Tickets" && pendingTickets > 0 && <span className="nav-pending">{pendingTickets}</span>}</button>)}</div> : null; })}</nav><div className="sidebar-bottom"><div className="online-dot"/> Sistema operativo <span className="version">v1.0</span></div></aside>
    <main className="main"><header className="topbar"><div className="breadcrumbs">Operaciones <span>/</span> <b>{view}</b></div><div className="top-actions"><div className="search-container" onBlur={event => { const next = event.relatedTarget as Node | null; if (!next || !event.currentTarget.contains(next)) setSearchOpen(false); }}><div className="global-search"><span>⌕</span><input ref={searchInputRef} aria-label="Buscar en todo el sistema" aria-expanded={searchOpen && query.trim().length >= 2} aria-controls="global-search-results" placeholder="Buscar en todo el sistema…" value={query} onFocus={() => setSearchOpen(true)} onChange={e => { setQuery(e.target.value); setSearchOpen(true); setActiveSearchIndex(0); }} onKeyDown={event => { if (event.key === "ArrowDown" && searchResults.length) { event.preventDefault(); setActiveSearchIndex(index => (index + 1) % searchResults.length); } else if (event.key === "ArrowUp" && searchResults.length) { event.preventDefault(); setActiveSearchIndex(index => (index - 1 + searchResults.length) % searchResults.length); } else if (event.key === "Enter" && searchResults.length) { event.preventDefault(); selectSearchResult(searchResults[activeSearchIndex] ?? searchResults[0]); } }} /><kbd>⌘ K</kbd></div>{searchOpen && query.trim().length >= 2 && <div className="global-search-results" id="global-search-results" role="listbox" aria-label="Resultados de búsqueda">{searchResults.length ? searchResults.map((result, index) => <button key={`${result.type}-${result.value}`} type="button" role="option" aria-selected={index === activeSearchIndex} className={`global-search-result ${index === activeSearchIndex ? "selected" : ""}`} onMouseEnter={() => setActiveSearchIndex(index)} onClick={() => selectSearchResult(result)}><span className="search-result-icon">{result.type === "Máquina" ? "▣" : result.type === "Ticket" ? "◷" : result.type === "Técnico" ? "♙" : result.type === "Bitácora" ? "▤" : "◈"}</span><span className="search-result-copy"><b>{result.title}</b><small>{result.detail}</small></span><span className="search-result-type">{result.type}</span></button>) : <div className="global-search-empty">No se encontraron resultados para “{query.trim()}”.</div>}<div className="search-result-hint"><kbd>↑</kbd><kbd>↓</kbd> para recorrer · <kbd>Enter</kbd> para abrir</div></div>}</div><button className="icon-button" aria-label={`Ver tickets pendientes: ${pendingTickets}`} onClick={() => setView("Tickets")}>♧{pendingTickets > 0 && <i/>}</button><div className="user"><AvatarPicker token={token} seed={profile.email} className="avatar"/><div><b>{profile.full_name}</b><small>{profile.role}</small></div><button className="logout" title="Cerrar sesión" onClick={logout}>⌄</button></div></div></header>
      <div className="content"><div className="page-head"><div><div className="eyebrow">{new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date()).toLocaleUpperCase("es-CL")}</div><h1>{view === "Dashboard" ? "Resumen operacional" : view}</h1><p>{view === "Tickets" ? "Cola de solicitudes, asignación, prioridad y seguimiento." : view === "Bitácora" ? "Registro histórico de intervenciones técnicas ejecutadas." : view === "Dashboard" ? "Estado general del departamento técnico y de sistemas." : view === "Reportes" ? "Consulta el informe diario de actividades y prepara su envío por correo." : view === "Insumos" ? "Control de existencias, reposición y movimientos de bodega." : "Consulta y administra la operación técnica."}</p></div><div className="head-actions"><button className="secondary" onClick={refresh}>↻ <span>Actualizar</span></button>{["Repuestos", "Insumos"].includes(view) && canManageInventory && <button className="secondary" onClick={() => { setNewInventoryType(view === "Insumos" ? "INSUMO" : "REPUESTO"); setPartImportModal(true); }}>⇧ <span>Carga masiva CSV</span></button>}{view === "Bitácora" && <button className="primary" onClick={() => setInterventionModal(true)}>＋ <span>Registrar intervención</span></button>}</div></div>
      {err && <div className="alert">{err}<button onClick={() => setErr("")}>×</button></div>}
      {view === "Dashboard" && <>{view === "Dashboard" && <section className={`panel pending-handoff-panel pending-handoff-priority ${pendingInterventions.total ? "has-pending" : "all-clear"}`}>{pendingInterventions.total ? <><PanelHeading title="Traspaso de turno" sub="Seguimientos abiertos en bitácora" action="Ver bitácora" click={() => {setActivityFilters({dateFrom:"",dateTo:"",shift:"",technician:"",area:"",workType:"",pendingOnly:true});setView("Bitácora")}}/><div className="handoff-counts"><div><strong>{Math.max(0, pendingInterventions.total - (pendingInterventions.received_total ?? 0))}</strong><span>pendientes</span></div><div><strong>{pendingInterventions.received_total ?? 0}</strong><span>recibidas por el turno entrante</span></div></div><div className="pending-handoff-list">{pendingInterventions.items.slice(0, 3).map((item:any)=><button key={item.id} onClick={()=>setSelectedIntervention(item)}><span><b>{item.task}</b><small>{item.machine ? `Máquina ${item.machine} · ` : ""}{item.technician || "Sin técnico"} · {new Date(item.occurred_at).toLocaleString("es-CL")}</small>{item.follow_up_status === "RECIBIDA" ? <small className="handoff-received">✓ Recibida por {item.follow_up_by || "el equipo"} · {item.follow_up_at ? new Date(item.follow_up_at).toLocaleString("es-CL") : ""}</small> : <small className="handoff-awaiting">Pendiente de recepción</small>}{(item.follow_up_note || item.detail) && <small className="handoff-note">{item.follow_up_note || item.detail}</small>}</span><Badge value={item.follow_up_status === "RECIBIDA" ? "RECIBIDA" : "PENDIENTE"}/></button>)}</div>{pendingInterventions.total > pendingInterventions.items.length && <button className="link-button handoff-more" onClick={() => {setActivityFilters({dateFrom:"",dateTo:"",shift:"",technician:"",area:"",workType:"",pendingOnly:true});setView("Bitácora")}}>Ver las {pendingInterventions.total} intervenciones en bitácora →</button>}</> : <div className="handoff-all-clear"><span>✓</span><div><b>Sin intervenciones pendientes</b><small>El equipo entrante no tiene seguimientos abiertos en bitácora.</small></div></div>}</section>}
      <div className="dashboard-grid"><section className="panel jobs-panel"><PanelHeading title="Actividad reciente" sub={`Intervenciones por día · últimos 7 días · ${activityTrendTotal} en total`} action="Ver bitácora" click={() => setView("Bitácora")}/>{interventions.items.length ? <div className="activity-chart" role="group" aria-label="Intervenciones registradas durante los últimos siete días">{activityTrendDays.map(day => <button type="button" className="activity-chart-day" key={day.key} aria-label={`${day.count} intervenciones el ${day.date.toLocaleDateString("es-CL")}`} title={`${day.count} intervenciones · ${day.date.toLocaleDateString("es-CL")}`} onClick={() => { setActivityFilters({...activityFilters,dateFrom:day.key,dateTo:day.key,pendingOnly:false}); setView("Bitácora"); }}><span className="activity-chart-value">{day.count}</span><span className="activity-chart-track"><i style={{height:`${day.count ? Math.max(7, day.count / maxActivityDay * 112) : 3}px`}}/></span><small>{day.date.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","")}</small><b>{day.date.getDate()}</b></button>)}</div> : <Empty text="Aún no hay intervenciones registradas."/>}</section>
      <section className="panel ticket-pie-panel"><PanelHeading title="Tickets por estado" sub={`${ticketDistributionTotal} tickets registrados`} action="Ver tickets" click={() => setView("Tickets")}/><div className="ticket-pie-content">{ticketDistributionTotal ? <InteractivePieChart items={ticketDistribution} total={ticketDistributionTotal} centerLabel="tickets" size={172} onSelect={item => openTicketsByStatus(item.status)} ariaLabel="Selecciona un segmento para ver los tickets de ese estado"/> : <div className="ticket-pie-empty">Sin tickets registrados</div>}<div className="ticket-pie-legend">{ticketDistribution.map(item => <button type="button" key={item.status} onClick={() => openTicketsByStatus(item.status)} aria-label={`Ver ${item.count} tickets: ${item.label}`}><i style={{ background: item.color }}/><span>{item.label}</span><b>{item.count}</b></button>)}</div></div></section>
      <section className="panel machine-pie-panel"><PanelHeading title="Estado de máquinas" sub={`${machineDistributionTotal} máquinas en inventario`} action="Ver inventario" click={() => setView("Máquinas")}/><div className="machine-pie-content">{machineDistributionTotal ? <InteractivePieChart items={machineDistribution} total={machineDistributionTotal} centerLabel="máquinas" size={280} onSelect={item => openMachinesByStatus(item.status)} ariaLabel="Selecciona un segmento para filtrar las máquinas por estado"/> : <div className="ticket-pie-empty">Sin máquinas registradas</div>}<div className="machine-pie-legend">{machineDistribution.map(item => <button type="button" key={item.status} onClick={() => openMachinesByStatus(item.status)} aria-label={`Ver ${item.count} máquinas: ${item.label}`}><i style={{ background: item.color }}/><span>{item.label}</span><b>{item.count}</b></button>)}</div></div></section>
      </div></>}
      {view === "Máquinas" && <><section className="machine-summary">{Object.entries(STATES).map(([status,label])=><button key={status} className={`machine-summary-card ${machineFilters.status===status?"selected":""}`} onClick={()=>selectMachineSummaryStatus(status)}><span className={`status-dot ${STATUS_CLASS[status]}`}/><span>{label}</span><b>{kpi?.machines_by_status?.[status] ?? 0}</b></button>)}</section><section className="panel full-panel machine-inventory"><PanelHeading title="Inventario de máquinas" sub={`${machines.total} máquinas · ${visibleMachines.length} en vista${machinesNeedingAttention>0?` · ${machinesNeedingAttention} requieren atención`:""}`} action={canEditMachines ? "＋ Nueva máquina" : undefined} click={() => setMachineModal(true)} actionAlt={canEditMachines ? "⇧ Carga masiva" : undefined} clickAlt={() => setMachineImportModal(true)}/><div className="machine-toolbar"><input aria-label="Buscar máquina" placeholder="Número, serie, marca, modelo, área o isla" value={machineFilters.search} onChange={e=>searchMachines(e.target.value)}/><select aria-label="Filtrar estado" value={machineFilters.status} onChange={e=>setMachineFilters({...machineFilters,status:e.target.value})}><option value="">Todos los estados</option>{Object.entries(STATES).map(([status,label])=><option key={status} value={status}>{label}</option>)}</select><select aria-label="Filtrar área o sector" value={machineFilters.area} onChange={e=>setMachineFilters({...machineFilters,area:e.target.value,island:""})}><option value="">Todas las áreas</option>{machineAreas.map(area=><option key={area}>{area}</option>)}</select><select aria-label="Filtrar isla" value={machineFilters.island} onChange={e=>setMachineFilters({...machineFilters,island:e.target.value})}><option value="">Todas las islas</option>{machineIslandsForArea.map(island=><option key={island} value={String(island)}>{island}</option>)}</select><button className="secondary" onClick={()=>setMachineFilters({status:"",area:"",island:"",search:""})}>Limpiar</button></div>{canDeleteMachines && <div className="machine-selection-toolbar"><label><input type="checkbox" checked={visibleMachines.length > 0 && visibleMachines.every((m:any)=>selectedMachineNumbers.has(String(m.number)))} onChange={e=>setSelectedMachineNumbers(current=>{const next=new Set(current);visibleMachines.forEach((m:any)=>e.target.checked?next.add(String(m.number)):next.delete(String(m.number)));return next})}/>Seleccionar visibles ({visibleMachines.length})</label><span>{selectedMachineNumbers.size ? `${selectedMachineNumbers.size} seleccionada(s)` : "Selecciona máquinas para acciones masivas"}</span><button className="danger-button" disabled={!selectedMachineNumbers.size || selectedMachineNumbers.size > 200 || machineBulkBusy} onClick={deleteSelectedMachines}>{machineBulkBusy ? "Eliminando…" : `⌫ Eliminar seleccionadas${selectedMachineNumbers.size ? ` (${selectedMachineNumbers.size})` : ""}`}</button></div>}{machineBulkMessage && <div className="machine-bulk-message">{machineBulkMessage}</div>}<div className="machine-groups">{machineGroups.map(([islandName, islandMachines]: [string, any[]])=><section className="machine-island-group" key={islandName}><header className="machine-island-header-toggle" role="button" tabIndex={0} aria-expanded={!collapsedMachineIslands.has(islandName)} onClick={() => toggleMachineIsland(islandName)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleMachineIsland(islandName); } }}><div><small>UBICACIÓN</small><h3>{islandName === "Sin isla" ? "Máquinas sin isla" : `Isla ${islandName}`}</h3></div><div className="machine-island-header-actions"><span>{islandMachines.length} {islandMachines.length === 1 ? "máquina" : "máquinas"}</span><span className="machine-collapse-toggle">{collapsedMachineIslands.has(islandName) ? "Mostrar tarjetas" : "Contraer tarjetas"}<span aria-hidden="true">{collapsedMachineIslands.has(islandName) ? "⌄" : "⌃"}</span></span></div></header>{!collapsedMachineIslands.has(islandName) && <div className="machine-inventory-grid">{islandMachines.map((m:any)=><article className={`inventory-machine-card ${selectedMachineNumbers.has(String(m.number))?"selected":""}`} key={m.number}>{canDeleteMachines && <label className="machine-select"><input type="checkbox" aria-label={`Seleccionar máquina ${m.number}`} checked={selectedMachineNumbers.has(String(m.number))} onChange={e=>setSelectedMachineNumbers(current=>{const next=new Set(current);e.target.checked?next.add(String(m.number)):next.delete(String(m.number));return next})}/><span>Seleccionar</span></label>}<div className="inventory-card-head"><div><small>MÁQUINA</small><h3>{m.number}</h3></div><Badge value={STATES[m.status] || m.status}/></div><div className="inventory-machine-name">{[m.manufacturer,m.model].filter(Boolean).join(" · ") || "Fabricante y modelo sin registrar"}</div><div className="inventory-machine-fields"><div><small>ÁREA</small><b>{m.area || "—"}</b></div><div><small>ISLA</small><b>{m.island || "—"}</b></div></div><div className="inventory-machine-actions">{canEditMachines && <button className="link-button" onClick={()=>setMachineEditTarget(m)}>Editar datos</button>}<button className="link-button" onClick={()=>setMachineHistoryTarget(m)}>Ver historial</button><button className="link-button" onClick={()=>setMachineStateTarget(m)}>Cambiar estado</button></div></article>)}</div>}</section>)}</div>{!visibleMachines.length && <Empty text={machines.items.length?"No hay máquinas que coincidan con los filtros.":"Agrega máquinas para ver el inventario."}/>}</section></>}
      {view === "Mantenimiento" && <PreventiveMaintenanceView token={token} machines={machines.items} technicians={technicians.items} canManage={["ADMIN", "JEFE", "SUPERVISOR"].includes(profile.role)} canChangeMachineStatus={["ADMIN", "JEFE", "SUPERVISOR", "TECNICO"].includes(profile.role)} onMachineStatus={setMachineStateTarget} onMachineHistory={setMachineHistoryTarget}/>}
      {view === "Tickets" && <TicketListView tickets={filteredTickets} total={tickets.total} page={ticketPage} searchInput={ticketSearchInput} status={ticketStatus} priority={ticketPriority} preset={ticketPreset} counts={kpi?.ticket_attention_counts ?? {}} onQuickPreset={value => { setTicketPage(1); setTicketStatus(""); setTicketPriority(""); setTicketSearchInput(""); setTicketSearch(""); setTicketPreset(value); setQuery(""); }} onSearchInput={setTicketSearchInput} onSearch={() => { setTicketPage(1); setTicketSearch(ticketSearchInput); }} onStatus={v => { setTicketPage(1); setTicketStatus(v); }} onPriority={v => { setTicketPage(1); setTicketPriority(v); }} onPage={setTicketPage} onReset={() => { setTicketPage(1); setTicketSearchInput(""); setTicketSearch(""); setTicketStatus(""); setTicketPriority(""); setTicketPreset(""); }} onOpen={setSelectedTicket}/>}
      {view === "Bitácora" && <section className="panel full-panel activity-panel"><PanelHeading title="Bitácora de intervenciones" sub={`${interventions.total} trabajos registrados`} action="＋ Registrar intervención" click={() => setInterventionModal(true)} actionAlt="⇩ Exportar CSV" clickAlt={() => downloadInterventionsCsv(filteredInterventions)}/><div className="activity-filters"><label>Desde<input type="date" value={activityFilters.dateFrom} onChange={e => setActivityFilters({...activityFilters,dateFrom:e.target.value})}/></label><label>Hasta<input type="date" value={activityFilters.dateTo} onChange={e => setActivityFilters({...activityFilters,dateTo:e.target.value})}/></label><label>Turno<select value={activityFilters.shift} onChange={e => setActivityFilters({...activityFilters,shift:e.target.value})}><option value="">Todos</option>{["Mañana","Tarde","Noche"].map(x=><option key={x}>{x}</option>)}</select></label><label>Técnico<input value={activityFilters.technician} onChange={e => setActivityFilters({...activityFilters,technician:e.target.value})} placeholder="Filtrar técnico"/></label><label>Área<input value={activityFilters.area} onChange={e => setActivityFilters({...activityFilters,area:e.target.value})} placeholder="Filtrar área"/></label><label>Trabajo<input value={activityFilters.workType} onChange={e => setActivityFilters({...activityFilters,workType:e.target.value})} placeholder="Tipo de trabajo"/></label><label className="pending-filter"><input type="checkbox" checked={activityFilters.pendingOnly} onChange={e => setActivityFilters({...activityFilters,pendingOnly:e.target.checked})}/>Solo pendientes</label></div><div className="activity-quick-filters"><button onClick={() => { const today = localDateValue(new Date()); setActivityFilters({...activityFilters,dateFrom:today,dateTo:today,pendingOnly:false}); }}>Hoy</button><button onClick={() => { const today = new Date(); const start = new Date(today); start.setDate(start.getDate() - 6); setActivityFilters({...activityFilters,dateFrom:localDateValue(start),dateTo:localDateValue(today),pendingOnly:false}); }}>Últimos 7 días</button><button className={activityFilters.pendingOnly ? "active" : ""} onClick={() => setActivityFilters({...activityFilters,pendingOnly:!activityFilters.pendingOnly})}>Pendientes</button><button onClick={() => setActivityFilters({dateFrom:"",dateTo:"",shift:"",technician:"",area:"",workType:"",pendingOnly:false})}>Limpiar filtros</button><span>{filteredInterventions.length ? `${(activityPage - 1) * activityPageSize + 1}–${Math.min(activityPage * activityPageSize, filteredInterventions.length)} de ${filteredInterventions.length} registros` : "0 registros en vista"}</span></div><div className="table-wrap"><table><thead><tr><th>FECHA</th><th>TRABAJO REALIZADO</th><th>MÁQUINA / ISLA</th><th>ÁREA</th><th>TÉCNICO</th><th>TURNO</th><th>TICKET</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>{visibleInterventions.map((i: any) => <tr key={i.id}><td data-label="Fecha">{new Date(i.occurred_at).toLocaleString("es-CL")}</td><td data-label="Trabajo realizado"><b>{i.task}</b>{i.detail && <small className="cell-sub">{i.detail}</small>}{i.pending && <small className="pending-label">{i.follow_up_status === "RECIBIDA" ? "Recibida por turno" : "Pendiente de seguimiento"}</small>}</td><td data-label="Máquina / isla">{i.machine || "—"}{i.island && <small className="cell-sub">Isla {i.island}</small>}</td><td data-label="Área">{i.area || "—"}</td><td data-label="Técnico">{i.technician || "—"}</td><td data-label="Turno">{i.shift || "—"}</td><td data-label="Ticket">{i.ticket_id ? <b className="ticket-id">#{i.ticket_id}</b> : "—"}</td><td data-label="Estado">{i.pending ? <Badge value={i.follow_up_status === "RECIBIDA" ? "RECIBIDA" : "PENDIENTE"}/> : "Resuelta"}</td><td data-label="Acción"><button className="link-button" onClick={() => setSelectedIntervention(i)}>Seguimiento</button>{i.ticket_id && <button className="link-button" onClick={() => setInterventionTicketTarget(i.ticket_id)}>Ticket</button>}</td></tr>)}</tbody></table></div>{filteredInterventions.length > activityPageSize && <div className="activity-pagination"><span>Página {activityPage} de {activityPageCount}</span><div><button className="secondary" disabled={activityPage <= 1} onClick={() => setActivityPage(page => Math.max(1, page - 1))}>← Anterior</button><button className="secondary" disabled={activityPage >= activityPageCount} onClick={() => setActivityPage(page => Math.min(activityPageCount, page + 1))}>Siguiente →</button></div></div>}{!filteredInterventions.length && <Empty text={interventions.items.length ? "No hay intervenciones para los filtros seleccionados." : "Aún no hay intervenciones registradas."}/>}</section>}
      {view === "Técnicos" && <><section className="technician-summary"><div className="technician-intro"><span className="technician-icon">♙</span><div><b>Equipo técnico</b><small>Personal disponible para la atención y seguimiento de solicitudes.</small></div></div>{["ACTIVO","INACTIVO","LICENCIA","VACACIONES"].map(status=><button key={status} className={`technician-status-card ${technicianFilters.status===status?"selected":""}`} onClick={()=>setTechnicianFilters({...technicianFilters,status:technicianFilters.status===status?"":status})}><span>{status === "ACTIVO" ? "Disponibles" : status === "INACTIVO" ? "Inactivos" : status === "LICENCIA" ? "Con licencia" : "De vacaciones"}</span><b>{technicianStatusCounts[status] || 0}</b></button>)}</section><section className="panel full-panel technician-panel"><PanelHeading title="Directorio de técnicos" sub={`${technicians.total} personas · ${technicianStatusCounts.ACTIVO || 0} disponibles`} action="＋ Nuevo técnico" click={() => {setTechnicianTarget(null);setTechnicianModal(true)}}/><div className="technician-toolbar"><input placeholder="Buscar por nombre, cargo, usuario o especialidad" value={technicianFilters.search} onChange={e=>setTechnicianFilters({...technicianFilters,search:e.target.value})}/><select aria-label="Filtrar disponibilidad" value={technicianFilters.status} onChange={e=>setTechnicianFilters({...technicianFilters,status:e.target.value})}><option value="">Todos los estados</option>{["ACTIVO","INACTIVO","LICENCIA","VACACIONES"].map(status=><option key={status}>{status}</option>)}</select><button className="secondary" onClick={()=>setTechnicianFilters({status:"",search:""})}>Limpiar</button></div><div className="technician-grid">{filteredTechnicians.map((t: any)=><article className="technician-card" key={t.id}><div className="technician-card-head"><AvatarPicker token={token} seed={t.id} className="technician-avatar" endpoint={`/technicians/${t.id}/avatar`} canEdit={["ADMIN","JEFE"].includes(profile.role)||profile.technician_id===t.id}/><div className="technician-name"><h3>{t.first_name} {t.last_name}</h3><small>{t.position || "Técnico"}</small></div><Badge value={t.status}/></div><div className="technician-details"><div><small>TURNO</small><b>{t.shift || "Sin asignar"}</b></div><div><small>USUARIO</small><b>{t.username || "Sin usuario"}</b></div></div>{t.specialties && <div className="technician-specialties"><small>ESPECIALIDADES</small><p>{t.specialties}</p></div>}{t.contracted_hours != null && <div className="technician-hours">{t.contracted_hours} horas contratadas</div>}<button className="link-button technician-edit" onClick={()=>{setTechnicianTarget(t);setTechnicianModal(true)}}>Editar perfil y disponibilidad →</button></article>)}</div>{!filteredTechnicians.length && <Empty text={technicians.items.length?"No hay técnicos para los filtros seleccionados.":"Aún no hay técnicos registrados."}/>}</section></>}
      {view === "Administración" && (profile.role === "ADMIN" ? <section className="panel full-panel admin-users-panel"><PanelHeading title="Usuarios del sistema" sub={`${systemUsers.total} cuentas · vincula las fichas de técnicos con su cuenta de acceso`} action="＋ Crear usuario" click={()=>{setUserTarget(null);setUserModal(true)}}/><div className="admin-users-intro"><b>Acceso al sistema</b><span>Administra correo, rol y contraseña. Cada cuenta con rol Técnico debe asociarse a una ficha del directorio.</span></div><div className="table-wrap"><table><thead><tr><th>PERSONA</th><th>CORREO DE ACCESO</th><th>ROL</th><th>FICHA DE TÉCNICO</th><th>ACCIÓN</th></tr></thead><tbody>{systemUsers.items.filter((u:any)=>`${u.full_name} ${u.username} ${u.role} ${u.technician_name||""}`.toLowerCase().includes(query.toLowerCase())).map((u:any)=><tr key={u.id}><td><b>{u.full_name}</b></td><td>{u.username}</td><td><Badge value={u.role}/></td><td>{u.technician_name || "—"}</td><td><button className="link-button" onClick={()=>{setUserTarget(u);setUserModal(true)}}>Editar cuenta</button></td></tr>)}</tbody></table></div>{!systemUsers.items.length&&<Empty text="Aún no hay cuentas registradas."/>}</section> : <section className="panel coming-panel"><div className="coming-icon">⚙</div><h2>Administración de usuarios</h2><p>Solo un administrador del sistema puede consultar y gestionar las cuentas.</p></section>)}
      {!(["Dashboard", "Máquinas", "Mantenimiento", "Tickets", "Bitácora", "Técnicos", "Repuestos", "Insumos", "Islas / Ubicaciones", "Reportes", "Administración", "Auditoría", "Configuración"].includes(view)) && <section className="panel coming-panel"><div className="coming-icon">◈</div><h2>{view}</h2><p>Este módulo está preparado para integrarse con los datos operacionales de Gestión Técnica.</p><button className="secondary" onClick={() => setView("Dashboard")}>Volver al resumen</button></section>}
      {view === "Repuestos" && <section className="panel full-panel"><PanelHeading title="Inventario de repuestos" sub={`${spareParts.length} artículos · ${spareParts.filter((p: any) => p.low_stock).length} bajo stock mínimo`} action={canManageInventory ? "＋ Nuevo repuesto" : undefined} click={() => {setNewInventoryType("REPUESTO");setPartModal(true)}} actionAlt={spareLowOnly ? "Ver todos" : "⚠ Bajo mínimo"} clickAlt={() => setSpareLowOnly(!spareLowOnly)}/><div className="spare-brand-filters" aria-label="Filtrar repuestos por marca"><button type="button" className={!spareBrandFilter ? "selected" : ""} onClick={() => setSpareBrandFilter("")}><span>Todas las marcas</span><b>{spareParts.length}</b></button>{machineBrands.map(brand => <button type="button" key={brand} className={spareBrandFilter.toLocaleLowerCase("es") === brand.toLocaleLowerCase("es") ? "selected" : ""} onClick={() => setSpareBrandFilter(current => current.toLocaleLowerCase("es") === brand.toLocaleLowerCase("es") ? "" : brand)}><span>{brand}</span><b>{spareParts.filter((part: any) => String(part.brand || "").trim().toLocaleLowerCase("es") === brand.toLocaleLowerCase("es")).length}</b></button>)}</div><div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>REPUESTO</th><th>CATEGORÍA</th><th>MARCA / MODELO</th><th>STOCK</th><th>UBICACIÓN</th><th>COSTO UNITARIO</th><th>MOVIMIENTOS</th></tr></thead><tbody>{visibleSpareParts.map((p: any) => <tr key={p.id}><td><b>{p.code}</b></td><td>{p.name}</td><td>{p.category || "—"}</td><td>{[p.brand, p.model].filter(Boolean).join(" · ") || "—"}</td><td><Badge value={`${p.stock} en stock${p.low_stock ? " · Bajo mínimo" : ""}`}/></td><td>{p.location || "—"}</td><td>{p.unit_cost == null ? "—" : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(p.unit_cost)}</td><td><button className="link-button" onClick={() => setMovementPart(p)}>Registrar / ver</button></td></tr>)}</tbody></table></div>{!visibleSpareParts.length && <Empty text={spareLowOnly ? "No hay repuestos bajo mínimo para estos filtros." : spareParts.length ? "No hay repuestos para los filtros actuales." : "Aún no hay repuestos registrados."}/>}</section>}
      {view === "Insumos" && <><section className="warehouse-summary"><article className="warehouse-stat"><small>ARTÍCULOS EN BODEGA</small><b>{supplyItems.length}</b><span>Tipos de insumo registrados</span></article><article className="warehouse-stat"><small>UNIDADES DISPONIBLES</small><b>{supplyItems.reduce((total: number, item: any) => total + item.stock, 0)}</b><span>Existencias actuales</span></article><button className={`warehouse-stat warehouse-alert-stat ${supplyItems.some((item: any) => item.low_stock) ? "has-alert" : ""}`} onClick={() => setSupplyLowOnly(!supplyLowOnly)}><small>BAJO MÍNIMO</small><b>{supplyItems.filter((item: any) => item.low_stock).length}</b><span>{supplyLowOnly ? "Mostrando alertas · Ver todos" : "Ver artículos que requieren reposición"}</span></button></section><section className="panel full-panel warehouse-panel"><PanelHeading title="Bodega de insumos" sub={`${supplyItems.length} artículos · entradas, salidas y ajustes con trazabilidad`} action={canManageInventory ? "＋ Nuevo insumo" : undefined} click={() => {setNewInventoryType("INSUMO");setPartModal(true)}}/><div className="warehouse-toolbar"><span>Control de existencias, proveedor, ubicación y costo unitario.</span><button className={`secondary ${supplyLowOnly ? "warehouse-filter-active" : ""}`} onClick={() => setSupplyLowOnly(!supplyLowOnly)}>{supplyLowOnly ? "Ver todos" : "⚠ Bajo mínimo"}</button></div><div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>INSUMO</th><th>CATEGORÍA</th><th>STOCK DISPONIBLE</th><th>MÍNIMO</th><th>UBICACIÓN</th><th>PROVEEDOR</th><th>COSTO UNITARIO</th><th>MOVIMIENTOS</th></tr></thead><tbody>{supplyItems.filter((item: any) => (!supplyLowOnly || item.low_stock) && `${item.code} ${item.name} ${item.category || ""} ${item.supplier || ""} ${item.location || ""}`.toLowerCase().includes(query.toLowerCase())).map((item: any) => <tr key={item.id}><td><b>{item.code}</b></td><td><b>{item.name}</b>{item.brand && <small className="cell-sub">{item.brand}{item.model ? ` · ${item.model}` : ""}</small>}</td><td>{item.category || "—"}</td><td><span className={`warehouse-stock ${item.low_stock ? "low" : ""}`}>{item.stock}</span></td><td>{item.minimum_stock}</td><td>{item.location || "—"}</td><td>{item.supplier || "—"}</td><td>{item.unit_cost == null ? "—" : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(item.unit_cost)}</td><td><button className="link-button" onClick={() => setMovementPart(item)}>Entrada / salida</button></td></tr>)}</tbody></table></div>{!supplyItems.filter((item: any) => (!supplyLowOnly || item.low_stock) && `${item.code} ${item.name} ${item.category || ""} ${item.supplier || ""} ${item.location || ""}`.toLowerCase().includes(query.toLowerCase())).length && <Empty text={supplyItems.length ? "No hay insumos que coincidan con los filtros." : "La bodega aún no tiene insumos registrados."}/>}</section></>}
      {view === "Islas / Ubicaciones" && <FloorPlanView token={token} machines={machines.items} profile={profile} onStatus={setMachineStateTarget} onSaved={refresh}/>}
      {view === "Reportes" && <DailyReportView token={token}/>}
      {view === "Configuración" && <EmailSettingsView token={token}/>}
      {view === "Auditoría" && <AuditView token={token} query={query}/>}
      <footer>Gestión Técnica <span>·</span> Información operacional trazable <span>·</span> KPI se muestran cuando existe información suficiente.</footer></div>
    </main>{interventionTicketTarget !== null && <TicketStatusModal token={token} ticketId={interventionTicketTarget} onClose={() => setInterventionTicketTarget(null)} onSaved={refresh}/>}{interventionModal && <InterventionModal token={token} machines={machines.items} parts={parts.items} tickets={tickets.items} technicians={technicians.items} onClose={() => setInterventionModal(false)} onSaved={refresh}/>}{selectedTicket && <TicketManageModal token={token} ticket={selectedTicket} parts={parts.items} technicians={technicians.items} onClose={() => setSelectedTicket(null)} onSaved={refresh}/>}{selectedIntervention && <InterventionDetailModal token={token} intervention={selectedIntervention} canFollowUp={profile.role !== "USUARIO"} onClose={() => setSelectedIntervention(null)} onSaved={() => {setSelectedIntervention(null);refresh()}}/>}{machineModal && <MachineModal token={token} areas={machineAreas} onClose={() => setMachineModal(false)} onSaved={refresh}/>}{machineEditTarget && <MachineModal token={token} machine={machineEditTarget} areas={machineAreas} onClose={() => setMachineEditTarget(null)} onSaved={refresh}/>}{machineImportModal && <MachineImportModal token={token} onClose={() => setMachineImportModal(false)} onSaved={refresh}/>}{machineStateTarget && <MachineStatusModal token={token} machine={machineStateTarget} onClose={() => setMachineStateTarget(null)} onSaved={refresh}/>}{machineHistoryTarget && <MachineHistoryModal token={token} machine={machineHistoryTarget} onClose={()=>setMachineHistoryTarget(null)}/>}{technicianModal && <TechnicianModal token={token} technician={technicianTarget} onClose={() => setTechnicianModal(false)} onSaved={()=>{setTechnicianModal(false);setTechnicianTarget(null);refresh()}}/>}{partModal && <PartModal token={token} inventoryType={newInventoryType} brands={machineBrands} onClose={() => setPartModal(false)} onSaved={refresh}/>}{partImportModal && <PartImportModal token={token} inventoryType={newInventoryType} onClose={() => setPartImportModal(false)} onSaved={refresh}/>}{islandModal && <IslandModal token={token} onClose={() => setIslandModal(false)} onSaved={refresh}/>}{movementPart && <MovementModal token={token} part={movementPart} tickets={tickets.items} machines={machines.items} technicians={technicians.items} onClose={() => setMovementPart(null)} onSaved={refresh}/>}{userModal && <SystemUserModal token={token} user={userTarget} technicians={technicians.items} onClose={()=>{setUserModal(false);setUserTarget(null)}} onSaved={()=>{setUserModal(false);setUserTarget(null);refresh();refreshSystemUsers()}}/>}</div>;
}
function InteractivePieChart({ items, total, centerLabel, size, onSelect, ariaLabel }: any) {
  const slices = items.filter((item: any) => item.count > 0);
  let offset = 0;
  const sectors = slices.map((item: any) => {
    const start = offset / total * 360 - 90;
    offset += item.count;
    const end = offset / total * 360 - 90;
    const point = (angle: number) => ({ x: 100 + 96 * Math.cos(angle * Math.PI / 180), y: 100 + 96 * Math.sin(angle * Math.PI / 180) });
    const a = point(start); const b = point(end);
    const path = slices.length === 1 ? "" : `M 100 100 L ${a.x} ${a.y} A 96 96 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
    return { ...item, path };
  });
  return <div className="interactive-pie" style={{ width: size, height: size }}><svg viewBox="0 0 200 200" role="group" aria-label={ariaLabel}>{sectors.length === 1 ? <path d="M100 4 A96 96 0 1 1 99.9 4 Z" fill={sectors[0].color} stroke="white" strokeWidth="2" role="button" tabIndex={0} aria-label={`${sectors[0].label}: ${sectors[0].count}`} onClick={() => onSelect(sectors[0])} onKeyDown={(event: any) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(sectors[0]); } }}/> : sectors.map((item: any) => <path key={item.status} d={item.path} fill={item.color} stroke="white" strokeWidth="2" role="button" tabIndex={0} aria-label={`${item.label}: ${item.count}`} onClick={() => onSelect(item)} onKeyDown={(event: any) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(item); } }}/>)}</svg><div className="interactive-pie-center"><strong>{total}</strong><small>{centerLabel}</small></div></div>;
}

function TicketListView({ tickets, total, page, searchInput, status, priority, preset, counts, onQuickPreset, onSearchInput, onSearch, onStatus, onPriority, onPage, onReset, onOpen }: any) {
  const submit = (e: FormEvent) => { e.preventDefault(); onSearch(); };
  const pageSize = 20; const first = total ? (page - 1) * pageSize + 1 : 0; const last = Math.min(page * pageSize, total);
  const quickFilters = [
    { id: "", label: "Todos" },
    { id: "under_24h", label: "0–24 h", count: counts.under_24h },
    { id: "24_to_72h", label: "24–72 h", count: counts["24_to_72h"] },
    { id: "over_72h", label: "+72 h", count: counts.over_72h },
    { id: "overdue", label: "SLA vencido", count: counts.sla_overdue },
    { id: "unassigned", label: "Sin asignar", count: counts.unassigned },
    { id: "urgent", label: "Prioridad alta", count: counts.urgent },
  ];
  return <section className="panel full-panel">
    <PanelHeading title="Gestión de tickets" sub={`${total} solicitudes · administra asignación y ciclo de atención`}/>
    <div className="ticket-quick-filters">{quickFilters.map(filter => <button key={filter.id || "all"} className={preset === filter.id ? "active" : ""} onClick={() => onQuickPreset(filter.id)}>{filter.label}{filter.count != null && <b>{filter.count}</b>}</button>)}</div>
    <form className="ticket-toolbar" onSubmit={submit}><input value={searchInput} onChange={e => onSearchInput(e.target.value)} placeholder="Buscar por ID, tarea, técnico o Jira"/><select value={status} onChange={e => onStatus(e.target.value)}><option value="">Todos los estados</option>{["NUEVO", "ASIGNADO", "EN PROCESO", "PENDIENTE", "ESPERANDO REPUESTO", "ESPERANDO PROVEEDOR", "RESUELTO", "CERRADO", "CANCELADO"].map(s => <option key={s}>{s}</option>)}</select><select value={priority} onChange={e => onPriority(e.target.value)}><option value="">Todas las prioridades</option>{["BAJA", "NORMAL", "ALTA", "CRÍTICA"].map(s => <option key={s}>{s}</option>)}</select><button className="primary" type="submit">Buscar</button><button className="secondary" type="button" onClick={onReset}>Limpiar</button></form>
    <div className="table-wrap"><table><thead><tr><th>ID</th><th>ASUNTO / TAREA</th><th>MÁQUINA</th><th>TÉCNICO</th><th>CREADO</th><th>ESTADO</th><th>PRIORIDAD</th><th>SLA / VENCIMIENTO</th><th>GESTIONAR</th></tr></thead><tbody>{tickets.map((t: any) => <tr key={t.id}><td><b className="ticket-id">#{t.id}</b></td><td>{t.task}</td><td>{t.machine || "—"}</td><td>{t.technician || "Sin asignar"}</td><td>{new Date(t.created_at).toLocaleDateString("es-CL")}</td><td><Badge value={t.status}/></td><td><Badge value={t.priority}/></td><td><Badge value={t.sla_status}/>{t.sla_due_at && <small className="cell-sub">{slaCountdown(t.sla_due_at)} · {new Date(t.sla_due_at).toLocaleString("es-CL")}</small>}</td><td><button className="link-button" onClick={() => onOpen(t)}>Abrir ticket</button></td></tr>)}</tbody></table></div>
    {!tickets.length && <Empty text={total ? "No hay tickets que coincidan con los filtros." : "Las solicitudes nuevas aparecerán aquí cuando un usuario las envíe."}/>}
    <div className="pagination"><span>Mostrando {first}–{last} de {total}</span><div><button className="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Anterior</button><b>Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</b><button className="secondary" disabled={last >= total} onClick={() => onPage(page + 1)}>Siguiente →</button></div></div>
  </section>;
}
function UserPortal({ token, profile, onLogout }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api("/tickets?size=100", token);
      setTickets(data.items);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, [token]);

  const openTicket = async (ticket: any) => {
    if (selected?.id === ticket.id) { setSelected(null); return; }
    setSelected(ticket);
    setHistory([]);
    setComments([]);
    try {
      const [updates, messages] = await Promise.all([
        api(`/tickets/${ticket.id}/history`, token),
        api(`/tickets/${ticket.id}/comments`, token),
      ]);
      setHistory(updates);
      setComments(messages);
    } catch (e: any) { setError(e.message); }
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(e.currentTarget);
    const machine = String(form.get("machine") || "").trim();
    try {
      await api("/tickets", token, { method: "POST", body: form });
      setShowForm(false); await refresh();
    } catch (x: any) { setError(x.message); }
    finally { setSaving(false); }
  };
  const submitComment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    setCommentSaving(true); setError("");
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    try {
      await api(`/tickets/${selected.id}/comments`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: form.get("body") }) });
      setComments(await api(`/tickets/${selected.id}/comments`, token));
      formElement.reset();
    } catch (x: any) { setError(x.message); }
    finally { setCommentSaving(false); }
  };

  return <div className="requester-shell">
    <header className="requester-header"><div className="brand"><img className="casino-logo requester-casino-logo" src="/branding/casino-logo.png" alt="Ovalle Casino & Resort"/><div><b>GESTIÓN TÉCNICA</b><small>PORTAL DE SOLICITUDES</small></div></div><div className="requester-account"><AvatarPicker token={token} seed={profile.email} className="avatar"/><div><b>{profile.full_name}</b><small>{profile.email}</small></div><button className="secondary" onClick={onLogout}>Cerrar sesión</button></div></header>
    <main className="requester-content">
      <div className="requester-welcome"><div><span className="eyebrow">CENTRO DE AYUDA</span><h1>Mis solicitudes</h1><p>Envía un requerimiento y sigue aquí las actualizaciones del equipo técnico.</p></div><button className="primary" onClick={() => { setError(""); setShowForm(true); }}>＋ Nueva solicitud</button></div>
      {error && <div className="alert">{error}</div>}
      <section className="panel requester-panel">
        <div className="panel-heading"><div><h2>Solicitudes recientes</h2><p>{tickets.length} solicitudes registradas en tu cuenta</p></div><button className="link-button" onClick={refresh}>Actualizar ↻</button></div>
        {loading ? <Empty text="Cargando tus solicitudes…"/> : tickets.length === 0 ? <Empty text="Todavía no has enviado solicitudes."/> : <div className="request-list">{tickets.map(ticket => <article className="request-row" key={ticket.id}>
          <div className="request-main"><div><span className="ticket-id">#{ticket.id}</span><span className="request-date">{new Date(ticket.created_at).toLocaleString("es-CL")}</span></div><h3>{ticket.task}</h3><p>{ticket.detail || "Sin descripción adicional."}</p>{ticket.machine && <small>Máquina {ticket.machine}</small>}</div>
          <div className="request-state"><Badge value={ticket.status}/><button className="secondary" onClick={() => openTicket(ticket)}>{selected?.id === ticket.id ? "Ocultar seguimiento" : "Ver seguimiento"}</button></div>
          {selected?.id === ticket.id && <div className="request-detail">
            <h4>Seguimiento</h4>
            {ticket.attachments?.length > 0 && <TicketAttachments token={token} ticketId={ticket.id} attachments={ticket.attachments}/>}
            {ticket.result && <p className="request-result"><b>Respuesta técnica:</b> {ticket.result}</p>}
            {history.length ? history.map((item, index) => <div className="request-history" key={index}><span>{new Date(item.at).toLocaleString("es-CL")}</span><b>{item.old_status || "Creada"} → {item.new_status}</b><small>{item.note || "Actualización del ticket"}</small></div>) : <p>Aún no hay actualizaciones de estado.</p>}
            <h4 className="conversation-title">Conversación</h4>
            {comments.map(message => <div className="conversation-message" key={message.id}><div><b>{message.author}</b><span>{new Date(message.at).toLocaleString("es-CL")}</span></div><p>{message.body}</p></div>)}
            <form className="conversation-form" onSubmit={submitComment}><label htmlFor={`comment-${ticket.id}`}>Agregar información</label><textarea id={`comment-${ticket.id}`} name="body" rows={3} maxLength={4000} required placeholder="Escribe una respuesta o aporta más detalles…"/><button className="primary" disabled={commentSaving}>{commentSaving ? "Enviando…" : "Enviar mensaje"}</button></form>
          </div>}
        </article>)}</div>}
      </section>
      <p className="requester-help">Puedes agregar información y responder al equipo técnico desde la conversación de cada solicitud.</p>
    </main>
    {showForm && <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && setShowForm(false)}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>Nueva solicitud</h2><p>Describe lo que necesitas y el equipo técnico la revisará.</p></div><button type="button" className="close" onClick={() => setShowForm(false)}>×</button></div><label>Asunto<input name="task" required maxLength={200} placeholder="Ej. No puedo imprimir en recepción"/></label><label>Descripción<textarea name="detail" rows={5} placeholder="Indica qué ocurre, desde cuándo y cómo podemos reproducirlo…"/></label><label>Máquina o equipo relacionado<input name="machine" maxLength={20} placeholder="Opcional · número de máquina"/></label><label>Imágenes (opcional)<input name="images" type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple/><small className="helper">JPG, PNG, GIF o WebP · máximo 2 MB por imagen · hasta 10 imágenes.</small></label>{error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Enviando…" : "Enviar solicitud"}</button></div></form></div>}
  </div>;
}
function avatarImage(seed: string | number) { const hash = Array.from(String(seed || "usuario")).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0); return `/avatars/user-${hash % 10 + 1}.jpg`; }
function localDateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function downloadInterventionsCsv(rows: any[]) {
  const columns = ["Fecha", "Trabajo", "Detalle", "Máquina", "Área", "Isla", "Técnico", "Turno", "Ticket", "Estado", "Notas"];
  const csvCell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const values = rows.map(item => [item.occurred_at ? new Date(item.occurred_at).toLocaleString("es-CL") : "", item.task, item.detail, item.machine, item.area, item.island, item.technician, item.shift, item.ticket_id, item.pending ? "Pendiente" : "Resuelta", item.notes]);
  const content = `\uFEFF${[columns, ...values].map(row => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `bitacora-${localDateValue(new Date())}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function AvatarPicker({ token, seed, className = "", endpoint = "/auth/me/avatar", canEdit = true }: any) {
  const [src, setSrc] = useState(avatarImage(seed));
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setSrc(avatarImage(seed));
    fetch(`/api${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.blob() : null)
      .then(blob => { if (blob && active) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); } })
      .catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, seed, version, endpoint]);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Formato permitido: JPG, PNG o WebP."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("La foto debe pesar 2 MB o menos."); return; }
    setSaving(true); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(`/api${endpoint}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail || "No se pudo guardar la foto."); }
      setVersion(current => current + 1);
    } catch (uploadError: any) { setError(uploadError.message); }
    finally { setSaving(false); }
  };
  if (!canEdit) return <img className={`${className} avatar-image`} src={src} alt="Foto del técnico"/>;
  return <><label className={`avatar-picker ${className} ${saving ? "uploading" : ""}`} title={error || "Cambiar foto de perfil"} aria-label="Cambiar foto de perfil"><img src={src} alt="" aria-hidden="true"/><span>{saving ? "…" : "⌕"}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={upload}/></label>{error && <small role="alert" className="error">{error}</small>}</>;
}
function Kpi({ title, value, foot, icon, tone }: any) { return <div className="kpi-card"><div className="kpi-top"><span>{title}</span><span className={`kpi-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{foot}</small></div>; }
function PanelHeading({ title, sub, action, click, actionAlt, clickAlt }: any) { return <div className="panel-heading"><div><h2>{title}</h2><p>{sub}</p></div>{(action || actionAlt) && <div className="panel-actions">{actionAlt && <button onClick={clickAlt} className="link-button">{actionAlt}</button>}{action && <button onClick={click} className="link-button">{action} <span>→</span></button>}</div>}</div>; }
function Badge({ value }: { value: string }) { const v = (value || "NUEVO").toUpperCase(); const tone = v.includes("RESUELTO") || v.includes("CERRADO") || v === "OPERATIVA" || v === "RECIBIDA" ? "green" : v.includes("CRÍTICA") || v.includes("CRITICA") || v.includes("FUERA") ? "red" : v.includes("ALTA") || v.includes("PENDIENTE") || v.includes("PROCESO") ? "orange" : "blue"; return <span className={`badge ${tone}`}>{value}</span>; }
function slaCountdown(dueAt: string) { const delta = new Date(dueAt).getTime() - Date.now(); const minutes = Math.floor(Math.abs(delta) / 60000); const days = Math.floor(minutes / 1440); const hours = Math.floor((minutes % 1440) / 60); const rest = minutes % 60; const duration = days ? `${days} d ${hours} h` : hours ? `${hours} h ${rest} min` : `${rest} min`; return delta < 0 ? `Vencido hace ${duration}` : `Vence en ${duration}`; }
function Empty({ text }: { text: string }) { return <div className="empty"><span>▤</span>{text}</div>; }
function EmailSettingsView({ token }: any) {
  const empty = { smtp_host: "", smtp_port: 587, smtp_user: "", smtp_from: "", smtp_from_name: "Gestión Técnica", smtp_use_tls: true, smtp_password_set: false, notification_email_to: "", report_email_to: "", report_email_cc: "", updated_at: null };
  const [settings, setSettings] = useState<any>(empty); const [password, setPassword] = useState(""); const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [testing, setTesting] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { api("/admin/email-settings", token).then(setSettings).catch((e:any) => setError(e.message)).finally(() => setLoading(false)); }, [token]);
  const payload = () => ({ ...settings, smtp_password: password });
  const save = async () => {
    setError(""); setMessage(""); setSaving(true);
    try { const updated = await api("/admin/email-settings", token, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) }); setSettings(updated); setPassword(""); setMessage("Configuración guardada."); return true; }
    catch (e:any) { setError(e.message); return false; } finally { setSaving(false); }
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); await save(); };
  const useGmail = () => setSettings((current:any) => ({ ...current, smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_use_tls: true, smtp_from: current.smtp_user || current.smtp_from }));
  const test = async () => {
    if (!testEmail.trim()) { setError("Ingresa el correo que recibirá la prueba."); return; }
    if (!(await save())) return;
    setTesting(true); setError(""); setMessage("");
    try { await api("/admin/email-settings/test", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: testEmail }) }); setMessage(`Correo de prueba enviado a ${testEmail}.`); }
    catch (e:any) { setError(e.message); } finally { setTesting(false); }
  };
  if (loading) return <section className="panel full-panel"><div className="empty">Cargando configuración…</div></section>;
  return <section className="panel full-panel email-settings-panel"><PanelHeading title="Configuración de correo" sub="Servidor SMTP, destinatarios de avisos y reportes · solo administradores"/><form className="email-settings-form" onSubmit={submit}>
    <div className="email-settings-section"><div className="email-settings-title"><div><h3>Servidor de salida (SMTP)</h3><p>Usa los datos entregados por tu proveedor de correo o el administrador de sistemas.</p></div><button type="button" className="secondary" onClick={useGmail}>Usar Gmail</button></div>
      <div className="form-row"><label>Servidor SMTP<input value={settings.smtp_host} onChange={e=>setSettings({...settings,smtp_host:e.target.value})} placeholder="smtp.ejemplo.com" maxLength={255}/></label><label>Puerto<input type="number" min="1" max="65535" value={settings.smtp_port} onChange={e=>setSettings({...settings,smtp_port:Number(e.target.value)})}/></label></div>
      <div className="form-row"><label>Usuario SMTP<input value={settings.smtp_user} onChange={e=>setSettings({...settings,smtp_user:e.target.value})} autoComplete="username" placeholder="avisos@empresa.cl" maxLength={255}/></label><label>Contraseña SMTP<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder={settings.smtp_password_set ? "Guardada · dejar vacía para conservarla" : "Contraseña de aplicación de Google"} maxLength={1024}/><small className="email-help">Para Gmail, usa una contraseña de aplicación (requiere verificación en dos pasos); la contraseña normal de Google no funciona aquí. <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer">Cómo crearla</a>. OAuth2 no está disponible en esta aplicación.</small></label></div>
      <div className="form-row"><label>Correo remitente<input type="email" value={settings.smtp_from} onChange={e=>setSettings({...settings,smtp_from:e.target.value})} placeholder="avisos@empresa.cl" maxLength={255}/></label><label>Nombre remitente<input value={settings.smtp_from_name} onChange={e=>setSettings({...settings,smtp_from_name:e.target.value})} maxLength={120}/></label></div>
      <label className="email-checkbox"><input type="checkbox" checked={settings.smtp_use_tls} onChange={e=>setSettings({...settings,smtp_use_tls:e.target.checked})}/> Usar conexión TLS (recomendado por la mayoría de proveedores)</label>
    </div>
    <div className="email-settings-section"><h3>Quién recibe los correos</h3><p>Separa varias direcciones con coma o punto y coma.</p>
      <label>Destinatarios de avisos de tickets y SLA<textarea rows={2} value={settings.notification_email_to} onChange={e=>setSettings({...settings,notification_email_to:e.target.value})} placeholder="mantencion@empresa.cl, supervisor@empresa.cl"/></label>
      <div className="form-row"><label>Destinatarios de reportes<input value={settings.report_email_to} onChange={e=>setSettings({...settings,report_email_to:e.target.value})} placeholder="jefatura@empresa.cl"/></label><label>Con copia (CC) en reportes<input value={settings.report_email_cc} onChange={e=>setSettings({...settings,report_email_cc:e.target.value})} placeholder="supervisor@empresa.cl"/></label></div>
    </div>
    {error && <div className="error">{error}</div>}{message && <div className="success-message">{message}</div>}
    <div className="email-settings-actions"><button className="primary" disabled={saving||testing}>{saving?"Guardando…":"Guardar configuración"}</button>{settings.updated_at && <small>Actualizada {new Date(settings.updated_at).toLocaleString("es-CL")}</small>}</div>
  </form><div className="email-test"><div><h3>Probar envío</h3><p>Guarda los cambios y envía un correo de prueba a esta dirección.</p></div><div className="email-test-controls"><input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="tu.correo@empresa.cl"/><button className="secondary" disabled={saving||testing} onClick={test}>{testing?"Enviando…":"Enviar prueba"}</button></div></div></section>;
}
function AuditView({ token, query }: any) {
  const [page, setPage] = useState(1); const [data, setData] = useState<any>({items: [], total: 0}); const [error, setError] = useState("");
  useEffect(() => { api(`/admin/audit?page=${page}&size=50&q=${encodeURIComponent(query)}`, token).then(setData).catch((e:any)=>setError(e.message)); }, [token, page, query]);
  return <section className="panel full-panel"><PanelHeading title="Registro de auditoría" sub={`${data.total} cambios registrados · solo visible para administradores`}/>{error && <div className="alert">{error}</div>}<div className="table-wrap"><table><thead><tr><th>FECHA</th><th>USUARIO</th><th>ACCIÓN</th><th>ENTIDAD</th><th>CAMBIO ANTERIOR</th><th>CAMBIO NUEVO</th></tr></thead><tbody>{data.items.map((log:any)=><tr key={log.id}><td>{new Date(log.at).toLocaleString("es-CL")}</td><td>{log.user}</td><td><b>{log.action}</b></td><td>{log.entity}</td><td><code>{log.old_value || "—"}</code></td><td><code>{log.new_value || "—"}</code></td></tr>)}</tbody></table></div>{!data.items.length&&<Empty text="No hay registros para esta búsqueda."/>}<div className="pagination"><span>{data.total} registros</span><div><button className="secondary" disabled={page<=1} onClick={()=>setPage(page-1)}>← Anterior</button><b>Página {page} de {Math.max(1,Math.ceil(data.total/50))}</b><button className="secondary" disabled={page*50>=data.total} onClick={()=>setPage(page+1)}>Siguiente →</button></div></div></section>;
}
function MachineModal({ token, machine, areas = [], onClose, onSaved }: any) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const data: any = Object.fromEntries(f.entries());
    for (const key of Object.keys(data)) if (data[key] === "") data[key] = null;
    data.number = machine?.number || data.number;
    setSaving(true); try { await api(machine ? `/machines/${encodeURIComponent(machine.number)}` : "/machines", token, { method: machine ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); onClose(); onSaved(); }
    catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>{machine ? `Editar máquina ${machine.number}` : "Nueva máquina"}</h2><p>{machine ? "Actualiza los datos del activo. El número se mantiene como identificador." : "Registra un activo técnico; datos desconocidos pueden quedar vacíos."}</p></div><button type="button" className="close" onClick={onClose}>×</button></div><div className="form-row"><label>Número de máquina<input name="number" required maxLength={20} defaultValue={machine?.number || ""} readOnly={Boolean(machine)}/></label><label>Isla<input name="island" maxLength={10} placeholder="Opcional" defaultValue={machine?.island || ""}/></label></div><div className="form-row"><label>Área{machine ? <select name="area" defaultValue={machine.area || ""}><option value="">Sin área</option>{areas.map((area: string) => <option key={area} value={area}>{area}</option>)}</select> : <input name="area" maxLength={60} placeholder="Ej. Slots"/>}</label><label>Fabricante<input name="manufacturer" maxLength={80} placeholder="Desconocido" defaultValue={machine?.manufacturer || ""}/></label></div><div className="form-row"><label>Modelo<input name="model" maxLength={80} defaultValue={machine?.model || ""}/></label><label>Número de serie<input name="serial" maxLength={80} defaultValue={machine?.serial || ""}/></label></div>{error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : machine ? "Guardar cambios" : "Guardar máquina"}</button></div></form></div>;
}
function MachineStatusModal({ token, machine, onClose, onSaved }: any) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const data: any = Object.fromEntries(f.entries()); data.ticket_id = data.ticket_id ? Number(data.ticket_id) : null; setSaving(true);
    try { await api(`/machines/${encodeURIComponent(machine.number)}/status`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); onClose(); onSaved(); }
    catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>Cambiar estado · Máquina {machine.number}</h2><p>Estado actual: {STATES[machine.status] || machine.status}</p></div><button type="button" className="close" onClick={onClose}>×</button></div><label>Nuevo estado<select name="new_status" defaultValue={machine.status} required>{Object.entries(STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Motivo<textarea name="reason" rows={3} required placeholder="Describe la causa del cambio de estado"/></label><label>Ticket relacionado<input name="ticket_id" type="number" min="1" placeholder="Opcional" onChange={e => { if (!e.target.value) e.target.value = ""; }}/></label>{error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar cambio"}</button></div></form></div>;
}
function PreventiveMaintenanceView({ token, machines, technicians, canManage, canChangeMachineStatus, onMachineStatus, onMachineHistory }: any) {
  const [plans, setPlans] = useState<any[]>([]); const [history, setHistory] = useState<Record<number, any[]>>({});
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const [completionTarget, setCompletionTarget] = useState<any>(null); const [planMachineTarget, setPlanMachineTarget] = useState<any>(null); const [planScope, setPlanScope] = useState("machine");
  const [fleetIsland, setFleetIsland] = useState(""); const [fleetSearch, setFleetSearch] = useState(""); const [maintenanceFilter, setMaintenanceFilter] = useState(""); const fleetMapRef = useRef<HTMLElement | null>(null); const [separateClusters, setSeparateClusters] = useState(false); const [expandedFleetIsland, setExpandedFleetIsland] = useState<string | null>(null); const [fleetMachineNumber, setFleetMachineNumber] = useState<string | null>(null);
  const load = async () => { try { setPlans(await api("/maintenance/plans", token)); } catch (e: any) { setError(e.message); } };
  useEffect(() => { load(); }, [token]);
  const targetIslandMachines = planMachineTarget?.island ? machines.filter((machine: any) => String(machine.island) === String(planMachineTarget.island)) : [];
  const submitMachinePlan = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!planMachineTarget) return; const form = new FormData(event.currentTarget); const machineNumbers = planScope === "island" && targetIslandMachines.length ? targetIslandMachines.map((machine: any) => String(machine.number)) : [String(planMachineTarget.number)]; setSaving(true); setError(""); try { await api("/maintenance/plans", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machine_numbers: machineNumbers, title: form.get("title"), description: form.get("description"), interval_days: Number(form.get("interval_days")), next_due_at: form.get("next_due_at") }) }); setPlanMachineTarget(null); setPlanScope("machine"); await load(); } catch (e: any) { setError(e.message); } finally { setSaving(false); } };
  const complete = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); if (!completionTarget) return; setSaving(true); setError(""); try { await api(`/maintenance/plans/${completionTarget.id}/complete`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ technician: form.get("technician"), notes: form.get("notes") }) }); setCompletionTarget(null); await load(); } catch (e: any) { setError(e.message); } finally { setSaving(false); } };
  const toggleHistory = async (plan: any) => { if (history[plan.id]) { setHistory(current => { const next = {...current}; delete next[plan.id]; return next; }); return; } try { const rows = await api(`/maintenance/plans/${plan.id}/history`, token); setHistory(current => ({...current, [plan.id]: rows})); } catch (e: any) { setError(e.message); } };
  const toggleActive = async (plan: any) => { try { await api(`/maintenance/plans/${plan.id}/active?active=${!plan.active}`, token, { method: "PATCH" }); await load(); } catch (e: any) { setError(e.message); } };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const threeDaysAhead = new Date(today); threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);
  const dueDateForPlan = (plan: any) => new Date(`${String(plan.next_due_at).slice(0, 10)}T00:00:00`);
  const overduePlans = plans.filter(plan => plan.active && dueDateForPlan(plan) < today);
  const upcomingPlans = plans.filter(plan => plan.active && dueDateForPlan(plan) >= today && dueDateForPlan(plan) <= threeDaysAhead);
  const due = overduePlans.length;
  const machinesForMaintenanceFilter = new Set((maintenanceFilter === "overdue" ? overduePlans : maintenanceFilter === "upcoming" ? upcomingPlans : []).map(plan => String(plan.machine_number)));
  const maintenanceStateByMachine = new Map<string, string>();
  for (const plan of plans.filter(item => item.active)) {
    const number = String(plan.machine_number); const dueDate = dueDateForPlan(plan);
    const state = dueDate < today ? "overdue" : dueDate <= threeDaysAhead ? "upcoming" : "scheduled";
    const previous = maintenanceStateByMachine.get(number);
    if (state === "overdue" || (!previous && state === "upcoming") || !previous) maintenanceStateByMachine.set(number, state);
  }
  const fleetIslands = [...new Set(machines.map((machine: any) => String(machine.island ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const fleetVisibleMachines = machines.filter((machine: any) => (!fleetIsland || String(machine.island ?? "") === fleetIsland) && (!maintenanceFilter || machinesForMaintenanceFilter.has(String(machine.number))) && matchesMachineSearch(machine, fleetSearch)).sort((a: any, b: any) => {
    const islandA = String(a.island ?? "").trim();
    const islandB = String(b.island ?? "").trim();
    if (!islandA && islandB) return 1;
    if (islandA && !islandB) return -1;
    return islandA.localeCompare(islandB, "es", { numeric: true, sensitivity: "base" })
      || String(a.number).localeCompare(String(b.number), "es", { numeric: true });
  });
  const fleetStatusKeys = [...Object.keys(STATES), ...([...new Set(fleetVisibleMachines.map((machine: any) => machine.status))].filter((status: string) => !STATES[status]))];
  const fleetStatusCounts = fleetStatusKeys.map(status => ({ status, label: STATES[status] || "Sin clasificar", count: fleetVisibleMachines.filter((machine: any) => machine.status === status).length }));
  const fleetStatusColors: Record<string, string> = { OPERATIVA: "#27a957", OPERATIVA_CON_OBSERVACION: "#e8aa19", EN_MANTENIMIENTO: "#e88932", FUERA_DE_SERVICIO: "#dc4c4b", PENDIENTE_DE_REPUESTO: "#4388c4", RETIRADA: "#8b95a3" };
  let fleetChartCursor = 0;
  const fleetChartStops = fleetStatusCounts.filter(item => item.count > 0).map(item => { const start = fleetChartCursor; fleetChartCursor += item.count / Math.max(1, fleetVisibleMachines.length) * 100; return `${fleetStatusColors[item.status] || "#aab3bf"} ${start}% ${fleetChartCursor}%`; }).join(", ");
  const fleetIslandGroups = [...new Set(fleetVisibleMachines.map((machine: any) => String(machine.island || "Sin isla")))]
    .sort((a, b) => a === "Sin isla" ? 1 : b === "Sin isla" ? -1 : a.localeCompare(b, "es", { numeric: true }))
    .map(island => ({ island, machines: fleetVisibleMachines.filter((machine: any) => String(machine.island || "Sin isla") === island) }));
  const fleetMachineGroups = separateClusters && !fleetIsland
    ? fleetIslandGroups
    : [{ island: fleetIsland ? `Isla ${fleetIsland}` : "Parque de máquinas", machines: fleetVisibleMachines }];
  const renderFleetMachine = (machine: any) => <button type="button" key={machine.number} className={`maintenance-machine-hex ${STATUS_CLASS[machine.status] || "gray"} ${String(machine.number) === fleetMachineNumber ? "selected" : ""} maintenance-${maintenanceStateByMachine.get(String(machine.number)) || "none"}`} title={`Máquina ${machine.number} · ${STATES[machine.status] || machine.status}`} aria-label={`Máquina ${machine.number}, ${STATES[machine.status] || machine.status}`} aria-pressed={String(machine.number) === fleetMachineNumber} onClick={() => { setFleetMachineNumber(String(machine.number)); setPlanScope("machine"); setPlanMachineTarget(machine); }}><span>{machine.number}</span><svg className="maintenance-slot-icon" viewBox="0 0 16 20" aria-hidden="true"><rect x="2" y="1" width="12" height="15" rx="1.5"/><rect x="4" y="3" width="8" height="7" rx=".5"/><path d="M6.7 3v7M9.3 3v7M4 12h8M5 16v3M11 16v3"/><circle cx="12" cy="12" r=".6" fill="currentColor" stroke="none"/></svg></button>;
  const plansForTargetMachine = planMachineTarget ? plans.filter(plan => String(plan.machine_number) === String(planMachineTarget.number)).sort((a, b) => new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime()) : [];
  return <><section className="warehouse-summary"><article className="warehouse-stat"><small>PLANES ACTIVOS</small><b>{plans.filter(p => p.active).length}</b><span>Rutinas preventivas vigentes</span></article><button type="button" className={`warehouse-stat maintenance-filter-stat ${maintenanceFilter === "upcoming" ? "maintenance-filter-active" : ""}`} onClick={() => { setMaintenanceFilter(maintenanceFilter === "upcoming" ? "" : "upcoming"); fleetMapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><small>PRÓXIMOS 3 DÍAS</small><b>{upcomingPlans.length}</b><span>Máquinas que requieren revisión · ver en mapa</span></button><button type="button" className={`warehouse-stat warehouse-alert-stat maintenance-filter-stat ${due ? "has-alert" : ""} ${maintenanceFilter === "overdue" ? "maintenance-filter-active" : ""}`} onClick={() => { setMaintenanceFilter(maintenanceFilter === "overdue" ? "" : "overdue"); fleetMapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><small>ATRASADOS</small><b>{due}</b><span>Planes vencidos · ver en mapa</span></button></section><section className="maintenance-fleet-overview"><div className="maintenance-fleet-side"><div className="maintenance-fleet-cluster"><label htmlFor="maintenance-fleet-island">Isla / grupo</label><select id="maintenance-fleet-island" value={fleetIsland} onChange={event => { setFleetIsland(event.target.value); setFleetMachineNumber(null); }}><option value="">Todas las islas</option>{fleetIslands.map(island => <option key={island} value={island}>Isla {island}</option>)}</select><span>Vista del parque de máquinas por estado</span></div><article className="maintenance-fleet-today"><div><small>PLANES PREVENTIVOS ACTIVOS</small><b>{plans.filter(plan => plan.active).length}</b></div><span>{plans.filter(plan => plan.active && new Date(plan.next_due_at) <= Date.now() + 7 * 86400000).length} requieren atención esta semana</span></article><section className="maintenance-state-panel"><div className="maintenance-state-heading"><div><b>Estado del parque</b><small>Condición actual de las máquinas</small></div></div><div className="maintenance-state-chart-row"><div className="maintenance-state-donut" style={{ "--maintenance-state-chart": fleetVisibleMachines.length ? `conic-gradient(${fleetChartStops})` : "conic-gradient(#e8edf2 0% 100%)" } as React.CSSProperties}><div><b>{fleetVisibleMachines.length}</b><small>Máquinas</small></div></div><div className="maintenance-state-legend">{fleetStatusCounts.map(item => <div key={item.status}><i style={{ background: fleetStatusColors[item.status] || "#aab3bf" }}/><span>{item.label}</span><b>{item.count}</b></div>)}</div></div></section></div><section className="maintenance-fleet-map" ref={fleetMapRef}><header><div><b>Estado de máquinas</b><small>{fleetVisibleMachines.length} equipos · selecciona una máquina para crear o revisar sus planes{maintenanceFilter ? ` · filtro: ${maintenanceFilter === "overdue" ? "atrasados" : "por vencer"}` : ""}</small></div><div className="maintenance-fleet-map-actions"><input aria-label="Buscar máquina en el mapa" value={fleetSearch} onChange={event => setFleetSearch(event.target.value)} placeholder="Buscar máquina…"/>{maintenanceFilter && <button type="button" onClick={() => setMaintenanceFilter("")}>Quitar filtro</button>}<button type="button" className={separateClusters ? "active" : ""} onClick={() => setSeparateClusters(value => !value)}>{separateClusters ? "Unir grupos" : "Separar grupos"}</button></div></header>{!separateClusters && !fleetIsland ? <div className="maintenance-island-picker">{fleetIslandGroups.map(group => { const expanded = expandedFleetIsland === group.island; const label = group.island === "Sin isla" ? "Sin isla" : `Isla ${group.island}`; return <section className={`maintenance-island-card ${expanded ? "expanded" : ""}`} key={group.island}><button type="button" className="maintenance-island-card-button" aria-expanded={expanded} onClick={() => setExpandedFleetIsland(expanded ? null : group.island)}><span className="maintenance-island-icon" aria-hidden="true">⌂</span><span className="maintenance-island-card-copy"><b>{label}</b><small>{group.machines.length} máquinas · mostrar grupo</small></span><i>{expanded ? "−" : "+"}</i></button>{expanded && <div className="maintenance-hex-grid">{group.machines.map(renderFleetMachine)}</div>}</section>; })}</div> : fleetMachineGroups.map(group => <section className="maintenance-cluster-group" key={group.island}><div className="maintenance-cluster-title"><b>{group.island === "Sin isla" ? "Máquinas sin isla" : group.island.startsWith("Isla ") ? group.island : `Isla ${group.island}`}</b><span>{group.machines.length} máquinas</span></div><div className="maintenance-hex-grid">{group.machines.map(renderFleetMachine)}</div></section>)}{!fleetVisibleMachines.length && <Empty text="No hay máquinas para los filtros seleccionados."/>}</section></section>

    {error && <div className="alert">{error}<button onClick={() => setError("")}>×</button></div>}

    {planMachineTarget && <div className="modal-shade" onMouseDown={event => event.target === event.currentTarget && setPlanMachineTarget(null)}><section className="modal maintenance-machine-plan-modal"><div className="modal-head"><div><h2>{canManage ? "Nuevo plan preventivo" : "Planes preventivos"}</h2><p>Máquina {planMachineTarget.number}{planMachineTarget.island ? ` · Isla ${planMachineTarget.island}` : " · Sin isla"}</p></div><button type="button" className="close" onClick={() => setPlanMachineTarget(null)}>×</button></div><div className="maintenance-modal-machine-context"><Badge value={STATES[planMachineTarget.status] || planMachineTarget.status}/><span>{[planMachineTarget.manufacturer, planMachineTarget.model].filter(Boolean).join(" · ") || "Equipo sin datos de fabricante"}</span><div>{onMachineHistory && <button type="button" onClick={() => onMachineHistory(planMachineTarget)}>Ver historial</button>}{canChangeMachineStatus && onMachineStatus && <button type="button" onClick={() => onMachineStatus(planMachineTarget)}>Cambiar estado</button>}</div></div>{canManage && <form className="maintenance-machine-plan-form" onSubmit={submitMachinePlan}><h3>Nuevo plan preventivo</h3><label>Programar para<select value={planScope} onChange={event => setPlanScope(event.target.value)}><option value="machine">Solo máquina {planMachineTarget.number}</option><option value="island" disabled={!targetIslandMachines.length}>Toda la Isla {planMachineTarget.island || "(sin isla)"} · {targetIslandMachines.length} máquinas</option></select></label>{planScope === "island" && <div className="maintenance-island-plan-summary"><b>Se crearán {targetIslandMachines.length} planes</b><span>{targetIslandMachines.map((machine: any) => String(machine.number)).join(", ")}</span></div>}<label>Trabajo preventivo<input name="title" required maxLength={160} placeholder="Ej. Limpieza y revisión de ventilación"/></label><div className="form-row"><label>Frecuencia (días)<input name="interval_days" type="number" min="1" max="3650" defaultValue="30" required/></label><label>Próximo vencimiento<input name="next_due_at" type="date" required defaultValue={localDateValue(new Date())}/></label></div><label>Instrucciones<textarea name="description" rows={3} maxLength={4000} placeholder="Tareas, repuestos o controles a considerar"/></label><div className="modal-actions"><button type="button" className="secondary" onClick={() => setPlanMachineTarget(null)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : planScope === "island" ? `Crear ${targetIslandMachines.length} planes para la isla` : "Crear plan preventivo"}</button></div></form>}{error && <div className="error">{error}</div>}<div className="maintenance-machine-existing-plans"><h3>Planes de esta máquina</h3>{plansForTargetMachine.length ? plansForTargetMachine.map(plan => <article className={`maintenance-plan-card ${plan.active && new Date(plan.next_due_at) < new Date() ? "is-late" : ""}`} key={plan.id}><div className="maintenance-plan-card-head"><div><small>PRÓXIMO MANTENIMIENTO</small><h3>{plan.title}</h3></div><Badge value={!plan.active ? "INACTIVO" : new Date(plan.next_due_at) < new Date() ? "ATRASADO" : "PROGRAMADO"}/></div>{plan.description && <p className="maintenance-plan-description">{plan.description}</p>}<div className="maintenance-plan-meta"><span><small>FECHA</small><b>{new Date(plan.next_due_at).toLocaleDateString("es-CL")}</b></span><span><small>FRECUENCIA</small><b>Cada {plan.interval_days} días</b></span></div><div className="maintenance-plan-actions">{plan.active && <button type="button" className="link-button" onClick={() => setCompletionTarget(plan)}>Registrar ejecución</button>}<button type="button" className="link-button" onClick={() => toggleHistory(plan)}>{history[plan.id] ? "Cerrar historial" : "Historial"}</button>{canManage && <button type="button" className="link-button" onClick={() => toggleActive(plan)}>{plan.active ? "Pausar" : "Activar"}</button>}</div>{history[plan.id] && <div className="maintenance-history">{history[plan.id].length ? history[plan.id].map((log: any) => <div key={log.id}><b>{new Date(log.completed_at).toLocaleString("es-CL")} · {log.technician}</b><span>Programado: {new Date(log.due_at).toLocaleDateString("es-CL")}</span><p>{log.notes || "Sin observaciones"}</p></div>) : <small>Sin ejecuciones registradas todavía.</small>}</div>}</article>) : <Empty text="Esta máquina todavía no tiene planes preventivos."/>}</div></section></div>}
    {completionTarget && <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && setCompletionTarget(null)}><form className="modal" onSubmit={complete}><div className="modal-head"><div><h2>Registrar mantenimiento realizado</h2><p>Máquina {completionTarget.machine_number} · {completionTarget.title}</p></div><button type="button" className="close" onClick={() => setCompletionTarget(null)}>×</button></div><label>Técnico<select name="technician" required defaultValue=""><option value="">Seleccionar técnico</option>{technicians.filter((technician: any) => technician.status !== "INACTIVO").map((technician: any) => <option key={technician.id} value={`${technician.first_name} ${technician.last_name}`.trim()}>{technician.first_name} {technician.last_name}</option>)}</select></label><label>Trabajo realizado / observaciones<textarea name="notes" rows={4} maxLength={4000} placeholder="Describe el trabajo realizado, hallazgos o repuestos utilizados"/></label><div className="modal-actions"><button type="button" className="secondary" onClick={() => setCompletionTarget(null)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar ejecución"}</button></div></form></div>}
  </>;
}

function MachineHistoryModal({ token, machine, onClose }: any) {
  const [history, setHistory] = useState<any[]>([]); const [error, setError] = useState(""); const [loadingHistory, setLoadingHistory] = useState(true);
  useEffect(()=>{api(`/machines/${encodeURIComponent(machine.number)}/history`,token).then(setHistory).catch((e:any)=>setError(e.message)).finally(()=>setLoadingHistory(false));},[machine.number,token]);
  return <div className="modal-shade" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal machine-history-modal"><div className="modal-head"><div><h2>Historial · Máquina {machine.number}</h2><p>Cambios de estado, bitácora, mantenimiento preventivo y movimientos de inventario.</p></div><button className="close" onClick={onClose}>×</button></div>{loadingHistory?<div className="history-loading">Cargando historial…</div>:error?<div className="error">{error}</div>:history.length?<div className="machine-history-list">{history.map((entry:any,index:number)=><article className="machine-history-entry" key={`${entry.type}-${entry.at}-${index}`}><span className={`status-dot ${entry.type==="inventario"?"blue":entry.type==="intervencion"?"orange":STATUS_CLASS[entry.new]||"gray"}`}/><div className="machine-history-content">{entry.type==="inventario"?<><div className="machine-history-title"><b>{entry.movement_type==="ENTRADA"?"Ingreso asociado":entry.movement_type==="AJUSTE"?"Ajuste asociado":entry.inventory_type==="INSUMO"?"Uso de insumo":"Uso de repuesto"}</b><span>·</span><b>{entry.part_name}</b></div><time>{new Date(entry.at).toLocaleString("es-CL")}</time><p>{entry.movement_type} · {Math.abs(entry.quantity)} unidades · Código {entry.part_code}</p><small>{entry.technician?`Técnico: ${entry.technician} · `:""}Stock restante: {entry.stock_after}{entry.ticket_id?` · Ticket #${entry.ticket_id}`:""}{entry.notes?` · ${entry.notes}`:""}</small></>:entry.type==="intervencion"?<><div className="machine-history-title"><b>{entry.work_type||"Intervención"}</b><span>·</span><b>{entry.pending?"Pendiente":"Registrada"}</b></div><time>{new Date(entry.at).toLocaleString("es-CL")}</time><p><strong>{entry.task}</strong>{entry.detail?` · ${entry.detail}`:""}</p><small>{entry.technician?`Técnico: ${entry.technician} · `:""}{entry.shift?`Turno: ${entry.shift} · `:""}{entry.area?`Área: ${entry.area} · `:""}{entry.ticket_id?`Ticket #${entry.ticket_id} · `:""}{entry.notes?`Notas: ${entry.notes}`:""}</small></>:<><div className="machine-history-title"><b>{STATES[entry.old]||entry.old}</b><span>→</span><b>{STATES[entry.new]||entry.new}</b></div><time>{new Date(entry.at).toLocaleString("es-CL")}</time><p>{entry.reason||"Sin motivo registrado"}</p><small>{entry.ticket_id?`Ticket #${entry.ticket_id}`:"Sin ticket relacionado"}{entry.downtime_minutes!=null?` · Tiempo fuera de servicio: ${Math.floor(entry.downtime_minutes/60)} h ${entry.downtime_minutes%60} min`:""}</small></>}</div></article>)}</div>:<Empty text="Esta máquina todavía no tiene cambios de estado, intervenciones ni movimientos de inventario registrados."/>}<div className="modal-actions"><button className="secondary" onClick={onClose}>Cerrar</button></div></div></div>;
}
function SystemUserModal({ token, user, technicians, onClose, onSaved }: any) {
  const [error,setError]=useState(""); const [saving,setSaving]=useState(false);
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=new FormData(e.currentTarget);const data:any=Object.fromEntries(form.entries());if(!form.has("technician_id"))data.technician_id=(e.currentTarget.elements.namedItem("technician_id") as HTMLSelectElement).value;data.technician_id=data.technician_id?Number(data.technician_id):null;if(!data.password)data.password=null;setSaving(true);try{await api(user?`/admin/users/${user.id}`:"/admin/users",token,{method:user?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});onSaved()}catch(x:any){setError(x.message)}finally{setSaving(false)}};
  return <div className="modal-shade" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>{user?"Editar cuenta":"Crear usuario del sistema"}</h2><p>Las personas con rol Técnico deben quedar vinculadas a su ficha.</p></div><button type="button" className="close" onClick={onClose}>×</button></div><label>Nombre completo<input name="full_name" required maxLength={120} defaultValue={user?.full_name||""}/></label><label>Correo de acceso<input name="username" type="text" required maxLength={50} defaultValue={user?.username||""} placeholder="correo@empresa.cl"/></label><div className="form-row"><label>Rol<select name="role" defaultValue={user?.role||"USUARIO"}>{["ADMIN","JEFE","SUPERVISOR","TECNICO","CONSULTA","USUARIO"].map(role=><option key={role} value={role}>{role}</option>)}</select></label><label>Ficha de técnico<select name="technician_id" defaultValue={user?.technician_id||""}><option value="">No aplica</option>{technicians.filter((tech:any)=>tech.status!=="INACTIVO" || tech.id===user?.technician_id).map((tech:any)=><option key={tech.id} value={tech.id} disabled={tech.status==="INACTIVO"}>{tech.first_name} {tech.last_name} · {tech.status}</option>)}</select></label></div><label>{user?"Nueva contraseña (opcional)":"Contraseña inicial"}<input name="password" type="password" minLength={8} maxLength={72} required={!user} autoComplete="new-password" placeholder={user?"Dejar vacía para conservar la actual":"Mínimo 8 caracteres"}/></label>{error&&<div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving?"Guardando…":user?"Guardar cambios":"Crear cuenta"}</button></div></form></div>;
}
function IslandModal({ token, onClose, onSaved }: any) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const data: any = Object.fromEntries(f.entries()); if (!data.hall) data.hall = null;
    setSaving(true); try { await api("/islands", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); onClose(); onSaved(); }
    catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>Nueva isla</h2><p>Agrega una ubicación al catálogo.</p></div><button type="button" className="close" onClick={onClose}>×</button></div><label>Número de isla<input name="number" required maxLength={10} placeholder="Ej. 207"/></label><label>Salón<input name="hall" maxLength={60} placeholder="Opcional"/></label>{error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar isla"}</button></div></form></div>;
}
function InterventionModal({ token, machines, parts, tickets, technicians, onClose, onSaved }: any) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkedTicketId, setLinkedTicketId] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");
  const [inventoryUsage, setInventoryUsage] = useState<any[]>([]);
  const [activeInventoryPicker, setActiveInventoryPicker] = useState<number | null>(null);
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState("");
  const [workType, setWorkType] = useState(""); const [machineNumber, setMachineNumber] = useState(""); const [machineSearch, setMachineSearch] = useState(""); const [showMachineOptions, setShowMachineOptions] = useState(false); const [maintenancePlanId, setMaintenancePlanId] = useState(""); const [maintenancePlans, setMaintenancePlans] = useState<any[]>([]); const [updateMachineStatus, setUpdateMachineStatus] = useState(false); const [machineStatus, setMachineStatus] = useState("");
  useEffect(() => { api("/maintenance/plans", token).then(setMaintenancePlans).catch(() => setMaintenancePlans([])); }, [token]);
  const isMaintenance = normalizeSearch(workType).includes("mantenimiento");
  const linkedMaintenancePlans = maintenancePlans.filter(plan => plan.active && (!machineNumber || String(plan.machine_number) === machineNumber));
  const machineSearchResults = machines.filter((machine: any) => matchesMachineSearch(machine, machineSearch)).sort((a: any, b: any) => String(a.number).localeCompare(String(b.number), "es", { numeric: true })).slice(0, 8);
  const selectedMachine = machines.find((machine: any) => String(machine.number) === machineNumber);
  const chooseMachine = (machine: any) => { setMachineNumber(String(machine.number)); setMachineSearch(String(machine.number)); setMaintenancePlanId(""); setMachineStatus(""); setUpdateMachineStatus(false); setShowMachineOptions(false); };
  const inventoryMatches = (term: string, index: number) => parts.filter((part: any) => {
    const usedElsewhere = inventoryUsage.some((use: any, useIndex: number) => useIndex !== index && String(use.part_id) === String(part.id));
    const searchText = `${part.code} ${part.name} ${part.category || ""} ${part.brand || ""} ${part.model || ""} ${part.inventory_type}`;
    const typeMatches = !inventoryTypeFilter || (part.inventory_type || "REPUESTO") === inventoryTypeFilter;
    return typeMatches && !usedElsewhere && (!term.trim() || normalizeSearch(searchText).includes(normalizeSearch(term)));
  }).slice(0, 20);
  const selectInventoryPart = (index: number, part: any) => {
    setInventoryUsage(rows => rows.map((row, rowIndex) => rowIndex === index
      ? { ...row, part_id: String(part.id), search: `${part.code} · ${part.name}` }
      : row));
    setActiveInventoryPicker(null);
  };
  const linkedTicket = tickets.find((ticket: any) => String(ticket.id) === linkedTicketId);
  const ticketStates = ["NUEVO", "ASIGNADO", "EN PROCESO", "PENDIENTE", "ESPERANDO REPUESTO", "ESPERANDO PROVEEDOR", "RESUELTO", "CERRADO", "CANCELADO"];
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(form.entries());
    data.ticket_id = data.ticket_id ? Number(data.ticket_id) : null;
    data.maintenance_plan_id = data.maintenance_plan_id ? Number(data.maintenance_plan_id) : null;
    if (data.update_machine_status === "true") { data.machine_status = data.machine_status || null; } else { data.machine_status = null; data.machine_status_reason = null; }
    delete data.update_machine_status;
    data.ticket_status = data.ticket_status || null;
    data.pending = form.get("follow_up_status") === "PENDIENTE";
    delete data.follow_up_status;
    const incompleteUse = inventoryUsage.find(row => !row.part_id || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1);
    if (incompleteUse) { setError("Selecciona un artículo y una cantidad válida, o elimina la línea vacía."); return; }
    const overStockUse = inventoryUsage.find(row => {
      const part = parts.find((item: any) => String(item.id) === String(row.part_id));
      return !part || Number(row.quantity) > part.stock;
    });
    if (overStockUse) { setError("La cantidad seleccionada supera el stock disponible. Actualiza el inventario y vuelve a intentarlo."); return; }
    data.parts_used = inventoryUsage.map(row => ({ part_id: Number(row.part_id), quantity: Number(row.quantity) }));
    for (const key of ["machine", "area", "technician", "shift", "work_type", "notes", "ticket_status_note", "island"]) if (!data[key]) data[key] = null;
    setSaving(true);
    try {
      await api("/interventions", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      onClose(); onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };
  const localTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><h2>Registrar intervención</h2><p>Agrega un trabajo ejecutado a la bitácora.</p></div><button type="button" className="close" onClick={onClose}>×</button></div>
    <div className="form-row"><label>Fecha y hora<input name="occurred_at" type="datetime-local" defaultValue={localTime}/></label><label>Tipo de trabajo<input name="work_type" value={workType} onChange={event => setWorkType(event.target.value)} placeholder="Falla, mantenimiento, revisión…"/></label></div>
    <div className="form-row intervention-machine-row">
      <label>Máquina<div className="machine-search-picker"><input aria-label="Buscar máquina para la intervención" aria-expanded={showMachineOptions} aria-controls="intervention-machine-results" autoComplete="off" placeholder="Buscar número, isla, serie, marca o modelo" value={machineSearch} onFocus={() => setShowMachineOptions(true)} onBlur={event => {
        setShowMachineOptions(false);
        if (machineNumber) return;
        const number = event.currentTarget.value.trim().toLowerCase();
        const exactMachine = machines.find((machine: any) => String(machine.number).toLowerCase() === number);
        if (exactMachine) chooseMachine(exactMachine);
      }} onChange={event => { setMachineSearch(event.target.value); setMachineNumber(""); setMaintenancePlanId(""); setUpdateMachineStatus(false); setMachineStatus(""); setShowMachineOptions(true); }} onKeyDown={event => { if (event.key === "Enter" && showMachineOptions && machineSearchResults.length) { event.preventDefault(); const machine = machineSearchResults[0]; chooseMachine(machine); } if (event.key === "Escape") setShowMachineOptions(false); }}/><input type="hidden" name="machine" value={machineNumber}/>{showMachineOptions && <div className="machine-search-results" id="intervention-machine-results" role="listbox">{machineSearchResults.length ? machineSearchResults.map((machine: any) => <button key={machine.number} type="button" role="option" aria-selected={String(machine.number) === machineNumber} onMouseDown={event => event.preventDefault()} onClick={() => { chooseMachine(machine); }}><b>Máquina {machine.number}</b><small>{[machine.island && `Isla ${machine.island}`, machine.manufacturer, machine.model, machine.serial && `Serie ${machine.serial}`, STATES[machine.status] || machine.status].filter(Boolean).join(" · ")}</small></button>) : <span className="machine-search-empty">No hay máquinas que coincidan.</span>}</div>}</div>{selectedMachine && <small className="machine-search-selected"><span>Seleccionada: <b>Máquina {selectedMachine.number}</b></span><button type="button" onClick={() => { setMachineNumber(""); setMachineSearch(""); setMaintenancePlanId(""); setMachineStatus(""); setUpdateMachineStatus(false); setShowMachineOptions(true); }}>Cambiar</button></small>}</label>
      <label>Ticket relacionado<select name="ticket_id" value={linkedTicketId} onChange={e => { const id = e.target.value; setLinkedTicketId(id); setTicketStatus(""); }}><option value="">Sin ticket vinculado</option>{tickets.map((t: any) => <option key={t.id} value={t.id}>#{t.id} · {t.task} · {t.status}</option>)}</select></label>
    </div>
    <input type="hidden" name="island" value={selectedMachine?.island ?? ""}/><input type="hidden" name="area" value={selectedMachine?.area ?? ""}/>
    {selectedMachine && <div className="machine-context-panel"><div className="machine-context-facts"><span><small>ISLA</small><b>{selectedMachine.island || "Sin isla"}</b></span><span><small>ÁREA</small><b>{selectedMachine.area || "Sin área"}</b></span><span><small>ESTADO ACTUAL</small><b>{STATES[selectedMachine.status] || selectedMachine.status}</b></span></div><label className="machine-status-toggle"><input type="checkbox" name="update_machine_status" value="true" checked={updateMachineStatus} onChange={event => { setUpdateMachineStatus(event.target.checked); setMachineStatus(""); }}/> Registrar también un cambio de estado</label>{updateMachineStatus && <div className="form-row"><label>Nuevo estado<select name="machine_status" value={machineStatus} onChange={event => setMachineStatus(event.target.value)} required><option value="">Seleccionar nuevo estado</option>{Object.entries(STATES).filter(([status]) => status !== selectedMachine.status).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label><label>Motivo del cambio<textarea name="machine_status_reason" rows={2} required placeholder="Indica por qué cambia el estado"/></label></div>}</div>}
    {isMaintenance && <label>Actualizar plan preventivo<select name="maintenance_plan_id" value={maintenancePlanId} onChange={event => setMaintenancePlanId(event.target.value)} required={linkedMaintenancePlans.length > 0}><option value="">{linkedMaintenancePlans.length ? "Seleccionar plan de esta máquina" : "Sin plan preventivo activo para esta máquina"}</option>{linkedMaintenancePlans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.title} · vence {new Date(plan.next_due_at).toLocaleDateString("es-CL")}</option>)}</select><small className="helper">Al vincularlo, esta ejecución también quedará en el historial del plan y calculará el próximo vencimiento.</small></label>}
    {linkedTicket && <div className="linked-ticket-update"><b>Actualizar el ticket #{linkedTicket.id} desde esta intervención</b><span>Estado actual: {linkedTicket.status}</span><label>Nuevo estado<select name="ticket_status" value={ticketStatus} onChange={e => setTicketStatus(e.target.value)}><option value="">Mantener estado actual</option>{ticketStates.map(state => <option key={state}>{state}</option>)}</select></label>{ticketStatus && ticketStatus !== linkedTicket.status && <label>Nota del cambio<textarea name="ticket_status_note" rows={2} maxLength={4000} placeholder="Opcional · describe el motivo del cambio"/></label>}</div>}
    <label>Trabajo realizado<input name="task" required maxLength={200}/></label>
    <label>Detalle<textarea name="detail" rows={3} placeholder="Acciones realizadas y hallazgos"/></label>
    <div className="form-row"><label>Técnico (obligatorio)<select name="technician" defaultValue="" required><option value="" disabled>Seleccionar técnico</option>{technicians.filter((t: any) => t.status !== "INACTIVO").map((t: any) => <option key={t.id}>{t.first_name} {t.last_name}</option>)}</select></label><label>Turno<select name="shift" defaultValue=""><option value="">Sin especificar</option><option>Mañana</option><option>Tarde</option><option>Noche</option></select></label></div>
    <label>Observaciones<textarea name="notes" rows={2}/></label>
    <label>Estado al finalizar<select name="follow_up_status" defaultValue="RESUELTA"><option value="RESUELTA">Resuelta · no requiere seguimiento</option><option value="PENDIENTE">Pendiente · revisar en el próximo turno</option></select></label>
    <section className="intervention-inventory-usage"><div className="intervention-inventory-heading"><span><b>Insumos y repuestos utilizados</b><small>Opcional · se descontarán del stock y quedarán asociados a esta intervención.</small></span><div className="inventory-usage-actions"><select aria-label="Filtrar por tipo de inventario" value={inventoryTypeFilter} onChange={event => setInventoryTypeFilter(event.target.value)}><option value="">Todos</option><option value="REPUESTO">Repuestos</option><option value="INSUMO">Insumos</option></select><button type="button" className="link-button" onClick={() => setInventoryUsage(rows => [...rows, { part_id: "", search: "", quantity: "1" }])}>＋ Agregar artículo</button></div></div>
      {inventoryUsage.map((usage, index) => {
        const selectedPart = parts.find((part: any) => String(part.id) === String(usage.part_id));
        const matches = inventoryMatches(usage.search, index);
        return <div className="intervention-inventory-row" key={index}><label className="intervention-inventory-picker">Artículo<div className="machine-search-picker"><input autoComplete="off" aria-label="Buscar insumo o repuesto" aria-expanded={activeInventoryPicker === index} placeholder="Buscar por código, nombre o categoría" value={usage.search} onFocus={() => setActiveInventoryPicker(index)} onBlur={() => window.setTimeout(() => setActiveInventoryPicker(current => current === index ? null : current), 120)} onChange={event => { const search = event.target.value; setInventoryUsage(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, search, part_id: "" } : row)); setActiveInventoryPicker(index); }} onKeyDown={event => { if (event.key === "Enter" && activeInventoryPicker === index && matches.length) { event.preventDefault(); selectInventoryPart(index, matches[0]); } if (event.key === "Escape") setActiveInventoryPicker(null); }}/>{activeInventoryPicker === index && <div className="machine-search-results">{matches.length ? matches.map((part: any) => <button type="button" key={part.id} disabled={part.stock < 1} onMouseDown={event => event.preventDefault()} onClick={() => selectInventoryPart(index, part)}><b>{part.code} · {part.name}</b><small>{part.inventory_type === "INSUMO" ? "Insumo" : "Repuesto"}{part.category ? ` · ${part.category}` : ""} · {part.stock > 0 ? `Disponible: ${part.stock}` : "Sin stock"}</small></button>) : <span className="machine-search-empty">No hay artículos que coincidan.</span>}</div>}</div>{selectedPart && <small className="inventory-use-available">Disponible: {selectedPart.stock} · {selectedPart.inventory_type === "INSUMO" ? "Insumo" : "Repuesto"}</small>}</label><label className="intervention-inventory-quantity">Cantidad<input type="number" min="1" step="1" max={selectedPart?.stock ?? undefined} value={usage.quantity} onChange={event => setInventoryUsage(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))}/></label><button type="button" className="inventory-use-remove" aria-label="Quitar artículo de la intervención" onClick={() => setInventoryUsage(rows => rows.filter((_, rowIndex) => rowIndex !== index))}>×</button></div>;
      })}
      {inventoryUsage.length === 0 && <p className="intervention-inventory-empty">Agrega los artículos consumidos o instalados durante el trabajo.</p>}
    </section>
    {error && <div className="error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar intervención"}</button></div>
  </form></div>;
}
const REPORT_FLEET_COLORS: Record<string, string> = { OPERATIVA: "#3ea877", OPERATIVA_CON_OBSERVACION: "#d6a62a", EN_MANTENIMIENTO: "#e27e2e", FUERA_DE_SERVICIO: "#d64f4b", PENDIENTE_DE_REPUESTO: "#448bc6", RETIRADA: "#818b9a" };
function reportFleetChartImage(items: any[]) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (!total) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 520; canvas.height = 520;
  const context = canvas.getContext("2d");
  if (!context) return "";
  let angle = -Math.PI / 2;
  for (const item of items.filter(item => item.count > 0)) {
    const end = angle + item.count / total * Math.PI * 2;
    context.beginPath(); context.moveTo(260, 260);
    context.arc(260, 260, 250, angle, end); context.closePath();
    context.fillStyle = REPORT_FLEET_COLORS[item.status] || "#818b9a"; context.fill();
    context.strokeStyle = "#ffffff"; context.lineWidth = 3; context.stroke();
    angle = end;
  }
  return canvas.toDataURL("image/png");
}

function DailyReportView({ token }: any) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [shift, setShift] = useState("");
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const q = new URLSearchParams({ report_date: date });
      if (shift) q.set("shift", shift);
      setReport(await api(`/reports/daily?${q}`, token));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const openEmail = async () => {
    if (!report) return;
    const reportDate = report.date;
    const reportShift = report.shift;
    const subject = `Bitácora diaria · ${reportDate.split("-").reverse().join("/")} · ${reportShift}`;
    const escapeHtml = (value: any) => String(value ?? "—").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]!));
    const formattedHandoffs = report.handoff_items || [];
    const handoffText = formattedHandoffs.map((item: any) => `Máquina ${item.machine || "—"} · ${item.task} · ${item.follow_up_status === "RECIBIDA" ? `Recibida por ${item.follow_up_by || "el turno entrante"}` : "Pendiente de recepción"}${item.follow_up_at ? ` · ${new Date(item.follow_up_at).toLocaleString("es-CL")}` : ""}${item.follow_up_note ? `\n   Nota: ${item.follow_up_note}` : item.detail ? `\n   Detalle: ${item.detail}` : ""}`).join("\n");
    const fleet = report.machine_fleet || { total: 0, operating: 0, operating_with_observation: 0, out_of_service: 0, in_maintenance: 0, waiting_parts: 0, retired: 0, worked_on: 0, by_status: [] };
    const fleetText = (fleet.by_status || []).map((item: any) => `${item.label}: ${item.count}`).join("\n");
    const plainBody = ["INFORME DIARIO DE ACTIVIDADES · GESTIÓN TÉCNICA", `Fecha: ${reportDate} · ${reportShift}`, `Pendientes: ${report.open_handoff_total ?? 0} · Recibidas: ${report.handoff_received_total ?? 0}`, "", `ESTADO ACTUAL DEL PARQUE (${fleet.total} máquinas) · ${fleet.worked_on} máquinas intervenidas en el período`, `Operativas: ${fleet.operating} · Con observación: ${fleet.operating_with_observation} · Fuera de servicio: ${fleet.out_of_service} · En mantenimiento: ${fleet.in_maintenance}`, fleetText || "Sin máquinas registradas.", "", `ACTIVIDADES PENDIENTES DEL DÍA (${report.open_handoff_total ?? 0}; recibidas: ${report.handoff_received_total ?? 0})`, handoffText || "No hay actividades pendientes para la fecha y turno seleccionados."].join("\n\n") || "Sin actividades registradas para esta fecha y turno.";
    const handoffRows = formattedHandoffs.map((item: any) => `<tr><td style="padding:10px;border-bottom:1px solid #e7edf4">${escapeHtml(item.machine ? `Máquina ${item.machine}` : "—")}</td><td style="padding:10px;border-bottom:1px solid #e7edf4">${escapeHtml(item.task)}</td><td style="padding:10px;border-bottom:1px solid #e7edf4">${escapeHtml(item.follow_up_status === "RECIBIDA" ? `Recibida por ${item.follow_up_by || "el turno entrante"}` : "Pendiente de recepción")}${item.follow_up_at ? `<div style="margin-top:4px;color:#69778a;font-size:11px">${escapeHtml(new Date(item.follow_up_at).toLocaleString("es-CL"))}</div>` : ""}</td><td style="padding:10px;border-bottom:1px solid #e7edf4">${escapeHtml(item.follow_up_note || item.detail || "—")}</td></tr>`).join("") || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#69778a">No hay actividades pendientes para la fecha y turno seleccionados.</td></tr>`;
    const fleetChart = reportFleetChartImage(fleet.by_status || []);
    const fleetRows = (fleet.by_status || []).map((item: any) => `<tr><td style="padding:9px 11px;border-bottom:1px solid #e7edf4">${escapeHtml(item.label)}</td><td style="padding:9px 11px;border-bottom:1px solid #e7edf4;text-align:right"><strong>${item.count}</strong></td></tr>`).join("") || `<tr><td colspan="2" style="padding:14px;text-align:center;color:#69778a">Sin máquinas registradas.</td></tr>`;
    const htmlBody = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#253247"><div style="max-width:1000px;margin:0 auto;background:#fff;border:1px solid #e3e9f0;border-radius:10px;overflow:hidden"><header style="padding:24px 28px;background:#18365e;color:#fff"><div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#c3d6f2">Gestión Técnica · Casino &amp; Resort</div><h1 style="margin:10px 0 5px;font-size:23px">Informe diario de actividades</h1><div style="font-size:13px;color:#dce7f5">${escapeHtml(reportDate.split("-").reverse().join("/"))} · ${escapeHtml(reportShift)}</div></header><main style="padding:24px 28px"><p style="margin:0 0 18px;font-size:14px;line-height:1.6">Estimados,<br>Compartimos el estado del parque y las tareas pendientes. Pendientes: ${report.open_handoff_total ?? 0}; recibidas por el turno entrante: ${report.handoff_received_total ?? 0}.</p><h2 style="margin:24px 0 5px;font-size:16px">Estado actual del parque</h2><p style="margin:0 0 10px;color:#69778a;font-size:12px">Fotografía al generar el informe · ${fleet.worked_on} máquinas intervenidas en el período</p><table role="presentation" style="width:100%;margin-bottom:14px;border-collapse:separate;border-spacing:6px 0"><tr><td style="padding:11px;background:#f3f6fa;border-radius:7px"><div style="font-size:10px;color:#69778a">TOTAL</div><strong style="display:block;margin-top:4px;font-size:20px">${fleet.total}</strong></td><td style="padding:11px;background:#eaf8f0;border-radius:7px"><div style="font-size:10px;color:#397b5a">OPERATIVAS</div><strong style="display:block;margin-top:4px;font-size:20px;color:#26764d">${fleet.operating}</strong></td><td style="padding:11px;background:#fff4e6;border-radius:7px"><div style="font-size:10px;color:#9b681e">FUERA DE SERVICIO</div><strong style="display:block;margin-top:4px;font-size:20px;color:#a76513">${fleet.out_of_service}</strong></td><td style="padding:11px;background:#eef4ff;border-radius:7px"><div style="font-size:10px;color:#4773c3">EN MANTENIMIENTO</div><strong style="display:block;margin-top:4px;font-size:20px;color:#4773c3">${fleet.in_maintenance}</strong></td></tr></table>${fleetChart ? `<img src="${fleetChart}" width="260" height="260" alt="Distribución de máquinas por estado" style="display:block;max-width:100%;height:auto;margin:16px auto"/>` : ""}<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#edf2f8;text-align:left"><th style="padding:9px 11px">Detalle por estado</th><th style="padding:9px 11px;text-align:right">Máquinas</th></tr></thead><tbody>${fleetRows}</tbody></table><h2 style="margin:24px 0 8px;font-size:16px">Actividades pendientes del día (${report.open_handoff_total ?? 0}; recibidas: ${report.handoff_received_total ?? 0})</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#edf2f8;text-align:left"><th style="padding:10px">Máquina</th><th style="padding:10px">Intervención</th><th style="padding:10px">Recepción</th><th style="padding:10px">Nota</th></tr></thead><tbody>${handoffRows}</tbody></table></div><p style="margin:22px 0 0;color:#69778a;font-size:13px">Saludos,<br><strong>Equipo de Gestión Técnica</strong></p></main><footer style="padding:13px 28px;background:#f7f9fc;border-top:1px solid #e7edf4;color:#8995a5;font-size:11px">Informe generado desde el sistema de Gestión Técnica.</footer></div></body></html>`;
    const recipients = (report.recipients || []).join(",");
    const cc = (report.cc || []).join(",");
    setError("");
    let copiedRich = false;
    // HTTP deployments may not expose the asynchronous Clipboard API.
    const copyFormattedFallback = () => {
      const previousFocus = document.activeElement as HTMLElement | null;
      const selection = window.getSelection();
      const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
      const copyTarget = document.createElement("textarea");
      copyTarget.value = plainBody;
      copyTarget.setAttribute("aria-label", "Informe para copiar");
      copyTarget.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      let wroteFormatted = false;
      const onCopy = (event: ClipboardEvent) => {
        if (!event.clipboardData) return;
        event.clipboardData.setData("text/html", htmlBody);
        event.clipboardData.setData("text/plain", plainBody);
        event.preventDefault();
        wroteFormatted = true;
      };
      document.body.appendChild(copyTarget);
      document.addEventListener("copy", onCopy);
      try {
        copyTarget.focus({ preventScroll: true });
        copyTarget.select();
        return document.execCommand("copy") && wroteFormatted;
      } catch {
        return false;
      } finally {
        document.removeEventListener("copy", onCopy);
        copyTarget.remove();
        previousFocus?.focus({ preventScroll: true });
        if (selection) {
          selection.removeAllRanges();
          ranges.forEach(range => selection.addRange(range));
        }
      }
    };
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([htmlBody], { type: "text/html" }), "text/plain": new Blob([plainBody], { type: "text/plain" }) })]);
        copiedRich = true;
      } catch {
        copiedRich = copyFormattedFallback();
      }
    } else {
      copiedRich = copyFormattedFallback();
    }
    if (!copiedRich) setError("El navegador no permitió copiar el informe con formato. El correo se abrirá con una versión de texto. Para habilitar la copia automática, accede mediante HTTPS y permite el acceso al portapapeles.");
    const mailBody = copiedRich ? "" : plainBody;
    window.location.href = `mailto:${encodeURIComponent(recipients)}?${cc ? `cc=${encodeURIComponent(cc)}&` : ""}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
    setMessage(copiedRich ? "Informe formal copiado con formato y tablas. En el correo abierto, pega el contenido en el cuerpo y revísalo antes de enviarlo." : "Se abrió el correo. Si el informe no quedó copiado, puedes revisar la versión de texto precargada antes de enviarlo.");
  };
  useEffect(() => { load(); }, []);
  const machineFleet = report?.machine_fleet;
  return <div className="report-page">
    <section className="report-toolbar panel">
      <div className="report-toolbar-copy"><span className="report-symbol">▤</span><div><b>Informe diario de actividades</b><small>Consulta, filtra y prepara el correo de la bitácora.</small></div></div>
      <div className="report-controls"><label>Fecha<input type="date" value={date} onChange={e => { setDate(e.target.value); setReport(null); setMessage(""); setError(""); }}/></label><label>Turno<select value={shift} onChange={e => { setShift(e.target.value); setReport(null); setMessage(""); setError(""); }}><option value="">Todos los turnos</option>{["Mañana", "Tarde", "Noche"].map(x => <option key={x}>{x}</option>)}</select></label><button className="secondary" onClick={load} disabled={busy}>{busy ? "Cargando…" : "↻ Actualizar"}</button><button className="primary" onClick={openEmail} disabled={!report || busy}>✉ Preparar correo</button></div>
    </section>
    {error && <div className="error report-error">{error}</div>}
    {message && <div className="success-message">{message}</div>}
    {report && <>

      <section className="panel report-fleet-panel"><PanelHeading title="Estado actual del parque" sub={`Fotografía al generar este informe · ${machineFleet?.total ?? 0} máquinas`} /><div className="report-fleet-chart"><div>{machineFleet?.total ? <img src={reportFleetChartImage(machineFleet.by_status || [])} width="260" height="260" alt={`Distribución del parque: ${(machineFleet.by_status || []).map((item:any)=>`${item.label}: ${item.count}`).join(", ")}`}/> : <Empty text="Sin máquinas registradas."/>}</div><div className="report-fleet-legend">{(machineFleet?.by_status || []).map((item:any)=><div key={item.status}><i style={{background:REPORT_FLEET_COLORS[item.status] || "#818b9a"}}/><span>{item.label}</span><b>{item.count}</b><small>{machineFleet.total ? (item.count / machineFleet.total * 100).toFixed(1) : "0"}%</small></div>)}</div></div></section>
      <section className="panel report-handoff-panel"><PanelHeading title="Actividades pendientes del día" sub={`${report.open_handoff_total ?? 0} seguimientos abiertos · ${report.handoff_received_total ?? 0} recibidos · solo la fecha y turno seleccionados`} />{report.handoff_items?.length ? <div className="table-wrap"><table className="report-web-table"><thead><tr><th>MÁQUINA</th><th>INTERVENCIÓN / DETALLE</th><th>ESTADO DE RECEPCIÓN</th><th>NOTA DEL TURNO</th></tr></thead><tbody>{report.handoff_items.map((item:any)=><tr key={item.id}><td><b>{item.machine ? `Máquina ${item.machine}` : "Sin máquina"}</b></td><td><b>{item.task}</b>{item.detail && <small className="cell-sub">{item.detail}</small>}</td><td><span className={`report-state ${item.follow_up_status === "RECIBIDA" ? "received" : "pending"}`}><i/>{item.follow_up_status === "RECIBIDA" ? `Recibida por ${item.follow_up_by || "el turno entrante"}` : "Pendiente de recepción"}</span>{item.follow_up_at && <small className="report-handoff-meta">{new Date(item.follow_up_at).toLocaleString("es-CL")}</small>}</td><td>{item.follow_up_note || "—"}</td></tr>)}</tbody></table></div> : <Empty text="No hay actividades pendientes para la fecha y turno seleccionados."/>}</section>
      <div className="report-email-note">Destinatarios sugeridos: <b>{report.recipients?.join(", ") || "puedes agregarlos al abrir tu gestor de correo"}</b>{report.cc?.length > 0 && <> · CC: <b>{report.cc.join(", ")}</b></>} <span>El informe se copia con formato HTML y tablas. Al abrir el correo, pégalo en el cuerpo y revísalo antes de enviarlo.</span></div>
    </>}
  </div>;
}
function TicketManageModal({ token, ticket, parts, technicians, onClose, onSaved }: any) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [ticketInventory, setTicketInventory] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [inventoryUsage, setInventoryUsage] = useState<any[]>([]);
  const [activeInventoryPicker, setActiveInventoryPicker] = useState<number | null>(null);
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState("");
  useEffect(() => {
    Promise.all([api(`/tickets/${ticket.id}/history`, token), api(`/tickets/${ticket.id}/comments`, token), api(`/tickets/${ticket.id}/inventory`, token)])
      .then(([updates, messages, movements]) => { setHistory(updates); setComments(messages); setTicketInventory(movements); })
      .catch(() => { setHistory([]); setComments([]); setTicketInventory([]); });
  }, [ticket.id, token]);
  const inventoryMatches = (term: string, index: number) => parts.filter((part: any) => {
    const usedElsewhere = inventoryUsage.some((use: any, useIndex: number) => useIndex !== index && String(use.part_id) === String(part.id));
    const searchText = `${part.code} ${part.name} ${part.category || ""} ${part.brand || ""} ${part.model || ""} ${part.inventory_type}`;
    const typeMatches = !inventoryTypeFilter || (part.inventory_type || "REPUESTO") === inventoryTypeFilter;
    return typeMatches && !usedElsewhere && (!term.trim() || normalizeSearch(searchText).includes(normalizeSearch(term)));
  }).slice(0, 20);
  const selectInventoryPart = (index: number, part: any) => {
    setInventoryUsage(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, part_id: String(part.id), search: `${part.code} · ${part.name}` } : row));
    setActiveInventoryPicker(null);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const data: any = Object.fromEntries(f.entries());
    const incompleteUse = inventoryUsage.find(row => !row.part_id || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1);
    if (incompleteUse) { setError("Selecciona un artículo y una cantidad válida, o elimina la línea vacía."); return; }
    const overStockUse = inventoryUsage.find(row => { const part = parts.find((item: any) => String(item.id) === String(row.part_id)); return !part || Number(row.quantity) > part.stock; });
    if (overStockUse) { setError("La cantidad seleccionada supera el stock disponible. Actualiza el inventario y vuelve a intentarlo."); return; }
    data.parts_used = inventoryUsage.map(row => ({ part_id: Number(row.part_id), quantity: Number(row.quantity) }));
    for (const key of ["technician", "shift", "result", "note"]) if (!data[key]) data[key] = null;
    setSaving(true);
    try { await api(`/tickets/${ticket.id}`, token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); onClose(); onSaved(); }
    catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };
  const sendComment = async () => {
    if (!draft.trim()) return;
    setCommentSaving(true); setError("");
    try {
      await api(`/tickets/${ticket.id}/comments`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) });
      setComments(await api(`/tickets/${ticket.id}/comments`, token)); setDraft("");
    } catch (x: any) { setError(x.message); } finally { setCommentSaving(false); }
  };
  const states = ["NUEVO", "ASIGNADO", "EN PROCESO", "PENDIENTE", "ESPERANDO REPUESTO", "ESPERANDO PROVEEDOR", "RESUELTO", "CERRADO", "CANCELADO"];
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><h2>Ticket #{ticket.id}</h2><p>{ticket.task} · {ticket.machine ? `Máquina ${ticket.machine}` : "Sin máquina"}</p>{ticket.requester && <p>Solicitante: {ticket.requester.name} · {ticket.requester.email}</p>}</div><button type="button" className="close" onClick={onClose}>×</button></div>
    <p className="ticket-sla-note">{ticket.sla_due_at ? <>SLA: <Badge value={ticket.sla_status}/> · {slaCountdown(ticket.sla_due_at)} · vence {new Date(ticket.sla_due_at).toLocaleString("es-CL")}</> : "Ticket histórico: no tiene un SLA asignado retroactivamente."}</p>
    <div className="form-row"><label>Estado<select name="status" defaultValue={ticket.status}>{states.map(s => <option key={s}>{s}</option>)}</select></label><label>Prioridad<select name="priority" defaultValue={ticket.priority}>{["BAJA", "NORMAL", "ALTA", "CRÍTICA"].map(s => <option key={s}>{s}</option>)}</select></label></div>
    <div className="form-row"><label>Asignar técnico<select name="technician" defaultValue={ticket.technician || ""}><option value="">Sin asignar</option>{ticket.technician && !technicians.some((t: any) => t.status !== "INACTIVO" && `${t.first_name} ${t.last_name}` === ticket.technician) && <option value={ticket.technician} disabled>{ticket.technician} · Asignación anterior</option>}{technicians.filter((t: any) => t.status !== "INACTIVO").map((t: any) => <option key={`${t.id}-${t.first_name}`}>{t.first_name} {t.last_name}</option>)}</select></label><label>Turno<input name="shift" defaultValue={ticket.shift || ""} placeholder="Mañana, tarde o noche"/></label></div>
    <label>Resultado / actualización<textarea name="result" rows={2} defaultValue={ticket.result || ""}/></label>
    <label>Nota del cambio<textarea name="note" rows={2} placeholder="Motivo del cambio de estado o actualización"/></label>
    <section className="ticket-inventory-usage">{ticketInventory.length > 0 && <div className="ticket-inventory-history"><b>Consumos ya registrados para este ticket</b>{ticketInventory.map((movement: any) => <div key={movement.id}><span><strong>{movement.code} · {movement.name}</strong><small>{movement.inventory_type === "INSUMO" ? "Insumo" : "Repuesto"} · {movement.technician || "Equipo técnico"} · {new Date(movement.at).toLocaleString("es-CL")}</small></span><b>−{movement.quantity} · saldo {movement.stock_after}</b></div>)}</div>}<div className="intervention-inventory-heading"><span><b>Repuestos e insumos utilizados</b><small>Registra lo consumido para resolver o revisar este ticket. El stock se rebajará al guardar los cambios.</small></span><div className="inventory-usage-actions"><select aria-label="Filtrar por tipo de inventario" value={inventoryTypeFilter} onChange={event => setInventoryTypeFilter(event.target.value)}><option value="">Todos</option><option value="REPUESTO">Repuestos</option><option value="INSUMO">Insumos</option></select><button type="button" className="link-button" onClick={() => setInventoryUsage(rows => [...rows, { part_id: "", search: "", quantity: "1" }])}>＋ Agregar artículo</button></div></div>
      {inventoryUsage.map((usage, index) => {
        const selectedPart = parts.find((part: any) => String(part.id) === String(usage.part_id));
        const matches = inventoryMatches(usage.search, index);
        return <div className="intervention-inventory-row" key={index}><label className="intervention-inventory-picker">Artículo<div className="machine-search-picker"><input autoComplete="off" aria-label="Buscar insumo o repuesto para el ticket" aria-expanded={activeInventoryPicker === index} placeholder="Buscar por código, nombre o categoría" value={usage.search} onFocus={() => setActiveInventoryPicker(index)} onBlur={() => window.setTimeout(() => setActiveInventoryPicker(current => current === index ? null : current), 120)} onChange={event => { const search = event.target.value; setInventoryUsage(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, search, part_id: "" } : row)); setActiveInventoryPicker(index); }} onKeyDown={event => { if (event.key === "Enter" && activeInventoryPicker === index && matches.length) { event.preventDefault(); selectInventoryPart(index, matches[0]); } if (event.key === "Escape") setActiveInventoryPicker(null); }}/>{activeInventoryPicker === index && <div className="machine-search-results">{matches.length ? matches.map((part: any) => <button type="button" key={part.id} disabled={part.stock < 1} onMouseDown={event => event.preventDefault()} onClick={() => selectInventoryPart(index, part)}><b>{part.code} · {part.name}</b><small>{part.inventory_type === "INSUMO" ? "Insumo" : "Repuesto"}{part.category ? ` · ${part.category}` : ""} · {part.stock > 0 ? `Disponible: ${part.stock}` : "Sin stock"}</small></button>) : <span className="machine-search-empty">No hay artículos que coincidan.</span>}</div>}</div>{selectedPart && <small className="inventory-use-available">Disponible: {selectedPart.stock} · {selectedPart.inventory_type === "INSUMO" ? "Insumo" : "Repuesto"}</small>}</label><label className="intervention-inventory-quantity">Cantidad<input type="number" min="1" step="1" max={selectedPart?.stock ?? undefined} value={usage.quantity} onChange={event => setInventoryUsage(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))}/></label><button type="button" className="inventory-use-remove" aria-label="Quitar artículo del ticket" onClick={() => setInventoryUsage(rows => rows.filter((_, rowIndex) => rowIndex !== index))}>×</button></div>;
      })}
      {inventoryUsage.length === 0 && <p className="intervention-inventory-empty">Agrega los artículos que se descontarán por este ticket.</p>}
    </section>
    {ticket.attachments?.length > 0 && <TicketAttachments token={token} ticketId={ticket.id} attachments={ticket.attachments}/>}
    {history.length > 0 && <div className="ticket-timeline"><b>Historial de estados</b>{history.map((h: any, i: number) => <div key={i}><span>{new Date(h.at).toLocaleString("es-CL")}</span><strong>{h.old_status || "Creado"} → {h.new_status}</strong><small>{h.note || "Cambio de estado"}</small></div>)}</div>}
    <div className="conversation-block"><b>Conversación con el solicitante</b>{comments.map(message => <div className="conversation-message" key={message.id}><div><b>{message.author} · {message.author_role}</b><span>{new Date(message.at).toLocaleString("es-CL")}</span></div><p>{message.body}</p></div>)}<label>Responder<textarea rows={2} maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escribe un mensaje para el solicitante…"/></label><button type="button" className="secondary" disabled={commentSaving || !draft.trim()} onClick={sendComment}>{commentSaving ? "Enviando…" : "Enviar mensaje"}</button></div>
    {error && <div className="error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cerrar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
  </form></div>;
}

function InterventionDetailModal({ token, intervention, canFollowUp, onClose, onSaved }: any) {
  const [savingFollowUp, setSavingFollowUp] = useState(false); const [followUpError, setFollowUpError] = useState("");
  const markResolved = async () => {
    const note = window.prompt("Nota de cierre para dejar al siguiente turno", "Intervención revisada y resuelta");
    if (note === null) return;
    setSavingFollowUp(true); setFollowUpError("");
    try { await api(`/interventions/${intervention.id}/follow-ups`, token, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:"RESUELTA", note})}); onSaved?.(); }
    catch (e:any) { setFollowUpError(e.message); }
    finally { setSavingFollowUp(false); }
  };
  const markReceived = async () => {
    const note = window.prompt("Nota para confirmar la recepción del turno", "Recibido por el turno entrante");
    if (note === null) return;
    setSavingFollowUp(true); setFollowUpError("");
    try { await api(`/interventions/${intervention.id}/follow-ups`, token, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:"RECIBIDA", note})}); onSaved?.(); }
    catch (e:any) { setFollowUpError(e.message); }
    finally { setSavingFollowUp(false); }
  };
  const rows = [
    ["Fecha", intervention.occurred_at ? new Date(intervention.occurred_at).toLocaleString("es-CL") : "—"],
    ["Máquina", intervention.machine ? `Máquina ${intervention.machine}` : "—"],
    ["Ubicación", [intervention.area, intervention.island && `Isla ${intervention.island}`].filter(Boolean).join(" · ") || "—"],
    ["Técnico", intervention.technician || "—"],
    ["Turno", intervention.shift || "—"],
    ["Tipo de trabajo", intervention.work_type || "—"],
    ["Ticket", intervention.ticket_id ? `#${intervention.ticket_id}` : "—"],
    ["Seguimiento", intervention.pending ? "Pendiente · requiere revisión" : "Resuelta"],
    ...(intervention.follow_up_status === "RECIBIDA" ? [["Recibida por", `${intervention.follow_up_by || "El equipo"}${intervention.follow_up_at ? ` · ${new Date(intervention.follow_up_at).toLocaleString("es-CL")}` : ""}`]] : []),
  ];
  return <div className="modal-shade" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal intervention-detail-modal"><div className="modal-head"><div><h2>{intervention.task || intervention.work_type || `Intervención #${intervention.id}`}</h2><p>Registro de bitácora #{intervention.id}</p></div><button className="close" onClick={onClose}>×</button></div><div className="intervention-detail-grid">{rows.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>{intervention.detail && <div className="intervention-detail-text"><small>Detalle del trabajo</small><p>{intervention.detail}</p></div>}{intervention.follow_up_note && <div className="intervention-detail-text"><small>Última nota de seguimiento</small><p>{intervention.follow_up_note}</p></div>}{intervention.notes && <div className="intervention-detail-text"><small>Notas iniciales</small><p>{intervention.notes}</p></div>}{followUpError && <div className="error">{followUpError}</div>}<div className="modal-actions"><button className="secondary" onClick={onClose}>Cerrar</button>{canFollowUp && intervention.pending && <button className="secondary" disabled={savingFollowUp} onClick={markReceived}>{savingFollowUp ? "Guardando…" : intervention.follow_up_status === "RECIBIDA" ? "Confirmar recepción de turno" : "✓ Recibir pendiente"}</button>}{canFollowUp && intervention.pending && <button className="primary" disabled={savingFollowUp} onClick={markResolved}>{savingFollowUp ? "Guardando…" : "Marcar como resuelta"}</button>}</div></section></div>;
}

function TicketAttachments({ token, ticketId, attachments }: any) {
  const [images, setImages] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    Promise.all(attachments.map(async (attachment: any) => {
      const response = await fetch(`/api/tickets/${ticketId}/attachments/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("No se pudieron cargar las imágenes adjuntas.");
      const url = URL.createObjectURL(await response.blob());
      urls.push(url);
      return { ...attachment, url };
    })).then(result => { if (active) setImages(result); }).catch(() => { if (active) setImages([]); });
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, [token, ticketId, attachments]);
  return <div className="ticket-attachments"><b>Imágenes adjuntas</b><div>{images.map(image => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" title={image.filename}><img src={image.url} alt={image.filename}/><small>{image.filename}</small></a>)}</div><small>Se eliminan automáticamente 7 días después del cierre del ticket.</small></div>;
}

function TicketStatusModal({ token, ticketId, onClose, onSaved }: any) {
  const [ticket, setTicket] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const states = ["NUEVO", "ASIGNADO", "EN PROCESO", "PENDIENTE", "ESPERANDO REPUESTO", "ESPERANDO PROVEEDOR", "RESUELTO", "CERRADO", "CANCELADO"];
  useEffect(() => {
    api(`/tickets/${ticketId}`, token).then(data => { setTicket(data); setStatus(data.status); setResult(data.result || ""); }).catch((e: any) => setError(e.message));
  }, [ticketId, token]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await api(`/tickets/${ticketId}`, token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, result: result.trim() || null, note: note.trim() || null }) });
      onClose(); onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><h2>Actualizar ticket #{ticketId}</h2><p>{ticket ? ticket.task : "Cargando ticket…"}{ticket ? ` · Estado actual: ${ticket.status}` : ""}</p></div><button type="button" className="close" onClick={onClose}>×</button></div>
    {ticket && <p className="ticket-sla-note">{ticket.sla_due_at ? <>SLA: <Badge value={ticket.sla_status}/> · {slaCountdown(ticket.sla_due_at)} · vence {new Date(ticket.sla_due_at).toLocaleString("es-CL")}</> : "Ticket histórico: sin SLA retroactivo."}</p>}
    <label>Nuevo estado<select value={status} onChange={e => setStatus(e.target.value)} required>{states.map(value => <option key={value}>{value}</option>)}</select></label>
    {(status === "RESUELTO" || status === "CERRADO") && <label>Solución o causa de cierre<textarea value={result} onChange={e => setResult(e.target.value)} rows={3} maxLength={4000} required placeholder="Describe qué se hizo o por qué se cierra la solicitud"/></label>}
    <label>Nota del cambio<textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={4000} placeholder="Motivo o detalle del cambio de estado"/></label>
    {error && <div className="error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving || !ticket}>{saving ? "Guardando…" : "Actualizar estado"}</button></div>
  </form></div>;
}
function TechnicianModal({ token, technician, onClose, onSaved }: any) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const data = Object.fromEntries(f.entries());
    for (const key of Object.keys(data)) if (data[key as keyof typeof data] === "") data[key as keyof typeof data] = null as any;
    if (data.contracted_hours) data.contracted_hours = Number(data.contracted_hours) as any;
    setSaving(true);
    try { await api(technician ? `/technicians/${technician.id}` : "/technicians", token, { method: technician ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); onSaved(); }
    catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>{technician ? "Editar técnico" : "Nuevo técnico"}</h2><p>{technician ? "Actualiza sus datos y disponibilidad." : "Agrega una persona al catálogo técnico."}</p></div><button type="button" className="close" onClick={onClose}>×</button></div><div className="form-row"><label>Nombre<input name="first_name" required maxLength={80} defaultValue={technician?.first_name}/></label><label>Apellido<input name="last_name" required maxLength={80} defaultValue={technician?.last_name}/></label></div><div className="form-row"><label>Cargo<input name="position" maxLength={80} placeholder="Opcional" defaultValue={technician?.position || ""}/></label><label>Usuario<input name="username" maxLength={50} placeholder="Opcional" defaultValue={technician?.username || ""}/></label></div><div className="form-row"><label>Disponibilidad<select name="status" defaultValue={technician?.status || "ACTIVO"}><option>ACTIVO</option><option>INACTIVO</option><option>LICENCIA</option><option>VACACIONES</option></select></label><label>Turno<select name="shift" defaultValue={technician?.shift || ""}><option value="">Sin especificar</option><option>Mañana</option><option>Tarde</option><option>Noche</option></select></label></div><div className="form-row"><label>Horas contratadas<input name="contracted_hours" type="number" min="0" placeholder="Opcional" defaultValue={technician?.contracted_hours ?? ""}/></label><label>Fecha de ingreso<input name="hire_date" type="date" defaultValue={technician?.hire_date || ""}/></label></div><label>Especialidades<input name="specialties" placeholder="Ej. Slots, redes, audiovisual" defaultValue={technician?.specialties || ""}/></label><label>Observaciones<textarea name="notes" rows={2} defaultValue={technician?.notes || ""}/></label>{error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : technician ? "Guardar cambios" : "Guardar técnico"}</button></div></form></div>;
}
function PartModal({ token, inventoryType = "REPUESTO", brands = [], onClose, onSaved }: any) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const data: any = Object.fromEntries(f.entries());
    for (const key of Object.keys(data)) if (data[key] === "") data[key] = null;
    for (const key of ["initial_stock", "minimum_stock", "unit_cost"]) if (data[key] !== null) data[key] = Number(data[key]);
    if (inventoryType !== "INSUMO") { data.brand = String(data.brand || "").trim(); if (!data.brand) { setError("La marca es obligatoria para los repuestos."); return; } }
    data.inventory_type = inventoryType;
    setSaving(true); try { await api("/parts", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); onClose(); onSaved(); }
    catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>{inventoryType === "INSUMO" ? "Nuevo insumo" : "Nuevo repuesto"}</h2><p>{inventoryType === "INSUMO" ? "Registra un artículo de consumo en la bodega." : "Registra un artículo de repuesto."}</p></div><button type="button" className="close" onClick={onClose}>×</button></div><div className="form-row"><label>Código<input name="code" required maxLength={50}/></label><label>Nombre<input name="name" required maxLength={160}/></label></div><div className="form-row"><label>Categoría<input name="category" placeholder="Opcional"/></label><label>{inventoryType === "INSUMO" ? "Marca" : "Marca (obligatoria)"}<input name="brand" list={inventoryType === "INSUMO" ? undefined : "machine-manufacturer-brands"} required={inventoryType !== "INSUMO"} maxLength={100} placeholder={inventoryType === "INSUMO" ? "Opcional" : "Selecciona o escribe una marca"}/>{inventoryType !== "INSUMO" && <datalist id="machine-manufacturer-brands">{brands.map((brand: string) => <option key={brand} value={brand}/>)}</datalist>}</label></div><div className="form-row"><label>Modelo<input name="model" placeholder="Opcional"/></label><label>Proveedor<input name="supplier" placeholder="Opcional"/></label></div><div className="form-row"><label>Stock inicial<input name="initial_stock" type="number" min="0" defaultValue="0" required/></label><label>Stock mínimo<input name="minimum_stock" type="number" min="0" defaultValue="0" required/></label></div><div className="form-row"><label>Ubicación<input name="location" placeholder="Opcional"/></label><label>Costo unitario (CLP)<input name="unit_cost" type="number" min="0" step="0.01" placeholder="Opcional"/></label></div>{error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : inventoryType === "INSUMO" ? "Guardar insumo" : "Guardar repuesto"}</button></div></form></div>;
}

function PartImportModal({ token, inventoryType, onClose, onSaved }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSupply = inventoryType === "INSUMO";
  const label = isSupply ? "insumos" : "repuestos";
  const template = isSupply ? "/plantillas/inventario-insumos.csv" : "/plantillas/inventario-repuestos.csv";
  const upload = async (commit: boolean) => {
    if (!file) { setError("Selecciona un archivo CSV para continuar."); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("inventory_type", inventoryType);
    form.append("preview", String(!commit));
    setBusy(true); setError("");
    try {
      const data = await api("/parts/import", token, { method: "POST", body: form });
      if (commit) { setResult(data); setPreview(null); onSaved(); }
      else { setPreview(data); setResult(null); }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal inventory-import-modal"><div className="modal-head"><div><h2>Carga masiva de {label}</h2><p>Revisa el archivo antes de registrar artículos en el inventario.</p></div><button type="button" className="close" onClick={onClose}>×</button></div>
    <div className="inventory-import-instructions"><b>Usa la plantilla CSV de ejemplo</b><p>El código y el nombre son obligatorios. Los códigos existentes se omiten; no se modifican sus existencias ni historial. El stock inicial de artículos nuevos queda registrado como una entrada.</p><a className="link-button inventory-template-link" href={template} download>Descargar ejemplo para {label} ↓</a><small>Separador punto y coma · UTF-8 · máximo 1.000 filas y 5 MB.</small></div>
    <label className="inventory-file-label">Archivo CSV<input type="file" accept=".csv,text/csv" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); setError(""); }}/></label>
    {file && <div className="inventory-selected-file">Archivo seleccionado: <b>{file.name}</b> · {(file.size / 1024).toFixed(1)} KB</div>}
    {error && <div className="error">{error}</div>}
    {preview && <div className="inventory-import-preview"><div className="inventory-import-counts"><span>Filas leídas <b>{preview.total_rows}</b></span><span>Nuevas válidas <b>{preview.valid_count}</b></span><span>Códigos existentes <b>{preview.skipped_count}</b></span><span>Con errores <b>{preview.error_count}</b></span></div>
      {preview.sample?.length > 0 && <div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOMBRE</th><th>CATEGORÍA</th><th>STOCK INICIAL</th><th>MÍNIMO</th></tr></thead><tbody>{preview.sample.map((row: any) => <tr key={row.code}><td>{row.code}</td><td>{row.name}</td><td>{row.category || "—"}</td><td>{row.initial_stock}</td><td>{row.minimum_stock}</td></tr>)}</tbody></table></div>}
      {preview.skipped_count > 0 && <div className="inventory-import-notes"><b>Códigos que se omitirán:</b> {preview.skipped.map((row: any) => `${row.code} (fila ${row.row})`).join(" · ")}{preview.skipped_count > preview.skipped.length ? " · y otros" : ""}</div>}
      {preview.error_count > 0 && <div className="inventory-import-errors"><b>Filas que requieren corrección:</b>{preview.errors.map((row: any) => <div key={`${row.row}-${row.code}`}>Fila {row.row}{row.code ? ` · ${row.code}` : ""}: {row.reason}</div>)}{preview.error_count > preview.errors.length && <small>Se muestran los primeros {preview.errors.length} errores.</small>}</div>}
    </div>}
    {result && <div className="inventory-import-success"><b>Carga terminada</b><span>{result.created_count} {label} nuevos registrados.</span><small>{result.skipped_count} códigos existentes omitidos · {result.error_count} filas con errores.</small></div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{result ? "Cerrar" : "Cancelar"}</button>{!result && <>{!preview ? <button type="button" className="primary" disabled={!file || busy} onClick={() => upload(false)}>{busy ? "Revisando…" : "Revisar archivo"}</button> : <button type="button" className="primary" disabled={!preview.valid_count || busy} onClick={() => upload(true)}>{busy ? "Cargando…" : `Cargar ${preview.valid_count} artículos`}</button>}</>}</div>
  </div></div>;
}

function FloorPlanView({ token, machines, profile, onStatus, onSaved }: any) {
  const [plan,setPlan]=useState<any>(null); const [imageUrl,setImageUrl]=useState(""); const imageUrlRef=useRef(""); const viewportRef=useRef<HTMLDivElement>(null); const markerRefs=useRef<Record<string,HTMLButtonElement|null>>({}); const panRef=useRef<any>(null); const [panning,setPanning]=useState(false); const [focusTarget,setFocusTarget]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(true); const [uploading,setUploading]=useState(false); const [search,setSearch]=useState(""); const [status,setStatus]=useState(""); const [island,setIsland]=useState(""); const [zoom,setZoom]=useState(100); const [placing,setPlacing]=useState(""); const [selected,setSelected]=useState<any>(null); const canUpload=["ADMIN","JEFE"].includes(profile.role);
  const refreshPlan=async()=>{setLoading(true);setError("");try{const metadata=await api("/floorplan",token);const response=await fetch("/api/floorplan/image",{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error("No se pudo cargar la imagen del plano");const blob=await response.blob();const url=URL.createObjectURL(blob);if(imageUrlRef.current)URL.revokeObjectURL(imageUrlRef.current);imageUrlRef.current=url;setImageUrl(url);setPlan(metadata)}catch(e:any){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{refreshPlan();return()=>{if(imageUrlRef.current)URL.revokeObjectURL(imageUrlRef.current)}},[token]);
  const islands=[...new Set(machines.map((m:any)=>m.island).filter(Boolean))] as string[];
  const visible=machines.filter((m:any)=>(!search||`${m.number} ${m.manufacturer||""} ${m.model||""} ${m.island||""}`.toLowerCase().includes(search.toLowerCase()))&&(!status||m.status===status)&&(!island||String(m.island)===island));
  const positioned=visible.filter((machine:any)=>machine.position_x!=null&&machine.position_y!=null);
  const canPlace=["ADMIN","JEFE","SUPERVISOR","TECNICO"].includes(profile.role);
  const focusMachine=(machine:any)=>{setSelected(machine);setPlacing("");if(machine.position_x==null||machine.position_y==null){setError(`La máquina ${machine.number} aún no tiene una ubicación en el plano.`);return}setError("");setZoom(180);setFocusTarget(machine.number)};
  useEffect(()=>{if(!focusTarget)return;const timer=window.setTimeout(()=>{const marker=markerRefs.current[focusTarget];const viewport=viewportRef.current;if(marker&&viewport){const target=marker.getBoundingClientRect();const area=viewport.getBoundingClientRect();viewport.scrollTo({left:viewport.scrollLeft+target.left-area.left-(area.width-target.width)/2,top:viewport.scrollTop+target.top-area.top-(area.height-target.height)/2,behavior:"smooth"})}setFocusTarget("")},240);return()=>window.clearTimeout(timer)},[focusTarget,zoom,visible.length]);
  useEffect(()=>{const term=search.trim().toLowerCase();if(!term)return;const exact=machines.find((machine:any)=>String(machine.number).toLowerCase()===term);if(exact)focusMachine(exact)},[search]);
  const startPan=(e:any)=>{if(placing||e.button!==0||(e.target as HTMLElement).closest(".floorplan-marker"))return;const viewport=e.currentTarget;panRef.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);setPanning(true);e.preventDefault()};
  const movePan=(e:any)=>{const pan=panRef.current;if(!pan||pan.pointerId!==e.pointerId)return;const viewport=e.currentTarget;viewport.scrollLeft=pan.left-(e.clientX-pan.x);viewport.scrollTop=pan.top-(e.clientY-pan.y)};
  const stopPan=(e:any)=>{if(panRef.current?.pointerId===e.pointerId)panRef.current=null;setPanning(false)};
  const place=async(e:any)=>{if(!placing||!canPlace||!imageUrl||loading)return;const rect=e.currentTarget.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));try{await api(`/machines/${encodeURIComponent(placing)}/position`,token,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({x,y})});setPlacing("");setError("");await onSaved();}catch(err:any){setError(err.message)}};
  const upload=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const file=(new FormData(form).get("file")) as File;if(!file)return;setUploading(true);setError("");try{const data=new FormData();data.append("file",file);await api("/floorplan",token,{method:"POST",body:data});form.reset();setPlacing("");await refreshPlan()}catch(err:any){setError(err.message)}finally{setUploading(false)}};
  const download=async()=>{try{const response=await fetch("/api/floorplan/file",{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error("No se pudo descargar el PDF");const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=plan?.filename||"plano-sala.pdf";anchor.click();URL.revokeObjectURL(url)}catch(e:any){setError(e.message)}};
  return <div className="floorplan-page"><section className="panel floorplan-panel">
    {error&&<div className="error floorplan-error">{error}</div>}
    <div className="floorplan-filter floorplan-top-search"><div className="floorplan-search-result"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const match=visible.find((m:any)=>String(m.number).toLowerCase()===search.trim().toLowerCase())||visible[0];if(match)focusMachine(match)}}} placeholder="Buscar máquina o isla · Enter para acercar"/>{selected&&<article className="floorplan-selected"><div><b>Máquina {selected.number}</b><Badge value={STATES[selected.status]||selected.status}/></div><small>{selected.manufacturer||"Fabricante desconocido"}{selected.model?` · ${selected.model}`:""}</small><small>{selected.area||"Sin área"}{selected.island?` · Isla ${selected.island}`:""}</small><div>{canPlace&&<button className="link-button" disabled={!imageUrl||loading} onClick={()=>{setPlacing(selected.number);setSelected(null);setError("")}}>{selected.position_x==null||selected.position_y==null?"Ubicar en plano":"Mover en plano"}</button>}{canPlace&&<button className="link-button" onClick={()=>onStatus(selected)}>Cambiar estado</button>}</div></article>}</div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos los estados</option>{Object.entries(STATES).map(([s,label])=><option key={s} value={s}>{label}</option>)}</select><select value={island} onChange={e=>setIsland(e.target.value)}><option value="">Todas las islas</option>{islands.map(n=><option key={n}>{n}</option>)}</select></div><div className="floorplan-tools">{placing&&<div className="floorplan-placement-note" role="status">Máquina {placing}: pulsa en el plano para guardar su ubicación. <button type="button" className="link-button" onClick={()=>setPlacing("")}>Cancelar</button></div>}<label className="zoom-control">Zoom<input type="range" min="70" max="250" step="10" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><b>{zoom}%</b></label><button className="link-button floorplan-download" type="button" disabled={!plan||loading} onClick={download}>Descargar PDF</button></div>
    <div className="floorplan-map-layout"><div ref={viewportRef} className={`floorplan-viewport ${placing?"placing":""} ${panning?"panning":""}`} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}><div className="floorplan-stage" style={{width:`${zoom}%`}} onClick={place}>{loading?<div className="floorplan-loading">Cargando plano…</div>:imageUrl?<img src={imageUrl} alt="Plano de la sala de juegos" draggable={false}/>:<Empty text="El plano no está disponible."/>}{positioned.map((m:any)=><button type="button" key={m.number} className={`floorplan-marker ${STATUS_CLASS[m.status]||"gray"} ${selected?.number===m.number?"selected":""}`} ref={el=>{markerRefs.current[m.number]=el}} style={{left:`${m.position_x*100}%`,top:`${m.position_y*100}%`}} title={`Máquina ${m.number} · ${STATES[m.status]||m.status}`} onClick={e=>{e.stopPropagation();focusMachine(m)}}>{m.number}</button>)}</div></div>
</div>
    {canUpload&&<form className="floorplan-upload" onSubmit={upload}><label className="secondary floorplan-file">Seleccionar plano PDF<input name="file" type="file" accept="application/pdf,.pdf" required/></label><span>Se muestra la primera página. Las posiciones actuales se conservan; puedes reubicar equipos luego.</span><button className="primary" disabled={uploading}>{uploading?"Procesando plano…":"Subir plano actualizado"}</button></form>}
  </section></div>;
}
function MovementModal({ token, part, tickets, machines, technicians, onClose, onSaved }: any) {
  const [error, setError] = useState(""); const [history, setHistory] = useState<any[]>([]); const [saving, setSaving] = useState(false);
  useEffect(() => { api(`/parts/${part.id}/movements`, token).then(setHistory).catch((e: any) => setError(e.message)); }, [part.id, token]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const data: any = Object.fromEntries(f.entries());
    data.quantity = Number(data.quantity); if (!data.ticket_id) data.ticket_id = null; else data.ticket_id = Number(data.ticket_id);
    if (!data.machine) data.machine = null; if (!data.technician) data.technician = null; if (!data.notes) data.notes = null;
    setSaving(true); try { await api(`/parts/${part.id}/movements`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); onSaved(); onClose(); }
    catch (x: any) { setError(x.message); } finally { setSaving(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><h2>{part.name}</h2><p>{part.code} · {part.inventory_type === "INSUMO" ? "Existencia" : "Stock"} actual: {part.stock}</p></div><button type="button" className="close" onClick={onClose}>×</button></div><form onSubmit={submit} className="movement-form"><div className="form-row"><label>Movimiento<select name="movement_type"><option>ENTRADA</option><option>SALIDA</option><option>CONSUMO</option><option>AJUSTE</option></select></label><label>Cantidad<input name="quantity" type="number" required defaultValue="1"/><small className="helper">En ajuste, usa un valor negativo para descontar.</small></label></div><div className="form-row"><label>Ticket relacionado<select name="ticket_id" defaultValue=""><option value="">Sin ticket</option>{tickets.map((t: any) => <option key={t.id} value={t.id}>#{t.id} · {t.task}</option>)}</select></label><label>Máquina<select name="machine" defaultValue=""><option value="">Sin máquina</option>{machines.map((m: any) => <option key={m.number}>{m.number}</option>)}</select></label></div><label>Técnico<select name="technician" defaultValue=""><option value="">Sin asignar</option>{technicians.filter((t: any) => t.status !== "INACTIVO").map((t: any) => <option key={t.id}>{t.first_name} {t.last_name}</option>)}</select></label><label>{part.inventory_type === "INSUMO" ? "Motivo / destino del movimiento" : "Observación"}<textarea name="notes" rows={2} required={part.inventory_type === "INSUMO"} placeholder={part.inventory_type === "INSUMO" ? "Ej. entrega a mantención, reposición de bodega o ajuste de inventario" : "Opcional"}/></label>{error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cerrar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Registrar movimiento"}</button></div></form><div className="movement-history"><b>{part.inventory_type === "INSUMO" ? "Historial de bodega" : "Movimientos recientes"}</b>{history.length ? history.slice(0, 5).map((h: any) => <div key={h.id}><span>{new Date(h.at).toLocaleString("es-CL")}</span><strong>{h.movement_type} {h.quantity > 0 ? "+" : ""}{h.quantity}</strong><small>Saldo: {h.stock_after}{h.ticket_id ? ` · Ticket #${h.ticket_id}` : ""}{h.machine ? ` · Máquina ${h.machine}` : ""}</small></div>) : <small>Sin movimientos registrados.</small>}</div></div></div>;
}
function MachineImportModal({ token, onClose, onSaved }: any) {
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({ number: null, island: null, area: null, manufacturer: null, model: null, serial: null });
  const [result, setResult] = useState<any>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const fields = [["number", "Número de máquina", true], ["island", "Isla", false], ["area", "Área / sector", false], ["manufacturer", "Fabricante", false], ["model", "Modelo", false], ["serial", "Número de serie", false]] as const;
  const makeForm = () => { const form = new FormData(); if (file) form.append("file", file); return form; };
  const getPreview = async () => {
    if (!file) return; setError(""); setBusy(true);
    try { const form = makeForm(); const data = await api("/machines/import/preview", token, { method: "POST", body: form }); setPreview(data); setMapping({ number: null, island: null, area: null, manufacturer: null, model: null, serial: null, ...data.suggested_mapping }); setResult(null); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (mapping.number == null) { setError("Selecciona la columna del número de máquina."); return; }
    setError(""); setBusy(true);
    try { const form = makeForm(); form.append("column_map", JSON.stringify(mapping)); const data = await api("/machines/import", token, { method: "POST", body: form }); setResult(data); onSaved(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal import-modal"><div className="modal-head"><div><h2>Carga masiva de máquinas</h2><p>Archivo Excel · Hoja Anexo 3B · encabezados desde la fila 10</p></div><button type="button" className="close" onClick={onClose}>×</button></div>
    <label>Archivo Excel<input type="file" accept=".xls,.xlsx,.xlsm" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); setError(""); }}/></label>
    {!preview && <div className="import-note">Se localizará la hoja “Anexo 3B- Listado de maquinas”. Primero verás una previsualización; ninguna máquina se guardará hasta confirmar.</div>}
    {preview && !result && <><div className="import-summary"><span>Hoja <b>{preview.sheet}</b></span><span>Encabezados fila <b>{preview.header_row}</b></span><span>Filas con datos <b>{preview.total_rows}</b></span></div><h3>Relaciona las columnas</h3><div className="column-map">{fields.map(([key, label, required]) => <label key={key}>{label}{required && <i> requerido</i>}<select value={mapping[key] ?? ""} onChange={e => setMapping({ ...mapping, [key]: e.target.value === "" ? null : Number(e.target.value) })}><option value="">No importar</option>{preview.columns.map((c: any) => <option key={c.index} value={c.index}>{c.label}</option>)}</select></label>)}</div><h3>Previsualización</h3><div className="table-wrap import-table"><table><thead><tr><th>FILA</th>{preview.columns.map((c: any) => <th key={c.index}>{c.label}</th>)}</tr></thead><tbody>{preview.preview.slice(0, 6).map((row: any) => <tr key={row.row_number}><td>{row.row_number}</td>{preview.columns.map((c: any) => <td key={c.index}>{row.cells[c.index] || "—"}</td>)}</tr>)}</tbody></table></div><div className="import-note">El número de máquina es el identificador: los nuevos se crearán y los existentes se actualizarán. Los números repetidos dentro del archivo se omitirán. Celdas vacías conservan los datos actuales; las áreas o sectores de texto que no existan se agregarán al catálogo. El estado y la posición del plano no se modifican.</div></>}
    {result && <div className="import-results"><div className="import-summary"><span>Procesadas <b>{result.processed}</b></span><span>Nuevas <b>{result.created}</b></span><span>Actualizadas <b>{result.updated}</b></span><span>Sin cambios <b>{result.unchanged ?? 0}</b></span><span>Con errores <b>{result.errors_count}</b></span></div>{result.items.some((i: any) => i.warning) && <div className="import-note">Algunas filas tienen advertencias, por ejemplo áreas no encontradas; se conservaron los datos actuales para esos campos.</div>}{result.errors.length > 0 && <div className="import-errors"><b>Filas omitidas</b>{result.errors.slice(0, 10).map((e: any, i: number) => <div key={i}>Fila {e.row}{e.number ? ` · ${e.number}` : ""}: {e.reason}</div>)}</div>}<p>Las máquinas nuevas y actualizadas ya están disponibles en el inventario.</p></div>}
    {error && <div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{result ? "Cerrar" : "Cancelar"}</button>{!preview && <button type="button" className="primary" disabled={!file || busy} onClick={getPreview}>{busy ? "Leyendo archivo…" : "Previsualizar"}</button>}{preview && !result && <button type="button" className="primary" disabled={busy} onClick={confirm}>{busy ? "Importando…" : "Confirmar e importar"}</button>}</div>
  </div></div>;
}
createRoot(document.getElementById("root")!).render(<App/>);
